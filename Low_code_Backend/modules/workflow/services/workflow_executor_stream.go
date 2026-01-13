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
)

// StreamCallback 流式执行回调函数
// contentType: "reasoning" 表示思考内容, "content" 表示正式内容, "" 表示未指定（向后兼容）
type StreamCallback func(nodeID string, content string, done bool, contentType string, err error)

// ExecuteAINodeStream 流式执行AI节点
func (e *WorkflowExecutor) ExecuteAINodeStream(
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
		log.Printf("AI节点获取输入数据失败: %v", err)
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

	// 如果使用已保存的模型，先从模型配置读取默认值
	if modelMode == "saved" {
		modelEntity, err := modelRepo.FindByIDAndUser(getUint(node.Config, "modelId", 0), userID)
		if err == nil && modelEntity != nil {
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
	if modelConfig.Provider == "deepseek" {
		// 从节点配置中读取DeepSeek特有参数（覆盖模型默认值）
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
	}

	// 如果启用流式输出，使用流式方法
	if stream {
		log.Printf("流式执行: AI节点 %s 启用流式输出，准备调用 ChatStream", nodeID)
		var fullContent strings.Builder
		var fullReasoningContent strings.Builder
		// 创建适配器，将 providers.StreamCallback 转换为 services.StreamCallback
		providerCallback := func(deltaContent string, done bool, err error) {
			log.Printf("流式执行: AI节点 %s 收到回调，deltaContent长度: %d, done: %v, err: %v", nodeID, len(deltaContent), done, err)
			if err != nil {
				log.Printf("流式执行: AI节点 %s 回调错误: %v", nodeID, err)
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
				log.Printf("流式执行: AI节点 %s 完成，保存输出数据（思考内容长度: %d, 正式内容长度: %d）", nodeID, len(finalReasoningContent), len(finalContent))

				// 发送完成信号（不发送内容，只标记 done=true，避免重复）
				// 内容已经在增量消息中发送完毕
				callback(nodeID, "", true, "", nil)
			}
		}
		log.Printf("流式执行: AI节点 %s 调用 ChatStream，prompt长度: %d, content长度: %d", nodeID, len(prompt), len(content))
		err := provider.ChatStream(modelConfig, prompt, content, providerConfig, providerCallback)
		if err != nil {
			log.Printf("流式执行: AI节点 %s ChatStream 返回错误: %v", nodeID, err)
			callback(nodeID, "", true, "", err)
		} else {
			log.Printf("流式执行: AI节点 %s ChatStream 完成（无错误）", nodeID)
		}
	} else {
		// 非流式输出
		chatResp, err := provider.Chat(modelConfig, prompt, content, providerConfig)
		if err != nil {
			callback(nodeID, "", true, "", fmt.Errorf("AI调用失败: %v", err))
			return
		}

		// 保存AI节点的输出数据到数据流和变量上下文
		resultData := map[string]interface{}{
			"result":     chatResp.Content, // AI节点的输出变量名是 result
			"content":    chatResp.Content, // 保留 content 以兼容旧代码
			"tokensUsed": chatResp.TokensUsed,
			"model":      chatResp.Model, // ChatResponse 中是 Model
		}
		nodeData := NewNodeData(resultData)
		dataFlow.SetNodeOutput(nodeID, nodeData)
		variableContext.SetNodeOutput(nodeID, nodeData)
		log.Printf("非流式执行: AI节点 %s 完成，保存输出数据", nodeID)

		callback(nodeID, chatResp.Content, true, "", nil)
	}
}

// ExecuteWorkflowStream 流式执行工作流（支持所有节点类型）
func (e *WorkflowExecutor) ExecuteWorkflowStream(
	ctx context.Context,
	req ExecutionRequest,
	callback StreamCallback,
) error {
	log.Printf("流式执行: 开始执行工作流，节点数: %d, 边数: %d", len(req.Nodes), len(req.Edges))

	if len(req.Nodes) == 0 {
		return fmt.Errorf("工作流节点为空")
	}

	// 检查是否有AI节点启用了流式输出
	var aiNode *NodeConfig
	var hasStreamingAI bool
	for i := range req.Nodes {
		if req.Nodes[i].Type == "ai" {
			aiNode = &req.Nodes[i]
			// 检查是否启用了流式输出
			if stream, ok := aiNode.Config["stream"].(bool); ok && stream {
				hasStreamingAI = true
				log.Printf("流式执行: 找到流式AI节点 %s", aiNode.ID)
				break
			}
		}
	}

	// 创建数据流和变量上下文
	dataFlow := NewDataFlow(req.Edges)
	variableContext := NewVariableContext()

	// 执行上游节点（如果有）
	executed := make(map[string]bool)

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
			log.Printf("未找到节点配置: %s", nodeID)
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
		log.Printf("流式执行: 设置节点类型 %s -> %s", nodeConfig.ID, nodeConfig.Type)

		// 执行节点
		result := e.executeNode(*nodeConfig, dataFlow, variableContext, req.UserID)
		if result.Success {
			nodeData := NewNodeData(result.Data)
			dataFlow.SetNodeOutput(nodeConfig.ID, nodeData)
			variableContext.SetNodeOutput(nodeConfig.ID, nodeData)
			log.Printf("流式执行: 保存节点 %s 的输出数据", nodeConfig.ID)

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

	// 如果有AI节点，执行AI节点的所有上游节点
	if aiNode != nil {
		for _, edge := range req.Edges {
			if edge.Target == aiNode.ID {
				executeUpstream(edge.Source)
			}
		}

		// 设置AI节点类型到变量上下文
		variableContext.SetNodeType(aiNode.ID, aiNode.Type)
		log.Printf("流式执行: 设置AI节点类型 %s -> %s", aiNode.ID, aiNode.Type)

		// 如果AI节点启用了流式输出，使用流式执行
		if hasStreamingAI {
			log.Printf("流式执行: 开始执行AI节点 %s", aiNode.ID)
			e.ExecuteAINodeStream(*aiNode, dataFlow, variableContext, req.UserID, callback)
			log.Printf("流式执行: AI节点 %s 执行完成", aiNode.ID)
		} else {
			// AI节点未启用流式输出，使用普通执行
			result := e.executeNode(*aiNode, dataFlow, variableContext, req.UserID)
			if result.Success {
				nodeData := NewNodeData(result.Data)
				dataFlow.SetNodeOutput(aiNode.ID, nodeData)
				variableContext.SetNodeOutput(aiNode.ID, nodeData)
				resultJSON, _ := json.Marshal(result)
				callback(aiNode.ID, string(resultJSON), false, "node_result", nil)
			} else {
				resultJSON, _ := json.Marshal(result)
				callback(aiNode.ID, string(resultJSON), false, "node_result", fmt.Errorf("节点执行失败: %s", result.Error))
			}
		}
	} else {
		// 没有AI节点，执行所有节点（按拓扑顺序）
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
				log.Printf("未找到节点配置: %s", nodeID)
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

			// 执行节点
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

			// 找到下一个节点
			for _, edge := range req.Edges {
				if edge.Source == nodeID && !executed[edge.Target] {
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
	}

	return nil
}
