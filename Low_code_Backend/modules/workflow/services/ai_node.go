package services

import (
	"context"
	"fmt"
	"log"
	"strings"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/database"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
	userModels "yaolight-workshop/backend/modules/user/models"
)

// executeAINode 执行AI节点
func (e *WorkflowExecutor) executeAINode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext, userID uint) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
	}

	// 获取提示词配置
	prompt := getString(node.Config, "prompt", "")
	if prompt == "" {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "ai",
			Success: false,
			Error:   "提示词不能为空",
			Data:    ExtractPayload(inputData),
		}
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
		// 如果没有配置变量，尝试从输入数据获取
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

	// 获取模型配置
	modelRepo := aiRepos.NewAIModelRepository(database.DB)
	modelConfig, err := aiService.GetModelConfigForExecution(
		modelMode,
		getUint(node.Config, "modelId", 0),
		userID,
		node.Config,
		modelRepo,
	)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "ai",
			Success: false,
			Error:   fmt.Sprintf("加载模型配置失败: %v", err),
			Data:    ExtractPayload(inputData),
		}
	}

	// 获取提供商
	provider, err := e.aiService.GetProvider(modelConfig.Provider)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "ai",
			Success: false,
			Error:   fmt.Sprintf("获取AI提供商失败: %v", err),
			Data:    ExtractPayload(inputData),
		}
	}

	// 构建提供商特定配置（DeepSeek特有参数）
	providerConfig := make(map[string]interface{})
	stream := false
	var billingModelID *uint

	// **计费逻辑说明**：
	// - system模式：使用系统API Key，需要扣费和扣除token余额（系统需要向服务商付费）
	// - saved模式：使用用户自己的API Key，不扣费不扣token（用户自己向服务商付费，只记录使用量）
	// - custom模式：使用临时API Key，不扣费不扣token（用户自己向服务商付费，只记录使用量）
	// 费用计算现在使用 PricingService 从数据库读取计费配置

	// 如果使用已保存的模型，从模型配置读取默认值（但不用于计费，因为用的是用户自己的API Key）
	if modelMode == "saved" {
		modelID := getUint(node.Config, "modelId", 0)
		if modelID > 0 {
			billingModelID = &modelID
		}
		modelRepo := aiRepos.NewAIModelRepository(database.DB)
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
		log.Printf("[流式调试-后端] ai_node.go 节点 %s 是豆包provider", node.ID)
		// 豆包使用 thinkingLevel 字符串（minimal/low/medium/high）
		if thinkingLevel, ok := node.Config["thinkingLevel"].(string); ok && thinkingLevel != "" {
			providerConfig["thinkingLevel"] = thinkingLevel
			log.Printf("[流式调试-后端] ai_node.go 节点 %s thinkingLevel=%s (从节点配置读取)", node.ID, thinkingLevel)
		} else {
			// 如果没有指定，使用默认值 medium
			providerConfig["thinkingLevel"] = "medium"
			log.Printf("[流式调试-后端] ai_node.go 节点 %s thinkingLevel=medium (使用默认值)", node.ID)
		}
		// 豆包默认开启流式（因为豆包默认开启思考，会返回思考内容）
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
			log.Printf("[流式调试-后端] ai_node.go 节点 %s stream=%v (从节点配置读取)", node.ID, s)
		} else {
			// 如果节点配置没有指定，豆包默认使用流式
			stream = true
			providerConfig["stream"] = true
			log.Printf("[流式调试-后端] ai_node.go 节点 %s stream=true (豆包默认值)", node.ID)
		}
	} else if modelConfig.Provider == "qwen" {
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
			providerConfig["stream"] = false
		}
	} else if modelConfig.Provider == "claude" || modelConfig.Provider == "gemini" || modelConfig.Provider == "grok" || modelConfig.Provider == "gpt" {
		// Claude/Gemini/Grok/GPT (via OpenRouter)
		// OpenRouter 使用 reasoning 参数（对象格式）
		log.Printf("[流式调试-后端] ai_node.go 节点 %s 是Claude/Gemini/Grok/GPT provider", node.ID)
		log.Printf("[流式调试-后端] ai_node.go 节点 %s 节点配置中的reasoning: %v, thinking: %v", node.ID, node.Config["reasoning"], node.Config["thinking"])

		// 优先检查 reasoning 参数（前端可能直接发送这个）
		if reasoning, ok := node.Config["reasoning"].(bool); ok {
			if reasoning {
				reasoningConfig := map[string]interface{}{
					"enabled": true,
				}
				// 如果有 reasoning_effort，添加到配置中
				if effort, ok := node.Config["reasoning_effort"].(string); ok && effort != "" {
					reasoningConfig["effort"] = effort
				}
				providerConfig["reasoning"] = reasoningConfig
				log.Printf("[流式调试-后端] ai_node.go 节点 %s 启用推理 (从reasoning参数), reasoning=%+v", node.ID, reasoningConfig)
			} else {
				log.Printf("[流式调试-后端] ai_node.go 节点 %s reasoning=false, 不添加reasoning参数", node.ID)
			}
		} else if reasoningMap, ok := node.Config["reasoning"].(map[string]interface{}); ok {
			// 如果前端传递的是对象，直接使用
			providerConfig["reasoning"] = reasoningMap
			log.Printf("[流式调试-后端] ai_node.go 节点 %s 使用推理配置对象, reasoning=%+v", node.ID, reasoningMap)
		} else if thinking, ok := node.Config["thinking"].(bool); ok {
			// 兼容 thinking 参数（前端可能发送这个）
			if thinking {
				reasoningConfig := map[string]interface{}{
					"enabled": true,
				}
				// 如果有 reasoning_effort，添加到配置中
				if effort, ok := node.Config["reasoning_effort"].(string); ok && effort != "" {
					reasoningConfig["effort"] = effort
				}
				providerConfig["reasoning"] = reasoningConfig
				log.Printf("[流式调试-后端] ai_node.go 节点 %s 启用推理 (从thinking参数), reasoning=%+v", node.ID, reasoningConfig)
			} else {
				log.Printf("[流式调试-后端] ai_node.go 节点 %s thinking=false, 不添加reasoning参数", node.ID)
			}
		} else {
			log.Printf("[流式调试-后端] ai_node.go 节点 %s 未找到reasoning或thinking参数", node.ID)
		}

		// 检查 reasoning_effort 参数（如果reasoning已存在但需要更新effort）
		if reasoningVal, exists := providerConfig["reasoning"]; exists {
			if reasoningMap, ok := reasoningVal.(map[string]interface{}); ok {
				if effort, ok := node.Config["reasoning_effort"].(string); ok && effort != "" {
					reasoningMap["effort"] = effort
					log.Printf("[流式调试-后端] ai_node.go 节点 %s 更新 reasoning_effort=%s", node.ID, effort)
				}
			}
		}
		// 检查 frequency_penalty 和 presence_penalty
		if fp, ok := node.Config["frequencyPenalty"].(float64); ok {
			providerConfig["frequencyPenalty"] = fp
		}
		if pp, ok := node.Config["presencePenalty"].(float64); ok {
			providerConfig["presencePenalty"] = pp
		}

		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			stream = false
			providerConfig["stream"] = false
		}
	} else if modelConfig.Provider == "spark" {
		log.Printf("[流式调试-后端] ai_node.go 节点 %s 是讯飞星火provider", node.ID)
		log.Printf("[流式调试-后端] ai_node.go 节点 %s 节点配置中的thinkingType: %v", node.ID, node.Config["thinkingType"])
		if thinkingType, ok := node.Config["thinkingType"].(string); ok && thinkingType != "" {
			providerConfig["thinkingType"] = thinkingType
			log.Printf("[流式调试-后端] ai_node.go 节点 %s thinkingType=%s (从节点配置读取)", node.ID, thinkingType)
		} else if thinkingType, exists := providerConfig["thinkingType"].(string); exists {
			// 从模型配置中读取（saved 模式）
			log.Printf("[流式调试-后端] ai_node.go 节点 %s thinkingType=%s (从模型配置读取)", node.ID, thinkingType)
		} else {
			// 如果没有指定，使用默认值 "auto"（让模型自动判断）
			providerConfig["thinkingType"] = "auto"
			log.Printf("[流式调试-后端] ai_node.go 节点 %s thinkingType=auto (默认值)", node.ID)
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

	// 如果启用流式输出，使用流式方法（但需要等待完成）
	if stream {
		var fullContent strings.Builder
		var fullReasoningContent strings.Builder
		var tokenDeducted bool

		// 非流式执行路径，使用 Background context（不需要取消功能）
		// 注意：ChatStream 的回调函数签名是 func(content string, done bool, err error, usage *TokenUsage)
		err := provider.ChatStream(context.Background(), modelConfig, prompt, content, providerConfig, func(deltaContent string, done bool, err error, usage *providers.TokenUsage) {
			if err != nil {
				return
			}

			// **计费逻辑**：只有system模式才扣费和扣除token余额
			// saved和custom模式使用用户自己的API Key，不扣费不扣token，只记录使用量
			if done && usage != nil && !tokenDeducted {
				tokenDeducted = true

				// 只有system模式需要扣费和扣除token余额
				if modelMode == "system" {
					// 使用 PricingService 计算等效Token数（星尘消耗）
					// 以DeepSeek为基准，其他模型按价格倍数计算等效Token
					equivalentTokens, err := e.pricingService.CalculateEquivalentTokens(usage, modelConfig.Provider, modelConfig.ModelName)
					if err != nil {
						log.Printf("Failed to calculate equivalent tokens: %v, using actual tokens", err)
						equivalentTokens = int64(usage.TotalTokens)
					}

					// 扣除用户星尘余额（等效Token数）
					deductErr := database.DB.Model(&userModels.User{}).
						Where("id = ?", userID).
						Update("token_balance", gorm.Expr("token_balance - ?", equivalentTokens)).Error
					if deductErr != nil {
						log.Printf("Token deduction failed for user %d: %v", userID, deductErr)
					} else {
						log.Printf("Deducted %d stardust (equivalent tokens) for user %d, actual tokens: %d (Stream Mode in executeAINode, system model)",
							equivalentTokens, userID, usage.TotalTokens)
					}

					// 计算费用（仅用于记录）
					cost, err := e.pricingService.CalculateCost(usage, modelConfig.Provider, modelConfig.ModelName)
					if err != nil {
						log.Printf("Failed to calculate cost: %v", err)
						cost = 0
					}
					// 从数据库获取货币单位（USD或CNY）
					currency := e.pricingService.GetCurrency(modelConfig.Provider, modelConfig.ModelName)

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

					// 创建计费记录
					transaction := userModels.TokenTransaction{
						UserID:           userID,
						Amount:           -equivalentTokens, // 扣除等效Token数（星尘）
						Type:             "consumption",
						RelatedID:        node.ID,
						Description:      "AI节点消耗（系统预设模型）",
						Provider:         modelConfig.Provider,
						ModelName:        modelConfig.ModelName,
						ModelMode:        modelMode,
						ModelID:          billingModelID,
						PromptTokens:     usage.PromptTokens,
						CompletionTokens: usage.CompletionTokens,
						TotalTokens:      usage.TotalTokens, // 实际Token数用于记录
						CacheReadTokens:  cacheRead,
						CacheWriteTokens: cacheWrite,
						AudioTokens:      audio,
						Cost:             cost, // 费用仅用于记录
						Currency:         currency,
					}
					if createErr := database.DB.Create(&transaction).Error; createErr != nil {
						log.Printf("Create token transaction failed for user %d: %v", userID, createErr)
					}
				} else {
					// saved或custom模式：使用用户自己的API Key，只记录使用量，不扣费不扣token
					log.Printf("Recording usage (no billing, user's own API Key): userID=%d, mode=%s, provider=%s, totalTokens=%d",
						userID, modelMode, modelConfig.Provider, usage.TotalTokens)

					transaction := userModels.TokenTransaction{
						UserID:           userID,
						Amount:           0,              // 不扣除token余额
						Type:             "usage_record", // 仅记录使用量
						RelatedID:        node.ID,
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
						log.Printf("Create usage record failed for user %d: %v", userID, createErr)
					}
				}
			}

			if deltaContent != "" {
				// 解析内容类型标记
				if strings.HasPrefix(deltaContent, "[REASONING_DELTA]") {
					// 思考内容增量
					reasoningDelta := strings.TrimPrefix(deltaContent, "[REASONING_DELTA]")
					fullReasoningContent.WriteString(reasoningDelta)
				} else if strings.HasPrefix(deltaContent, "[CONTENT_DELTA]") {
					// 正式内容增量
					contentDelta := strings.TrimPrefix(deltaContent, "[CONTENT_DELTA]")
					fullContent.WriteString(contentDelta)
				} else {
					// 没有标记，向后兼容
					fullContent.WriteString(deltaContent)
				}
			}
		})
		if err != nil {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "ai",
				Success: false,
				Error:   fmt.Sprintf("AI流式调用失败: %v", err),
				Data:    ExtractPayload(inputData),
			}
		}

		// 流式完成，返回完整内容
		tokensUsed := 0
		if tokenDeducted {
			// 如果已经扣费，可以尝试从数据库获取token使用量
			// 但为了简化，这里设为0，因为实际token数已经在计费记录中
		}

		resultData := map[string]interface{}{
			"result":            fullContent.String(),
			"content":           fullContent.String(),
			"reasoningContent":  fullReasoningContent.String(),
			"reasoning_details": fullReasoningContent.String(), // 兼容 reasoning_details
			"tokensUsed":        tokensUsed,
			"model":             modelConfig.ModelName,
		}
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "ai",
			Success: true,
			Data:    resultData,
		}
	}

	// 调用AI服务（非流式）
	chatResp, err := provider.Chat(modelConfig, prompt, content, providerConfig)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "ai",
			Success: false,
			Error:   fmt.Sprintf("AI调用失败: %v", err),
			Data:    ExtractPayload(inputData),
		}
	}

	// **计费逻辑**：只有system模式才扣费和扣除token余额
	// saved和custom模式使用用户自己的API Key，不扣费不扣token，只记录使用量
	if chatResp.TokensUsed > 0 || (chatResp.Usage != nil && chatResp.Usage.TotalTokens > 0) {
		// 优先使用详细的 Usage 信息
		usage := chatResp.Usage
		if usage == nil {
			usage = &providers.TokenUsage{
				TotalTokens: chatResp.TokensUsed,
			}
		}

		// 只有system模式需要扣费和扣除token余额
		if modelMode == "system" {
			// 使用 PricingService 计算等效Token数（星尘消耗）
			equivalentTokens, err := e.pricingService.CalculateEquivalentTokens(usage, modelConfig.Provider, modelConfig.ModelName)
			if err != nil {
				log.Printf("Failed to calculate equivalent tokens: %v, using actual tokens", err)
				equivalentTokens = int64(usage.TotalTokens)
			}

			// 扣除用户星尘余额（等效Token数）
			deductErr := database.DB.Model(&userModels.User{}).
				Where("id = ?", userID).
				Update("token_balance", gorm.Expr("token_balance - ?", equivalentTokens)).Error
			if deductErr != nil {
				log.Printf("Token deduction failed for user %d: %v", userID, deductErr)
			} else {
				log.Printf("Deducted %d stardust (equivalent tokens) for user %d, actual tokens: %d (Non-Stream Mode, system model)",
					equivalentTokens, userID, usage.TotalTokens)
			}

			// 计算费用（仅用于记录）
			cost, err := e.pricingService.CalculateCost(usage, modelConfig.Provider, modelConfig.ModelName)
			if err != nil {
				log.Printf("Failed to calculate cost: %v", err)
				cost = 0
			}
			// 从数据库获取货币单位（USD或CNY）
			currency := e.pricingService.GetCurrency(modelConfig.Provider, modelConfig.ModelName)

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

			// 创建计费记录
			transaction := userModels.TokenTransaction{
				UserID:           userID,
				Amount:           -equivalentTokens, // 扣除等效Token数（星尘）
				Type:             "consumption",
				RelatedID:        node.ID,
				Description:      "AI节点消耗（系统预设模型）",
				Provider:         modelConfig.Provider,
				ModelName:        modelConfig.ModelName,
				ModelMode:        modelMode,
				ModelID:          billingModelID,
				PromptTokens:     usage.PromptTokens,
				CompletionTokens: usage.CompletionTokens,
				TotalTokens:      usage.TotalTokens, // 实际Token数用于记录
				CacheReadTokens:  cacheRead,
				CacheWriteTokens: cacheWrite,
				AudioTokens:      audio,
				Cost:             cost, // 费用仅用于记录
				Currency:         currency,
			}
			if createErr := database.DB.Create(&transaction).Error; createErr != nil {
				log.Printf("Create token transaction failed for user %d: %v", userID, createErr)
			}
		} else {
			// saved或custom模式：使用用户自己的API Key，只记录使用量，不扣费不扣token
			log.Printf("Recording usage (no billing, user's own API Key): userID=%d, mode=%s, provider=%s, totalTokens=%d",
				userID, modelMode, modelConfig.Provider, usage.TotalTokens)

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
				RelatedID:        node.ID,
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
				log.Printf("Create usage record failed for user %d: %v", userID, createErr)
			}
		}
	}

	// 返回结果
	resultData := map[string]interface{}{
		"result":            chatResp.Content, // AI节点的输出变量名是 result
		"content":           chatResp.Content, // 保留 content 以兼容旧代码
		"tokensUsed":        chatResp.TokensUsed,
		"model":             chatResp.Model,
		"reasoning_details": chatResp.ReasoningDetails, // 包含推理详情
	}
	if chatResp.ReasoningDetails != nil {
		resultData["reasoningContent"] = chatResp.ReasoningDetails
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "ai",
		Success: true,
		Data:    resultData,
	}
}
