package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"

	"yaolight-workshop/backend/infrastructure/database"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
	userModels "yaolight-workshop/backend/modules/user/models"
)

// StreamCallback 流式执行回调函数
// contentType: "reasoning" 表示思考内容, "content" 表示正式内容, "" 表示未指定（向后兼容）
type StreamCallback func(nodeID string, content string, done bool, contentType string, err error)

// ExecuteAINodeStream 流式执行AI节点
func (e *WorkflowExecutor) ExecuteAINodeStream(
	ctx context.Context,
	node NodeConfig,
	dataFlow *DataFlow,
	variableContext *VariableContext,
	userID uint,
	callback StreamCallback,
) {
	nodeID := node.ID

	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(nodeID)
	if err != nil {
		// 输入数据获取失败，继续执行（可能没有上游节点）
	}

	// 获取提示词配置
	prompt := getString(node.Config, "prompt", "")
	if prompt == "" {
		callback(nodeID, "", true, "", fmt.Errorf("提示词不能为空"))
		return
	}

	// 如果提示词包含变量，解析它
	if strings.Contains(prompt, "{{") {
		resolved, err := variableContext.ResolveTemplate(prompt)
		if err == nil && resolved != "" {
			prompt = resolved
		}
	}

	// 如果配置了内容变量，获取变量值
	contentVariable := getString(node.Config, "contentVariable", "")
	var content string
	if contentVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(contentVariable)
		if err == nil {
			if str, ok := resolved.(string); ok {
				content = str
			} else {
				content = fmt.Sprintf("%v", resolved)
			}
		}
	} else if inputData.Payload != nil {
		if contentMap, ok := inputData.Payload.(map[string]interface{}); ok {
			if c, exists := contentMap["content"]; exists {
				content = fmt.Sprintf("%v", c)
			} else if text, exists := contentMap["text"]; exists {
				content = fmt.Sprintf("%v", text)
			}
		}
	}

	// 获取模型模式
	modelMode := getString(node.Config, "modelMode", "system")
	modelID := getUint(node.Config, "modelId", 0)

	// 获取模型配置
	modelRepo := aiRepos.NewAIModelRepository(database.DB)
	modelConfig, err := aiService.GetModelConfigForExecution(
		modelMode,
		modelID,
		userID,
		node.Config,
		modelRepo,
	)
	if err != nil {
		callback(nodeID, "", true, "", fmt.Errorf("加载模型配置失败: %v", err))
		return
	}

	// 获取提供商
	provider, err := e.aiService.GetProvider(modelConfig.Provider)
	if err != nil {
		log.Printf("获取AI提供商失败: %v", err)
		callback(nodeID, "", true, "", fmt.Errorf("获取AI提供商失败: %v", err))
		return
	}

	// 构建提供商特定配置
	providerConfig := make(map[string]interface{})
	stream := false
	var costPerToken float64
	var billingModelID *uint

	// **计费逻辑**：
	// - system模式：使用系统API Key，需要扣费（从计费文档读取价格）
	// - saved模式：使用用户自己的API Key，不扣费（只记录使用量）
	// - custom模式：使用临时API Key，不扣费（只记录使用量）

	// 只有system模式需要计费
	if modelMode == "system" {
		// TODO: 从计费文档或配置中获取对应模型的计费标准
		// 目前暂时使用默认值，后续需要根据provider+modelName获取精确价格
		// 这里需要实现根据provider和modelName获取计费配置的逻辑
		// costPerToken = getPricingFromConfig(modelConfig.Provider, modelConfig.ModelName)
	}

	// 如果使用已保存的模型，从模型配置读取默认值（但不用于计费）
	if modelMode == "saved" {
		if modelID > 0 {
			billingModelID = &modelID
		}
		modelEntity, err := modelRepo.FindByIDAndUser(modelID, userID)
		if err == nil && modelEntity != nil {
			// saved模式不使用CostPerToken计费，因为使用的是用户自己的API Key
			// 从模型的 Params JSONB 字段读取默认配置
			if modelEntity.Params.Data != nil {
				if paramsMap, ok := modelEntity.Params.Data.(map[string]interface{}); ok {
					// 将模型级别的默认配置合并到 providerConfig
					for k, v := range paramsMap {
						providerConfig[k] = v
					}
					// 读取模型默认的 stream 值
					if s, ok := paramsMap["stream"].(bool); ok {
						stream = s
					}
				}
			}
		}
	}

	// 节点配置可以覆盖模型默认值
	// 支持 DeepSeek 和豆包（doubao）的流式和深度思考参数
	if modelConfig.Provider == "deepseek" {
		// DeepSeek 使用 thinking 布尔值
		if thinking, ok := node.Config["thinking"].(bool); ok {
			providerConfig["thinking"] = thinking
		} else if _, exists := providerConfig["thinking"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			providerConfig["thinking"] = false
		}
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			stream = false
			providerConfig["stream"] = false
		}
	} else if modelConfig.Provider == "doubao" {
		// 豆包使用 thinkingLevel 字符串（minimal/low/medium/high）
		if thinkingLevel, ok := node.Config["thinkingLevel"].(string); ok && thinkingLevel != "" {
			providerConfig["thinkingLevel"] = thinkingLevel
		} else {
			// 如果没有指定，使用默认值 medium
			providerConfig["thinkingLevel"] = "medium"
		}
		// 豆包默认开启流式（因为豆包默认开启思考，会返回思考内容）
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else {
			// 如果节点配置没有指定，豆包默认使用流式
			stream = true
			providerConfig["stream"] = true
		}
	} else if modelConfig.Provider == "qianwen" {
		// 通义千问支持流式输出
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			stream = false
			providerConfig["stream"] = false
		}
		// 通义千问深度思考参数（enable_thinking）
		// 注意：通义千问使用 enable_thinking 而不是 thinking
		if enableThinking, ok := node.Config["enable_thinking"].(bool); ok {
			providerConfig["enable_thinking"] = enableThinking
		} else if _, exists := providerConfig["enable_thinking"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			providerConfig["enable_thinking"] = false
		}
	} else if modelConfig.Provider == "zhipuai" {
		// 智谱AI GLM 使用 thinking 布尔值（与 DeepSeek 相同）
		if thinking, ok := node.Config["thinking"].(bool); ok {
			providerConfig["thinking"] = thinking
		} else if _, exists := providerConfig["thinking"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			providerConfig["thinking"] = false
		}
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			stream = false
		}
	} else if modelConfig.Provider == "gemini" {
		// Gemini (via OpenRouter)
		// OpenRouter 的 reasoning 参数是一个对象，例如：
		// { "enabled": true } 或 { "max_tokens": 2000 }
		// 检查 reasoning 参数 (前端使用布尔值)
		if reasoning, ok := node.Config["reasoning"].(bool); ok {
			if reasoning {
				// 启用推理，使用默认配置
				providerConfig["reasoning"] = map[string]interface{}{
					"enabled": true,
				}
			} else {
				// 禁用推理
				providerConfig["reasoning"] = map[string]interface{}{
					"enabled": false,
				}
			}
		} else if reasoningMap, ok := node.Config["reasoning"].(map[string]interface{}); ok {
			// 如果前端传递的是对象，直接使用
			providerConfig["reasoning"] = reasoningMap
		} else if _, exists := providerConfig["reasoning"]; !exists {
			// 默认不启用推理
			providerConfig["reasoning"] = map[string]interface{}{
				"enabled": false,
			}
		}
		// 兼容 thinking 参数 (DeepSeek 风格)
		if thinking, ok := node.Config["thinking"].(bool); ok {
			if thinking {
				providerConfig["reasoning"] = map[string]interface{}{
					"enabled": true,
				}
			}
		}

		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			stream = false
			providerConfig["stream"] = false
		}
	} else if modelConfig.Provider == "spark" {
		if thinkingType, ok := node.Config["thinkingType"].(string); ok && thinkingType != "" {
			providerConfig["thinkingType"] = thinkingType
		} else if _, exists := providerConfig["thinkingType"]; !exists {
			providerConfig["thinkingType"] = "enabled"
		}
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			stream = false
			providerConfig["stream"] = false
		}

		if user, ok := node.Config["user"].(string); ok && user != "" {
			providerConfig["user"] = user
		} else if _, exists := providerConfig["user"]; !exists {
			providerConfig["user"] = fmt.Sprintf("%d", userID)
		}
	} else if modelConfig.Provider == "hunyuan" {
		if v, ok := node.Config["enableEnhancement"].(bool); ok {
			providerConfig["enableEnhancement"] = v
		} else if _, exists := providerConfig["enableEnhancement"]; !exists {
			providerConfig["enableEnhancement"] = true
		}

		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			stream = false
			providerConfig["stream"] = false
		}
	}

	// 如果启用流式输出，使用流式方法
	if stream {
		var fullContent strings.Builder
		var fullReasoningContent strings.Builder
		var tokenDeducted bool

		// 创建适配器，将 providers.StreamCallback 转换为 services.StreamCallback
		providerCallback := func(deltaContent string, done bool, err error, usage *providers.TokenUsage) {
			// 检查 context 是否已取消
			select {
			case <-ctx.Done():
				callback(nodeID, "", true, "", ctx.Err())
				return
			default:
				// 继续执行
			}

			// **计费逻辑**：只有system模式才扣费和扣除token余额
			// saved和custom模式使用用户自己的API Key，不扣费不扣token，只记录使用量
			if usage != nil && !tokenDeducted {
				tokenDeducted = true

				// 只有system模式需要扣费和扣除token余额
				if modelMode == "system" {
					log.Printf("[%s] Processing system model billing: userID=%d, provider=%s, totalTokens=%d, done=%v",
						nodeID, userID, modelConfig.Provider, usage.TotalTokens, done)

					// 扣除用户Token余额（因为使用的是系统的API Key，系统需要向服务商付费）
					deductErr := e.userRepo.DeductTokens(userID, int64(usage.TotalTokens))
					if deductErr != nil {
						log.Printf("[%s] Token deduction failed for user %d: %v", nodeID, userID, deductErr)
					} else {
						log.Printf("[%s] Deducted %d tokens for user %d, provider: %s, model: %s",
							nodeID, usage.TotalTokens, userID, modelConfig.Provider, modelConfig.ModelName)
					}

					// 计算费用（TODO: 需要根据provider+modelName从计费文档获取精确价格）
					// 目前使用costPerToken，后续需要实现精确的计费逻辑（分离计费、分段计费等）
					cost := float64(usage.TotalTokens) * costPerToken

					transaction := userModels.TokenTransaction{
						UserID:           userID,
						Amount:           -int64(usage.TotalTokens),
						Type:             "consumption",
						RelatedID:        nodeID,
						Description:      "AI节点消耗（系统预设模型）",
						Provider:         modelConfig.Provider,
						ModelName:        modelConfig.ModelName,
						ModelMode:        modelMode,
						ModelID:          billingModelID,
						PromptTokens:     usage.PromptTokens,
						CompletionTokens: usage.CompletionTokens,
						TotalTokens:      usage.TotalTokens,
						Cost:             cost,
						Currency:         "USD",
					}
					if createErr := database.DB.Create(&transaction).Error; createErr != nil {
						log.Printf("[%s] Create token transaction failed for user %d: %v", nodeID, userID, createErr)
					} else {
						log.Printf("[%s] Token transaction created successfully: provider=%s, tokens=%d, cost=%f",
							nodeID, modelConfig.Provider, usage.TotalTokens, cost)
					}
				} else {
					// saved或custom模式：使用用户自己的API Key，只记录使用量，不扣费不扣token
					log.Printf("[%s] Recording usage (no billing, user's own API Key): userID=%d, mode=%s, provider=%s, totalTokens=%d",
						nodeID, userID, modelMode, modelConfig.Provider, usage.TotalTokens)

					transaction := userModels.TokenTransaction{
						UserID:           userID,
						Amount:           0,              // 不扣除token余额
						Type:             "usage_record", // 仅记录使用量
						RelatedID:        nodeID,
						Description:      fmt.Sprintf("AI节点使用记录（%s模式，用户自己的API Key）", modelMode),
						Provider:         modelConfig.Provider,
						ModelName:        modelConfig.ModelName,
						ModelMode:        modelMode,
						ModelID:          billingModelID,
						PromptTokens:     usage.PromptTokens,
						CompletionTokens: usage.CompletionTokens,
						TotalTokens:      usage.TotalTokens,
						Cost:             0, // 不产生费用
						Currency:         "USD",
					}
					if createErr := database.DB.Create(&transaction).Error; createErr != nil {
						log.Printf("[%s] Create usage record failed for user %d: %v", nodeID, userID, createErr)
					} else {
						log.Printf("[%s] Usage record created successfully: provider=%s, tokens=%d (no billing)",
							nodeID, modelConfig.Provider, usage.TotalTokens)
					}
				}
			} else if usage != nil && tokenDeducted {
				log.Printf("[%s] Usage received but token already deducted, skipping", nodeID)
			} else if done && !tokenDeducted && usage == nil {
				log.Printf("[%s] WARNING: Stream done but no usage info received! provider=%s",
					nodeID, modelConfig.Provider)
			}

			if err != nil {
				callback(nodeID, "", true, "", err)
				return
			}
			if deltaContent != "" {
				// 解析内容类型标记
				if strings.HasPrefix(deltaContent, "[REASONING_DELTA]") {
					// 思考内容增量
					reasoningDelta := strings.TrimPrefix(deltaContent, "[REASONING_DELTA]")
					fullReasoningContent.WriteString(reasoningDelta)
					// 发送思考内容（不带标记）
					callback(nodeID, reasoningDelta, false, "reasoning", nil)
				} else if strings.HasPrefix(deltaContent, "[CONTENT_DELTA]") {
					// 正式内容增量
					contentDelta := strings.TrimPrefix(deltaContent, "[CONTENT_DELTA]")
					fullContent.WriteString(contentDelta)
					// 发送正式内容（不带标记）
					callback(nodeID, contentDelta, false, "content", nil)
				} else if strings.Contains(deltaContent, "[REASONING]") || strings.Contains(deltaContent, "[CONTENT]") {
					// 完整格式（done时可能发送）- 只发送增量部分，避免重复
					// 注意：如果完整内容已经在增量中发送过，这里不应该再次发送
					// 只在 done=true 时作为最终确认发送，且只发送新增部分
					reasoningMatch := regexp.MustCompile(`\[REASONING\]([\s\S]*?)\[/REASONING\]`).FindStringSubmatch(deltaContent)
					contentMatch := regexp.MustCompile(`\[CONTENT\]([\s\S]*?)\[/CONTENT\]`).FindStringSubmatch(deltaContent)

					if reasoningMatch != nil && len(reasoningMatch) > 1 {
						reasoningContent := reasoningMatch[1]
						currentReasoningLen := fullReasoningContent.Len()
						// 只发送新增的部分，避免重复
						if len(reasoningContent) > currentReasoningLen {
							newReasoning := reasoningContent[currentReasoningLen:]
							if newReasoning != "" {
								fullReasoningContent.WriteString(newReasoning)
								callback(nodeID, newReasoning, false, "reasoning", nil)
							}
						}
					}
					if contentMatch != nil && len(contentMatch) > 1 {
						contentPart := contentMatch[1]
						currentContentLen := fullContent.Len()
						// 只发送新增的部分，避免重复
						if len(contentPart) > currentContentLen {
							newContent := contentPart[currentContentLen:]
							if newContent != "" {
								fullContent.WriteString(newContent)
								callback(nodeID, newContent, false, "content", nil)
							}
						}
					}
				} else {
					// 没有标记，向后兼容，作为正式内容
					fullContent.WriteString(deltaContent)
					callback(nodeID, deltaContent, false, "", nil)
				}
			}
			if done {
				// 流式完成，发送最终结果
				finalContent := fullContent.String()
				finalReasoningContent := fullReasoningContent.String()

				// 保存AI节点的输出数据到数据流和变量上下文
				resultData := map[string]interface{}{
					"result":           finalContent,          // AI节点的输出变量名是 result
					"content":          finalContent,          // 保留 content 以兼容旧代码
					"reasoningContent": finalReasoningContent, // 思考内容
					"model":            modelConfig.ModelName,
				}
				nodeData := NewNodeData(resultData)
				dataFlow.SetNodeOutput(nodeID, nodeData)
				variableContext.SetNodeOutput(nodeID, nodeData)

				// 发送完成信号（不发送内容，只标记 done=true，避免重复）
				// 内容已经在增量消息中发送完毕
				callback(nodeID, "", true, "", nil)
			}
		}
		err := provider.ChatStream(ctx, modelConfig, prompt, content, providerConfig, providerCallback)
		if err != nil {
			callback(nodeID, "", true, "", err)
		}
	} else {
		// 非流式输出
		chatResp, err := provider.Chat(modelConfig, prompt, content, providerConfig)
		if err != nil {
			callback(nodeID, "", true, "", fmt.Errorf("AI调用失败: %v", err))
			return
		}

		if chatResp.TokensUsed > 0 {
			// **计费逻辑**：只有system模式才扣费和扣除token余额
			if modelMode == "system" {
				// 扣除用户Token余额（因为使用的是系统的API Key，系统需要向服务商付费）
				deductErr := e.userRepo.DeductTokens(userID, int64(chatResp.TokensUsed))
				if deductErr != nil {
					log.Printf("[%s] Token deduction failed for user %d: %v", nodeID, userID, deductErr)
				} else {
					log.Printf("[%s] Deducted %d tokens for user %d (Non-Stream Mode, system model)", nodeID, chatResp.TokensUsed, userID)
				}

				// 计算费用（TODO: 需要根据provider+modelName从计费文档获取精确价格）
				cost := float64(chatResp.TokensUsed) * costPerToken

				transaction := userModels.TokenTransaction{
					UserID:      userID,
					Amount:      -int64(chatResp.TokensUsed),
					Type:        "consumption",
					RelatedID:   nodeID,
					Description: "AI节点消耗（系统预设模型）",
					Provider:    modelConfig.Provider,
					ModelName:   modelConfig.ModelName,
					ModelMode:   modelMode,
					ModelID:     billingModelID,
					TotalTokens: chatResp.TokensUsed,
					Cost:        cost,
					Currency:    "USD",
				}
				if createErr := database.DB.Create(&transaction).Error; createErr != nil {
					log.Printf("[%s] Create token transaction failed for user %d: %v", nodeID, userID, createErr)
				}
			} else {
				// saved或custom模式：使用用户自己的API Key，只记录使用量，不扣费不扣token
				log.Printf("[%s] Recording usage (no billing, user's own API Key): userID=%d, mode=%s, provider=%s, totalTokens=%d",
					nodeID, userID, modelMode, modelConfig.Provider, chatResp.TokensUsed)

				transaction := userModels.TokenTransaction{
					UserID:      userID,
					Amount:      0,              // 不扣除token余额
					Type:        "usage_record", // 仅记录使用量
					RelatedID:   nodeID,
					Description: fmt.Sprintf("AI节点使用记录（%s模式，用户自己的API Key）", modelMode),
					Provider:    modelConfig.Provider,
					ModelName:   modelConfig.ModelName,
					ModelMode:   modelMode,
					ModelID:     billingModelID,
					TotalTokens: chatResp.TokensUsed,
					Cost:        0, // 不产生费用
					Currency:    "USD",
				}
				if createErr := database.DB.Create(&transaction).Error; createErr != nil {
					log.Printf("[%s] Create usage record failed for user %d: %v", nodeID, userID, createErr)
				}
			}
		}

		// 保存AI节点的输出数据到数据流和变量上下文
		resultData := map[string]interface{}{
			"result":     chatResp.Content, // AI节点的输出变量名是 result
			"content":    chatResp.Content, // 保留 content 以兼容旧代码
			"tokensUsed": chatResp.TokensUsed,
			"model":      chatResp.Model, // ChatResponse 中是 Model
		}
		if chatResp.ReasoningDetails != nil {
			resultData["reasoningContent"] = chatResp.ReasoningDetails
		}
		nodeData := NewNodeData(resultData)
		dataFlow.SetNodeOutput(nodeID, nodeData)
		variableContext.SetNodeOutput(nodeID, nodeData)

		callback(nodeID, chatResp.Content, true, "", nil)
	}
}

// ExecuteWorkflowStream 流式执行工作流（支持所有节点类型）
func (e *WorkflowExecutor) ExecuteWorkflowStream(
	ctx context.Context,
	req ExecutionRequest,
	callback StreamCallback,
) error {

	if len(req.Nodes) == 0 {
		return fmt.Errorf("工作流节点为空")
	}

	// 辅助函数：检查AI节点是否启用流式输出（考虑provider的默认行为）
	checkStreamEnabled := func(node NodeConfig, modelConfig *providers.AIModelConfig) bool {
		// 检查节点配置中的 stream 设置
		if stream, ok := node.Config["stream"].(bool); ok {
			return stream
		}

		// 如果节点配置没有指定，检查模型默认配置
		if modelMode := getString(node.Config, "modelMode", "system"); modelMode == "saved" {
			modelID := getUint(node.Config, "modelId", 0)
			if modelID > 0 {
				modelRepo := aiRepos.NewAIModelRepository(database.DB)
				modelEntity, err := modelRepo.FindByIDAndUser(modelID, req.UserID)
				if err == nil && modelEntity != nil && modelEntity.Params.Data != nil {
					if paramsMap, ok := modelEntity.Params.Data.(map[string]interface{}); ok {
						if s, ok := paramsMap["stream"].(bool); ok {
							return s
						}
					}
				}
			}
		}

		// 根据provider的默认行为判断
		// 豆包默认开启流式
		if modelConfig != nil && modelConfig.Provider == "doubao" {
			return true
		}

		// 其他provider默认不开启流式
		return false
	}

	// 创建数据流和变量上下文
	dataFlow := NewDataFlow(req.Edges)
	variableContext := NewVariableContext()

	// 执行上游节点（如果有）
	executed := make(map[string]bool)

	// 存储条件节点的结果，用于判断边是否应该执行
	conditionResults := make(map[string]bool)

	// 递归执行所有上游节点（按拓扑顺序）
	var executeUpstream func(nodeID string)
	executeUpstream = func(nodeID string) {
		if executed[nodeID] {
			return
		}

		// 找到节点配置
		var nodeConfig *NodeConfig
		for i := range req.Nodes {
			if req.Nodes[i].ID == nodeID {
				nodeConfig = &req.Nodes[i]
				break
			}
		}

		if nodeConfig == nil {
			return
		}

		// 先执行该节点的上游节点
		for _, edge := range req.Edges {
			if edge.Target == nodeID {
				executeUpstream(edge.Source)
			}
		}

		// 设置节点类型到变量上下文（关键步骤！）
		variableContext.SetNodeType(nodeConfig.ID, nodeConfig.Type)

		// 执行节点
		result := e.executeNode(*nodeConfig, dataFlow, variableContext, req.UserID)
		if result.Success {
			nodeData := NewNodeData(result.Data)
			dataFlow.SetNodeOutput(nodeConfig.ID, nodeData)
			variableContext.SetNodeOutput(nodeConfig.ID, nodeData)

			// 发送节点执行成功的事件，包含完整结果数据
			// 使用特殊的contentType "node_result" 来标识这是节点结果事件
			resultJSON, _ := json.Marshal(result)
			callback(nodeConfig.ID, string(resultJSON), false, "node_result", nil)
		} else {
			// 发送节点执行失败的事件
			resultJSON, _ := json.Marshal(result)
			callback(nodeConfig.ID, string(resultJSON), false, "node_result", fmt.Errorf("节点执行失败: %s", result.Error))
		}
		executed[nodeConfig.ID] = true
	}

	// 执行所有节点（按拓扑顺序）
	// 找到所有起始节点（没有入边的节点）
	startNodes := e.findStartNodes(req.Nodes, req.Edges)
	queue := make([]string, 0)
	for _, node := range startNodes {
		queue = append(queue, node.ID)
	}

	// 执行所有节点
	for len(queue) > 0 {
		nodeID := queue[0]
		queue = queue[1:]

		if executed[nodeID] {
			continue
		}

		// 找到节点配置
		var nodeConfig *NodeConfig
		for i := range req.Nodes {
			if req.Nodes[i].ID == nodeID {
				nodeConfig = &req.Nodes[i]
				break
			}
		}

		if nodeConfig == nil {
			continue
		}

		// 先执行该节点的上游节点
		for _, edge := range req.Edges {
			if edge.Target == nodeID {
				executeUpstream(edge.Source)
			}
		}

		// 设置节点类型到变量上下文
		variableContext.SetNodeType(nodeConfig.ID, nodeConfig.Type)

		// 如果是AI节点，检查是否启用流式输出
		if nodeConfig.Type == "ai" {
			// 获取模型配置以判断是否启用流式
			modelMode := getString(nodeConfig.Config, "modelMode", "system")
			modelRepo := aiRepos.NewAIModelRepository(database.DB)
			modelConfig, err := aiService.GetModelConfigForExecution(
				modelMode,
				getUint(nodeConfig.Config, "modelId", 0),
				req.UserID,
				nodeConfig.Config,
				modelRepo,
			)

			// 检查是否启用流式输出
			shouldUseStream := false
			if err == nil && modelConfig != nil {
				shouldUseStream = checkStreamEnabled(*nodeConfig, modelConfig)
			}

			if shouldUseStream {
				// 使用流式执行AI节点（包含完整计费逻辑）
				originalCallback := callback
				wrappedCallback := func(nodeID string, content string, done bool, contentType string, err error) {
					// 调用原始callback
					originalCallback(nodeID, content, done, contentType, err)
				}

				e.ExecuteAINodeStream(ctx, *nodeConfig, dataFlow, variableContext, req.UserID, wrappedCallback)

				// 标记AI节点为已执行（无论成功或失败）
				executed[nodeConfig.ID] = true

				// 继续执行下游节点（无论AI节点成功或失败）
				// 注意：这里不continue，让代码继续执行到"找到下一个节点"的逻辑
			} else {
				// 非流式AI节点，使用普通执行（包含计费逻辑）
				result := e.executeNode(*nodeConfig, dataFlow, variableContext, req.UserID)
				if result.Success {
					nodeData := NewNodeData(result.Data)
					dataFlow.SetNodeOutput(nodeConfig.ID, nodeData)
					variableContext.SetNodeOutput(nodeConfig.ID, nodeData)
					resultJSON, _ := json.Marshal(result)
					callback(nodeConfig.ID, string(resultJSON), false, "node_result", nil)
				} else {
					resultJSON, _ := json.Marshal(result)
					callback(nodeConfig.ID, string(resultJSON), false, "node_result", fmt.Errorf("节点执行失败: %s", result.Error))
				}
				executed[nodeConfig.ID] = true
			}
		} else {
			// 普通节点或非流式AI节点，使用普通执行
			result := e.executeNode(*nodeConfig, dataFlow, variableContext, req.UserID)
			if result.Success {
				nodeData := NewNodeData(result.Data)
				dataFlow.SetNodeOutput(nodeConfig.ID, nodeData)
				variableContext.SetNodeOutput(nodeConfig.ID, nodeData)
				resultJSON, _ := json.Marshal(result)
				callback(nodeConfig.ID, string(resultJSON), false, "node_result", nil)
			} else {
				resultJSON, _ := json.Marshal(result)
				callback(nodeConfig.ID, string(resultJSON), false, "node_result", fmt.Errorf("节点执行失败: %s", result.Error))
			}
		}

		executed[nodeConfig.ID] = true

		// 如果是条件节点，需要根据条件结果选择正确的分支
		if nodeConfig.Type == "condition" {
			// 从 dataFlow 获取条件节点的执行结果
			conditionResult := false
			if nodeData := dataFlow.GetNodeOutput(nodeConfig.ID); nodeData != nil {
				if resultData, ok := nodeData.Payload.(map[string]interface{}); ok {
					if res, exists := resultData["result"]; exists {
						if boolRes, ok := res.(bool); ok {
							conditionResult = boolRes
						}
					}
				}
			}
			// 保存条件节点的结果，供后续判断使用
			conditionResults[nodeConfig.ID] = conditionResult

			// 只执行匹配条件结果的边
			for _, edge := range req.Edges {
				if edge.Source == nodeID && !executed[edge.Target] {
					// 检查边的 sourceHandle 是否匹配条件结果
					shouldExecute := false
					if edge.SourceHandle == "true" && conditionResult {
						shouldExecute = true
					} else if edge.SourceHandle == "false" && !conditionResult {
						shouldExecute = true
					} else if edge.SourceHandle == "" {
						// 兼容旧数据：如果没有 sourceHandle，默认执行所有边
						shouldExecute = true
					}

					if shouldExecute {
						allInputsReady := true
						for _, e := range req.Edges {
							if e.Target == edge.Target && !executed[e.Source] {
								allInputsReady = false
								break
							}
						}
						if allInputsReady {
							queue = append(queue, edge.Target)
						}
					}
				}
			}
		} else {
			// 非条件节点，执行所有出边
			for _, edge := range req.Edges {
				if edge.Source == nodeID && !executed[edge.Target] {
					// 检查该节点的所有入边是否都已执行
					// 对于合并节点，需要特殊处理：只检查"应该执行"的边
					allInputsReady := true
					for _, e := range req.Edges {
						if e.Target == edge.Target {
							// 检查这个入边是否应该被执行
							shouldWaitForThisEdge := true

							// 如果源节点没有执行，检查它是否来自条件节点的未执行分支
							if !executed[e.Source] {
								// 递归检查：如果源节点没有执行，检查它的上游边是否来自条件节点的未执行分支
								shouldWaitForThisEdge = isEdgeFromConditionBranch(e, req.Nodes, req.Edges, conditionResults, executed)
							}

							// 如果这个边应该被执行，但源节点还没执行，则不能继续
							if shouldWaitForThisEdge && !executed[e.Source] {
								allInputsReady = false
								break
							}
						}
					}
					if allInputsReady {
						queue = append(queue, edge.Target)
					}
				}
			}
		}
	}

	// 所有节点执行完成，发送最终完成信号
	// 使用一个特殊的节点ID "workflow_complete" 来表示整个工作流完成
	callback("workflow_complete", "", true, "workflow_complete", nil)

	return nil
}
