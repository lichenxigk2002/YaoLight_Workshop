package services

import (
	"context"
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
	if modelConfig.Provider == "deepseek" {
		if thinking, ok := node.Config["thinking"].(bool); ok {
			providerConfig["thinking"] = thinking
		}
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		}
	}

	// 如果启用流式输出，使用流式方法
	if stream {
		var fullContent strings.Builder
		var fullReasoningContent strings.Builder
		// 创建适配器，将 providers.StreamCallback 转换为 services.StreamCallback
		providerCallback := func(deltaContent string, done bool, err error) {
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
					// 完整格式（done时可能发送）
					reasoningMatch := regexp.MustCompile(`\[REASONING\]([\s\S]*?)\[/REASONING\]`).FindStringSubmatch(deltaContent)
					contentMatch := regexp.MustCompile(`\[CONTENT\]([\s\S]*?)\[/CONTENT\]`).FindStringSubmatch(deltaContent)

					if reasoningMatch != nil && len(reasoningMatch) > 1 {
						reasoningContent := reasoningMatch[1]
						if reasoningContent != "" {
							fullReasoningContent.WriteString(reasoningContent)
							callback(nodeID, reasoningContent, false, "reasoning", nil)
						}
					}
					if contentMatch != nil && len(contentMatch) > 1 {
						contentPart := contentMatch[1]
						if contentPart != "" {
							fullContent.WriteString(contentPart)
							callback(nodeID, contentPart, false, "content", nil)
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

				// 发送完成信号（只发送正式内容作为最终结果）
				callback(nodeID, finalContent, true, "", nil)
			}
		}
		err := provider.ChatStream(modelConfig, prompt, content, providerConfig, providerCallback)
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

// ExecuteWorkflowStream 流式执行工作流（仅支持单个AI节点）
func (e *WorkflowExecutor) ExecuteWorkflowStream(
	ctx context.Context,
	req ExecutionRequest,
	callback StreamCallback,
) error {
	// 简化版本：只支持单个AI节点的流式执行
	if len(req.Nodes) == 0 {
		return fmt.Errorf("工作流节点为空")
	}

	// 找到AI节点
	var aiNode *NodeConfig
	for i := range req.Nodes {
		if req.Nodes[i].Type == "ai" {
			aiNode = &req.Nodes[i]
			break
		}
	}

	if aiNode == nil {
		return fmt.Errorf("未找到AI节点")
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
		}
		executed[nodeConfig.ID] = true
	}

	// 执行AI节点的所有上游节点
	for _, edge := range req.Edges {
		if edge.Target == aiNode.ID {
			executeUpstream(edge.Source)
		}
	}

	// 设置AI节点类型到变量上下文
	variableContext.SetNodeType(aiNode.ID, aiNode.Type)

	// 流式执行AI节点
	e.ExecuteAINodeStream(*aiNode, dataFlow, variableContext, req.UserID, callback)

	return nil
}
