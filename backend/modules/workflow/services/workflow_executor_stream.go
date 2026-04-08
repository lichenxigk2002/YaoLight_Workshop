package services

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
	log "yaolight-workshop/backend/infrastructure/logx"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/shared"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
	notification "yaolight-workshop/backend/modules/notification"
	taskModels "yaolight-workshop/backend/modules/task/models"
	taskRepos "yaolight-workshop/backend/modules/task/repositories"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

// StreamCallback 流式执行回调函数
// contentType: "reasoning" 表示思考内容, "content" 表示正式内容, "" 表示未指定（向后兼容）
type StreamCallback func(nodeID string, content string, done bool, contentType string, err error)

func jsonbFromPayload(payload interface{}) *shared.JSONB {
	if payload == nil {
		return nil
	}
	return &shared.JSONB{Data: payload}
}

func collectTerminalNodes(nodes []NodeConfig, edges []EdgeConfig) []NodeConfig {
	hasOutgoing := make(map[string]bool, len(nodes))
	for _, edge := range edges {
		hasOutgoing[edge.Source] = true
	}

	terminalNodes := make([]NodeConfig, 0)
	for _, node := range nodes {
		if !hasOutgoing[node.ID] {
			terminalNodes = append(terminalNodes, node)
		}
	}
	return terminalNodes
}

func collectTaskResultPayload(dataFlow *DataFlow, terminalNodes []NodeConfig) *shared.JSONB {
	if len(terminalNodes) == 0 {
		return nil
	}

	resultsByNode := make(map[string]interface{}, len(terminalNodes))
	for _, node := range terminalNodes {
		output := dataFlow.GetNodeOutput(node.ID)
		if output == nil || output.Payload == nil {
			continue
		}
		resultsByNode[node.ID] = output.Payload
	}

	if len(resultsByNode) == 0 {
		return nil
	}
	if len(resultsByNode) == 1 {
		for _, payload := range resultsByNode {
			return jsonbFromPayload(payload)
		}
	}

	return jsonbFromPayload(resultsByNode)
}

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
	// 如果 modelMode 为空字符串，也使用默认值 "system"（确保测试工作流时能正确计费）
	modelMode := getString(node.Config, "modelMode", "system")
	if modelMode == "" {
		modelMode = "system"
	}
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
	var billingModelID *uint

	// **计费逻辑**：
	// - system模式：使用系统API Key，需要扣费（从数据库读取计费配置）
	// - saved模式：使用用户自己的API Key，不扣费（只记录使用量）
	// - custom模式：使用临时API Key，不扣费（只记录使用量）
	// 费用计算现在使用 PricingService 从数据库读取计费配置

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
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s doubao thinkingLevel=%s (从节点配置读取)", nodeID, thinkingLevel)
		} else {
			// 如果没有指定，使用默认值 medium
			providerConfig["thinkingLevel"] = "medium"
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s doubao thinkingLevel=medium (默认值)", nodeID)
		}
		// 豆包默认开启流式（因为豆包默认开启思考，会返回思考内容）
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s doubao stream=%v (从节点配置读取)", nodeID, s)
		} else if s, exists := providerConfig["stream"].(bool); exists {
			// 从模型配置中读取（saved 模式）
			stream = s
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s doubao stream=%v (从模型配置读取)", nodeID, s)
		} else {
			// 如果节点配置没有指定，豆包默认使用流式
			stream = true
			providerConfig["stream"] = true
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s doubao stream=true (豆包默认值)", nodeID)
		}
	} else if modelConfig.Provider == "qwen" {
		// 通义千问（qwen）支持流式输出
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s qwen stream=%v (从节点配置读取)", nodeID, s)
		} else if s, exists := providerConfig["stream"].(bool); exists {
			// 从 providerConfig 中读取（模型默认配置，saved 模式）
			stream = s
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s qwen stream=%v (从模型配置读取)", nodeID, s)
		} else {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			stream = false
			providerConfig["stream"] = false
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s qwen stream=false (默认值)", nodeID)
		}
		// 通义千问深度思考参数（enable_thinking）
		// 注意：通义千问使用 enable_thinking 而不是 thinking
		if enableThinking, ok := node.Config["enable_thinking"].(bool); ok {
			providerConfig["enable_thinking"] = enableThinking
		} else if _, exists := providerConfig["enable_thinking"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			providerConfig["enable_thinking"] = false
		}
	} else if modelConfig.Provider == "qianwen" {
		// 通义千问（qianwen）支持流式输出
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s qianwen stream=%v (从节点配置读取)", nodeID, s)
		} else if s, exists := providerConfig["stream"].(bool); exists {
			// 从 providerConfig 中读取（模型默认配置，saved 模式）
			stream = s
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s qianwen stream=%v (从模型配置读取)", nodeID, s)
		} else {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			stream = false
			providerConfig["stream"] = false
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s qianwen stream=false (默认值)", nodeID)
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
	} else if modelConfig.Provider == "claude" || modelConfig.Provider == "gemini" || modelConfig.Provider == "grok" || modelConfig.Provider == "gpt" {
		// Claude/Gemini/Grok/GPT (via OpenRouter)
		// OpenRouter 的 reasoning 参数是一个对象，例如：
		// { "enabled": true } 或 { "max_tokens": 2000 }
		log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 是Claude/Gemini/Grok/GPT provider", nodeID)
		log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 节点配置中的reasoning: %v, thinking: %v", nodeID, node.Config["reasoning"], node.Config["thinking"])

		// 检查 reasoning 参数 (前端使用布尔值)
		if reasoning, ok := node.Config["reasoning"].(bool); ok {
			if reasoning {
				// 启用推理，使用默认配置
				reasoningConfig := map[string]interface{}{
					"enabled": true,
				}
				// 如果有 reasoning_effort，添加到配置中
				if effort, ok := node.Config["reasoning_effort"].(string); ok && effort != "" {
					reasoningConfig["effort"] = effort
					log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 添加 reasoning_effort=%s", nodeID, effort)
				}
				providerConfig["reasoning"] = reasoningConfig
				log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 启用推理 (从reasoning参数), reasoning=%+v", nodeID, reasoningConfig)
			} else {
				log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s reasoning=false, 不添加reasoning参数", nodeID)
			}
			// 注意：如果 reasoning=false，不添加reasoning参数（根据官方示例）
		} else if reasoningMap, ok := node.Config["reasoning"].(map[string]interface{}); ok {
			// 如果前端传递的是对象，直接使用
			providerConfig["reasoning"] = reasoningMap
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 使用推理配置对象, reasoning=%+v", nodeID, reasoningMap)
		} else {
			// 兼容 thinking 参数 (DeepSeek 风格)
			if thinking, ok := node.Config["thinking"].(bool); ok {
				if thinking {
					reasoningConfig := map[string]interface{}{
						"enabled": true,
					}
					// 如果有 reasoning_effort，添加到配置中
					if effort, ok := node.Config["reasoning_effort"].(string); ok && effort != "" {
						reasoningConfig["effort"] = effort
						log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 添加 reasoning_effort=%s", nodeID, effort)
					}
					providerConfig["reasoning"] = reasoningConfig
					log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 启用推理 (从thinking参数), reasoning=%+v", nodeID, reasoningConfig)
				} else {
					log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s thinking=false, 不添加reasoning参数", nodeID)
				}
			} else {
				log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 未找到reasoning或thinking参数", nodeID)
			}
		}
		// 注意：根据官方示例，如果不启用推理，不应该添加reasoning参数
		// 只有当明确启用时才添加，不添加默认的 {"enabled": false}

		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			stream = false
			providerConfig["stream"] = false
		}
	} else if modelConfig.Provider == "spark" {
		log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 是讯飞星火provider", nodeID)
		log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 节点配置中的thinkingType: %v", nodeID, node.Config["thinkingType"])
		if thinkingType, ok := node.Config["thinkingType"].(string); ok && thinkingType != "" {
			providerConfig["thinkingType"] = thinkingType
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s thinkingType=%s (从节点配置读取)", nodeID, thinkingType)
		} else if thinkingType, exists := providerConfig["thinkingType"].(string); exists {
			// 从模型配置中读取（saved 模式）
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s thinkingType=%s (从模型配置读取)", nodeID, thinkingType)
		} else {
			// 如果没有指定，使用默认值 "auto"（让模型自动判断）
			providerConfig["thinkingType"] = "auto"
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s thinkingType=auto (默认值)", nodeID)
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
	log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s: stream=%v, provider=%s, modelName=%s",
		nodeID, stream, modelConfig.Provider, modelConfig.ModelName)
	log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s: providerConfig=%+v", nodeID, providerConfig)

	if stream {
		log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 开始流式执行", nodeID)
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

					// 使用 PricingService 计算等效Token数（星尘消耗）
					// 以DeepSeek为基准，其他模型按价格倍数计算等效Token
					equivalentTokens, err := e.pricingService.CalculateEquivalentTokens(usage, modelConfig.Provider, modelConfig.ModelName)
					if err != nil {
						log.Printf("[%s] Failed to calculate equivalent tokens: %v, using actual tokens", nodeID, err)
						equivalentTokens = int64(usage.TotalTokens) // 计算失败时使用实际Token数
					}

					// 计算费用（仅用于记录）
					cost, err := e.pricingService.CalculateCost(usage, modelConfig.Provider, modelConfig.ModelName)
					if err != nil {
						log.Printf("[%s] Failed to calculate cost: %v", nodeID, err)
						cost = 0
					}
					currency := e.pricingService.GetCurrency(modelConfig.Provider, modelConfig.ModelName)
					var cacheRead, cacheWrite, audio int
					if usage.CacheReadTokens != nil {
						cacheRead = *usage.CacheReadTokens
					}
					if usage.CacheWriteTokens != nil {
						cacheWrite = *usage.CacheWriteTokens
					}
					if usage.AudioTokens != nil {
						audio = *usage.AudioTokens
					}

					transaction := userModels.TokenTransaction{
						UserID:           userID,
						Amount:           -equivalentTokens,
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
						CacheReadTokens:  cacheRead,
						CacheWriteTokens: cacheWrite,
						AudioTokens:      audio,
						Cost:             cost,
						Currency:         currency,
					}
					if err := database.DB.Transaction(func(tx *gorm.DB) error {
						if err := e.userRepo.DeductTokensWithDB(tx, userID, equivalentTokens); err != nil {
							return err
						}
						return tx.Create(&transaction).Error
					}); err != nil {
						log.Printf("[%s] Token deduction/transaction failed for user %d: %v", nodeID, userID, err)
					} else {
						log.Printf("[%s] Deducted %d stardust (equivalent tokens) for user %d, actual tokens: %d, provider: %s, model: %s",
							nodeID, equivalentTokens, usage.TotalTokens, userID, modelConfig.Provider, modelConfig.ModelName)
					}
				} else {
					// saved或custom模式：使用用户自己的API Key，只记录使用量，不扣费不扣token
					log.Printf("[%s] Recording usage (no billing, user's own API Key): userID=%d, mode=%s, provider=%s, totalTokens=%d",
						nodeID, userID, modelMode, modelConfig.Provider, usage.TotalTokens)

					// 提取扩展Token信息
					var cacheRead, cacheWrite, audio int
					if usage.CacheReadTokens != nil {
						cacheRead = *usage.CacheReadTokens
					}
					if usage.CacheWriteTokens != nil {
						cacheWrite = *usage.CacheWriteTokens
					}
					if usage.AudioTokens != nil {
						audio = *usage.AudioTokens
					}

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
						CacheReadTokens:  cacheRead,
						CacheWriteTokens: cacheWrite,
						AudioTokens:      audio,
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
		log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 调用 provider.ChatStream", nodeID)
		err := provider.ChatStream(ctx, modelConfig, prompt, content, providerConfig, providerCallback)
		if err != nil {
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s ChatStream 失败: %v", nodeID, err)
			callback(nodeID, "", true, "", err)
		} else {
			log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s ChatStream 成功完成", nodeID)
		}
	} else {
		log.Printf("[流式调试-后端] ExecuteAINodeStream 节点 %s 使用非流式执行 (stream=false)", nodeID)
		// 非流式输出
		chatResp, err := provider.Chat(modelConfig, prompt, content, providerConfig)
		if err != nil {
			callback(nodeID, "", true, "", fmt.Errorf("AI调用失败: %v", err))
			return
		}

		if chatResp.TokensUsed > 0 || (chatResp.Usage != nil && chatResp.Usage.TotalTokens > 0) {
			// 优先使用详细的 Usage 信息
			usage := chatResp.Usage
			if usage == nil {
				usage = &providers.TokenUsage{
					TotalTokens: chatResp.TokensUsed,
				}
			}

			// **计费逻辑**：只有system模式才扣费和扣除token余额
			if modelMode == "system" {
				equivalentTokens, err := e.pricingService.CalculateEquivalentTokens(usage, modelConfig.Provider, modelConfig.ModelName)
				if err != nil {
					log.Printf("[%s] Failed to calculate equivalent tokens: %v, using actual tokens", nodeID, err)
					equivalentTokens = int64(usage.TotalTokens)
				}

				cost, err := e.pricingService.CalculateCost(usage, modelConfig.Provider, modelConfig.ModelName)
				if err != nil {
					log.Printf("[%s] Failed to calculate cost: %v", nodeID, err)
					cost = 0
				}
				currency := e.pricingService.GetCurrency(modelConfig.Provider, modelConfig.ModelName)
				var cacheRead, cacheWrite, audio int
				if usage.CacheReadTokens != nil {
					cacheRead = *usage.CacheReadTokens
				}
				if usage.CacheWriteTokens != nil {
					cacheWrite = *usage.CacheWriteTokens
				}
				if usage.AudioTokens != nil {
					audio = *usage.AudioTokens
				}

				transaction := userModels.TokenTransaction{
					UserID:           userID,
					Amount:           -equivalentTokens,
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
					CacheReadTokens:  cacheRead,
					CacheWriteTokens: cacheWrite,
					AudioTokens:      audio,
					Cost:             cost,
					Currency:         currency,
				}
				if err := database.DB.Transaction(func(tx *gorm.DB) error {
					if err := e.userRepo.DeductTokensWithDB(tx, userID, equivalentTokens); err != nil {
						return err
					}
					return tx.Create(&transaction).Error
				}); err != nil {
					log.Printf("[%s] Token deduction/transaction failed for user %d: %v", nodeID, userID, err)
				} else {
					log.Printf("[%s] Deducted %d stardust (equivalent tokens) for user %d, actual tokens: %d, provider: %s, model: %s",
						nodeID, equivalentTokens, usage.TotalTokens, userID, modelConfig.Provider, modelConfig.ModelName)
				}
			} else {
				// saved或custom模式：使用用户自己的API Key，只记录使用量，不扣费不扣token
				log.Printf("[%s] Recording usage (no billing, user's own API Key): userID=%d, mode=%s, provider=%s, totalTokens=%d",
					nodeID, userID, modelMode, modelConfig.Provider, usage.TotalTokens)

				// 提取扩展Token信息
				var cacheRead, cacheWrite, audio int
				if usage.CacheReadTokens != nil {
					cacheRead = *usage.CacheReadTokens
				}
				if usage.CacheWriteTokens != nil {
					cacheWrite = *usage.CacheWriteTokens
				}
				if usage.AudioTokens != nil {
					audio = *usage.AudioTokens
				}

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
					CacheReadTokens:  cacheRead,
					CacheWriteTokens: cacheWrite,
					AudioTokens:      audio,
					Cost:             0, // 不产生费用
					Currency:         "USD",
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
func (e *WorkflowExecutor) executeWorkflowStreamLegacy(
	ctx context.Context,
	req ExecutionRequest,
	callback StreamCallback,
) error {

	if len(req.Nodes) == 0 {
		return fmt.Errorf("工作流节点为空")
	}

	// 创建任务记录
	now := time.Now()
	task := &taskModels.Task{
		WorkflowID: req.WorkflowID,
		UserID:     req.UserID,
		Status:     "running",
		Priority:   5,
		Progress:   0,
		RetryCount: 0,
		MaxRetries: 3,
		Tags:       shared.JSONB{Data: []interface{}{}},
		StartedAt:  &now,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	taskRepo := taskRepos.NewTaskRepository(database.DB)
	nodeExecutionRepo := taskRepos.NewTaskNodeExecutionRepository(database.DB)
	startNodes := e.findStartNodes(req.Nodes, req.Edges)
	startNodeIDs := make(map[string]struct{}, len(startNodes))
	for _, node := range startNodes {
		startNodeIDs[node.ID] = struct{}{}
	}
	terminalNodes := collectTerminalNodes(req.Nodes, req.Edges)

	if err := taskRepo.CreateTask(task); err != nil {
		log.Printf("创建任务记录失败: %v", err)
		// 不影响执行，继续
	}

	// 记录任务开始时间，用于计算执行时长
	taskStartTime := time.Now()

	// 辅助函数：检查AI节点是否启用流式输出（考虑provider的默认行为）
	checkStreamEnabled := func(node NodeConfig, modelConfig *providers.AIModelConfig) bool {
		log.Printf("[流式调试-后端] checkStreamEnabled 开始检查节点 %s", node.ID)
		log.Printf("[流式调试-后端] 节点配置: %+v", node.Config)

		// 检查节点配置中的 stream 设置
		if stream, ok := node.Config["stream"].(bool); ok {
			log.Printf("[流式调试-后端] 节点 %s 配置中 stream=%v (从节点配置读取)", node.ID, stream)
			return stream
		}
		log.Printf("[流式调试-后端] 节点 %s 配置中没有 stream 字段", node.ID)

		// 如果节点配置没有指定，检查模型默认配置
		if modelMode := getString(node.Config, "modelMode", "system"); modelMode == "saved" {
			modelID := getUint(node.Config, "modelId", 0)
			if modelID > 0 {
				modelRepo := aiRepos.NewAIModelRepository(database.DB)
				modelEntity, err := modelRepo.FindByIDAndUser(modelID, req.UserID)
				if err == nil && modelEntity != nil && modelEntity.Params.Data != nil {
					if paramsMap, ok := modelEntity.Params.Data.(map[string]interface{}); ok {
						if s, ok := paramsMap["stream"].(bool); ok {
							log.Printf("[流式调试-后端] 节点 %s 从模型配置读取 stream=%v", node.ID, s)
							return s
						}
					}
				}
			}
		}

		// 根据provider的默认行为判断
		// 豆包默认开启流式
		if modelConfig != nil && modelConfig.Provider == "doubao" {
			log.Printf("[流式调试-后端] 节点 %s 是豆包provider，默认开启流式", node.ID)
			return true
		}

		// 其他provider默认不开启流式
		log.Printf("[流式调试-后端] 节点 %s provider=%s，默认不开启流式", node.ID, func() string {
			if modelConfig != nil {
				return modelConfig.Provider
			}
			return "unknown"
		}())
		return false
	}

	// 创建数据流和变量上下文
	dataFlow := NewDataFlow(req.Edges)
	variableContext := NewVariableContext()
	execMeta := ExecutionMeta{
		UserID: req.UserID,
	}
	if req.WorkflowID > 0 {
		wid := req.WorkflowID
		execMeta.WorkflowID = &wid
	}
	if task != nil && task.ID > 0 {
		tid := task.ID
		execMeta.TaskID = &tid
	}

	// 保存节点执行记录的辅助函数
	saveNodeExecution := func(nodeID string, nodeType string, result NodeExecutionResult, executionTime int64) {
		if task.ID == 0 {
			return // 任务未创建成功，跳过
		}

		// 重新获取任务状态，检查是否已被取消
		updatedTask, err := taskRepo.GetTaskByID(task.ID)
		isCancelled := false
		if err == nil && updatedTask != nil {
			isCancelled = updatedTask.Status == "cancelled" && updatedTask.CancelledBy != nil
		}

		nodeStartTime := time.Now().Add(-time.Duration(executionTime) * time.Millisecond)
		nodeCompletedTime := time.Now()

		status := "completed"
		if !result.Success {
			// 检查错误信息是否包含 context canceled（手动中止的标志）
			isContextCanceled := false
			if result.Error != "" {
				errorLower := strings.ToLower(result.Error)
				isContextCanceled = strings.Contains(errorLower, "context canceled") ||
					strings.Contains(errorLower, "context cancelled")
			}

			// 如果任务已被手动中止，或者错误是 context canceled，节点应该标记为 cancelled 而不是 failed
			if isCancelled || isContextCanceled {
				status = "cancelled"
			} else {
				status = "failed"
			}
		}

		// 将输入输出数据转换为 JSONB
		var inputData *shared.JSONB
		var outputData *shared.JSONB
		if nodeInput, err := dataFlow.GetNodeInputData(nodeID); err == nil && nodeInput != nil && nodeInput.Payload != nil {
			inputData = jsonbFromPayload(nodeInput.Payload)
		}
		if result.Data != nil {
			outputData = jsonbFromPayload(result.Data)
		}

		if outputData != nil {
			if _, isStartNode := startNodeIDs[nodeID]; isStartNode && task.InputData == nil {
				if len(startNodeIDs) == 1 {
					task.InputData = outputData
				} else {
					task.InputData = jsonbFromPayload(map[string]interface{}{nodeID: outputData.Data})
				}
			} else if _, isStartNode := startNodeIDs[nodeID]; isStartNode && len(startNodeIDs) > 1 {
				if current, ok := task.InputData.Data.(map[string]interface{}); ok {
					current[nodeID] = outputData.Data
				} else {
					task.InputData = jsonbFromPayload(map[string]interface{}{nodeID: outputData.Data})
				}
			}
		}

		// 将 int64 转换为 int
		execTimeInt := int(executionTime)

		// 检查是否已存在记录（可能是 running 状态）
		existingExecution, err := nodeExecutionRepo.GetByTaskIDAndNodeID(task.ID, nodeID)
		if err == nil && existingExecution != nil {
			// 更新已存在的记录
			existingExecution.Status = status
			existingExecution.InputData = inputData
			existingExecution.OutputData = outputData
			existingExecution.ExecutionTime = &execTimeInt
			existingExecution.CompletedAt = &nodeCompletedTime

			applyExecutionFailure(existingExecution, status, result)

			if err := nodeExecutionRepo.Update(existingExecution); err != nil {
				log.Printf("更新节点执行记录失败: %v", err)
			}
		} else {
			// 创建新记录
			execution := &taskModels.TaskNodeExecution{
				TaskID:        task.ID,
				NodeID:        nodeID,
				NodeType:      nodeType,
				Status:        status,
				InputData:     inputData,
				OutputData:    outputData,
				ExecutionTime: &execTimeInt,
				RetryCount:    0,
				StartedAt:     &nodeStartTime,
				CompletedAt:   &nodeCompletedTime,
				CreatedAt:     time.Now(),
			}

			applyExecutionFailure(execution, status, result)

			if err := nodeExecutionRepo.Create(execution); err != nil {
				log.Printf("保存节点执行记录失败: %v", err)
			}
		}
	}

	// 执行上游节点（如果有）
	executed := make(map[string]bool)

	// 跟踪当前正在执行的节点ID（用于取消时更新状态）
	var currentExecutingNodeID string

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
		nodeStartTime := time.Now()
		result := e.executeNodeSafely(*nodeConfig, dataFlow, variableContext, execMeta)
		executionTime := time.Since(nodeStartTime).Milliseconds()

		// 保存节点执行记录
		saveNodeExecution(nodeConfig.ID, nodeConfig.Type, result, executionTime)

		// 清除当前执行节点标记
		currentExecutingNodeID = ""

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
	queue := make([]string, 0)
	for _, node := range startNodes {
		queue = append(queue, node.ID)
	}

	cancelTaskExecution := func(cancelledBy *uint) error {
		if task.ID == 0 {
			return context.Canceled
		}

		cancelledAt := time.Now()
		actualDuration := int(time.Since(taskStartTime).Milliseconds())

		task.Status = "cancelled"
		task.CancelledAt = &cancelledAt
		task.CancelledBy = cancelledBy
		task.ActualDuration = &actualDuration
		task.UpdatedAt = time.Now()

		executedCount := 0
		for _, exec := range executed {
			if exec {
				executedCount++
			}
		}
		if len(req.Nodes) > 0 {
			task.Progress = int(float64(executedCount) / float64(len(req.Nodes)) * 100)
		}

		if err := taskRepo.UpdateTask(task); err != nil {
			log.Printf("update cancelled task failed: %v", err)
		}

		executions, err := nodeExecutionRepo.GetByTaskID(task.ID)
		if err == nil {
			for i := range executions {
				if executions[i].Status == "running" ||
					executions[i].Status == "pending" ||
					(executions[i].Status == "failed" && executions[i].NodeID == currentExecutingNodeID) {
					executions[i].Status = "cancelled"
					completedAt := time.Now()
					executions[i].CompletedAt = &completedAt
					if err := nodeExecutionRepo.Update(&executions[i]); err != nil {
						log.Printf("update cancelled node execution failed: %v", err)
					}
				}
			}
		}

		for _, node := range req.Nodes {
			if !executed[node.ID] {
				existingExecutions, err := nodeExecutionRepo.GetByTaskID(task.ID)
				exists := false
				if err == nil {
					for _, exec := range existingExecutions {
						if exec.NodeID == node.ID {
							exists = true
							break
						}
					}
				}

				if !exists {
					pendingExecution := &taskModels.TaskNodeExecution{
						TaskID:     task.ID,
						NodeID:     node.ID,
						NodeType:   node.Type,
						Status:     "pending",
						RetryCount: 0,
						CreatedAt:  time.Now(),
					}
					if err := nodeExecutionRepo.Create(pendingExecution); err != nil {
						log.Printf("create pending node execution failed: %v", err)
					}
				}
			}
		}

		return context.Canceled
	}

	// 执行所有节点
	for len(queue) > 0 {
		// 检查上下文是否已取消（手动中止）
		select {
		case <-ctx.Done():
			// 上下文被取消，更新任务状态为已取消
			if task.ID > 0 {
				cancelledAt := time.Now()
				actualDuration := int(time.Since(taskStartTime).Milliseconds())

				task.Status = "cancelled"
				task.CancelledAt = &cancelledAt
				task.CancelledBy = &req.UserID
				task.ActualDuration = &actualDuration
				task.UpdatedAt = time.Now()

				// 计算进度（已执行节点数 / 总节点数）
				executedCount := 0
				for _, exec := range executed {
					if exec {
						executedCount++
					}
				}
				if len(req.Nodes) > 0 {
					task.Progress = int(float64(executedCount) / float64(len(req.Nodes)) * 100)
				}

				if err := taskRepo.UpdateTask(task); err != nil {
					log.Printf("更新任务状态为已取消失败: %v", err)
				}

				// 更新所有正在执行的节点状态为 cancelled
				// 无论节点状态是 running 还是 failed，都应该更新为 cancelled（因为是手动中止）
				executions, err := nodeExecutionRepo.GetByTaskID(task.ID)
				if err == nil {
					for i := range executions {
						// 如果节点状态是 running 或 failed，都更新为 cancelled
						// 特别处理当前正在执行的节点，或者所有 running 状态的节点
						if executions[i].Status == "running" ||
							(executions[i].Status == "failed" && executions[i].NodeID == currentExecutingNodeID) {
							executions[i].Status = "cancelled"
							cancelledAt := time.Now()
							executions[i].CompletedAt = &cancelledAt
							if err := nodeExecutionRepo.Update(&executions[i]); err != nil {
								log.Printf("更新节点执行状态为已取消失败: %v", err)
							}
						}
					}
				}

				// 为未执行的节点创建 pending 状态的记录
				for _, node := range req.Nodes {
					if !executed[node.ID] {
						// 检查是否已经存在记录
						executions, err := nodeExecutionRepo.GetByTaskID(task.ID)
						exists := false
						if err == nil {
							for _, exec := range executions {
								if exec.NodeID == node.ID {
									exists = true
									break
								}
							}
						}

						if !exists {
							// 创建 pending 状态的记录
							pendingExecution := &taskModels.TaskNodeExecution{
								TaskID:     task.ID,
								NodeID:     node.ID,
								NodeType:   node.Type,
								Status:     "pending",
								RetryCount: 0,
								CreatedAt:  time.Now(),
							}
							if err := nodeExecutionRepo.Create(pendingExecution); err != nil {
								log.Printf("创建未执行节点记录失败: %v", err)
							}
						}
					}
				}

				log.Printf("任务被手动中止，用户ID: %d", req.UserID)
			}

			// 返回取消错误
			return ctx.Err()
		default:
			// 继续执行
		}

		if task.ID > 0 {
			updatedTask, err := taskRepo.GetTaskByID(task.ID)
			if err == nil && updatedTask != nil && updatedTask.Status == "cancelled" && updatedTask.CancelledBy != nil {
				task.Status = updatedTask.Status
				task.CancelledAt = updatedTask.CancelledAt
				task.CancelledBy = updatedTask.CancelledBy
				task.UpdatedAt = updatedTask.UpdatedAt
				task.ActualDuration = updatedTask.ActualDuration
				return cancelTaskExecution(updatedTask.CancelledBy)
			}
		}

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

		// 标记当前正在执行的节点
		currentExecutingNodeID = nodeConfig.ID

		// 在执行前创建 running 状态的记录（如果还没有）
		if task.ID > 0 {
			executions, err := nodeExecutionRepo.GetByTaskID(task.ID)
			nodeExists := false
			if err == nil {
				for i := range executions {
					if executions[i].NodeID == nodeConfig.ID {
						nodeExists = true
						// 如果状态是 pending，更新为 running
						if executions[i].Status == "pending" {
							executions[i].Status = "running"
							now := time.Now()
							executions[i].StartedAt = &now
							if err := nodeExecutionRepo.Update(&executions[i]); err != nil {
								log.Printf("更新节点状态为运行中失败: %v", err)
							}
						}
						break
					}
				}
			}
			// 如果节点记录不存在，创建 running 状态的记录
			if !nodeExists {
				now := time.Now()
				runningExecution := &taskModels.TaskNodeExecution{
					TaskID:     task.ID,
					NodeID:     nodeConfig.ID,
					NodeType:   nodeConfig.Type,
					Status:     "running",
					RetryCount: 0,
					StartedAt:  &now,
					CreatedAt:  now,
				}
				if err := nodeExecutionRepo.Create(runningExecution); err != nil {
					log.Printf("创建节点运行记录失败: %v", err)
				}
			}
		}

		// 如果是AI节点，检查是否启用流式输出
		if nodeConfig.Type == "ai" {
			// 获取模型配置以判断是否启用流式
			// 如果 modelMode 为空字符串，也使用默认值 "system"（确保测试工作流时能正确计费）
			modelMode := getString(nodeConfig.Config, "modelMode", "system")
			if modelMode == "" {
				modelMode = "system"
			}
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
				log.Printf("[流式调试-后端] 节点 %s 开始检查流式配置, provider=%s, modelName=%s",
					nodeConfig.ID, modelConfig.Provider, modelConfig.ModelName)
				shouldUseStream = checkStreamEnabled(*nodeConfig, modelConfig)
				log.Printf("[流式调试-后端] 节点 %s 流式检查结果: shouldUseStream=%v", nodeConfig.ID, shouldUseStream)
			} else {
				log.Printf("[流式调试-后端] 节点 %s 无法检查流式配置: err=%v, modelConfig=%v",
					nodeConfig.ID, err, modelConfig != nil)
			}

			if shouldUseStream {
				log.Printf("[流式调试-后端] 节点 %s 使用流式执行", nodeConfig.ID)
				// 使用流式执行AI节点（包含完整计费逻辑）
				nodeStartTime := time.Now()
				var streamSuccess bool
				var streamError error

				originalCallback := callback
				wrappedCallback := func(nodeID string, content string, done bool, contentType string, err error) {
					// 记录执行结果
					if done {
						streamSuccess = err == nil
						streamError = err
					}
					// 调用原始callback
					originalCallback(nodeID, content, done, contentType, err)
				}

				e.ExecuteAINodeStream(ctx, *nodeConfig, dataFlow, variableContext, req.UserID, wrappedCallback)

				// 计算执行时间并保存节点记录
				executionTime := time.Since(nodeStartTime).Milliseconds()

				// 从 dataFlow 获取输出数据
				outputData := dataFlow.GetNodeOutput(nodeConfig.ID)

				// 构建执行结果
				result := NodeExecutionResult{
					NodeID:  nodeConfig.ID,
					Type:    nodeConfig.Type,
					Success: streamSuccess,
					Data:    nil,
				}

				if outputData != nil && outputData.Payload != nil {
					result.Data = outputData.Payload
				}

				if streamError != nil {
					result.Error = streamError.Error()
					result.ErrorStack = currentErrorStack()
				}

				// 保存节点执行记录
				saveNodeExecution(nodeConfig.ID, nodeConfig.Type, result, executionTime)

				// 标记AI节点为已执行（无论成功或失败）
				// 清除当前执行节点标记
				currentExecutingNodeID = ""

				executed[nodeConfig.ID] = true

				// 继续执行下游节点（无论AI节点成功或失败）
				// 注意：这里不continue，让代码继续执行到"找到下一个节点"的逻辑
			} else {
				log.Printf("[流式调试-后端] 节点 %s 使用非流式执行", nodeConfig.ID)
				// 非流式AI节点，使用普通执行（包含计费逻辑）
				nodeStartTime := time.Now()
				result := e.executeNodeSafely(*nodeConfig, dataFlow, variableContext, execMeta)
				executionTime := time.Since(nodeStartTime).Milliseconds()

				// 保存节点执行记录
				saveNodeExecution(nodeConfig.ID, nodeConfig.Type, result, executionTime)

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
				// 清除当前执行节点标记
				currentExecutingNodeID = ""

				// 清除当前执行节点标记
				currentExecutingNodeID = ""

				executed[nodeConfig.ID] = true
			}
		} else {
			// 普通节点或非流式AI节点，使用普通执行
			nodeStartTime := time.Now()
			result := e.executeNodeSafely(*nodeConfig, dataFlow, variableContext, execMeta)
			executionTime := time.Since(nodeStartTime).Milliseconds()

			// 保存节点执行记录
			saveNodeExecution(nodeConfig.ID, nodeConfig.Type, result, executionTime)

			// 清除当前执行节点标记
			currentExecutingNodeID = ""

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

	// 更新任务状态为完成
	if task.ID > 0 {
		completedAt := time.Now()
		actualDuration := int(time.Since(taskStartTime).Milliseconds())

		task.Status = "completed"
		task.Progress = 100
		task.CompletedAt = &completedAt
		task.ActualDuration = &actualDuration
		task.Result = collectTaskResultPayload(dataFlow, terminalNodes)
		task.UpdatedAt = time.Now()

		if err := taskRepo.UpdateTask(task); err != nil {
			log.Printf("更新任务状态失败: %v", err)
		}

		// 站内通知：工作流执行完成
		var workflow workflowModels.Workflow
		if err := database.DB.Select("name", "project_id").Where("id = ?", task.WorkflowID).First(&workflow).Error; err == nil {
			title := "工作流执行完成"
			content := "工作流「" + workflow.Name + "」已执行完成，点击查看结果。"
			actionURL := ""
			if workflow.ProjectID != nil && *workflow.ProjectID > 0 {
				actionURL = fmt.Sprintf("/projects/%d/workflows/%d/edit", *workflow.ProjectID, task.WorkflowID)
			}
			notification.Notify(task.UserID, "task_completed", title, content, actionURL)
		} else {
			notification.Notify(task.UserID, "task_completed", "工作流执行完成", "任务已执行完成，点击查看结果。", "")
		}
	}

	return nil
}
