package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"yaolight-workshop/backend/infrastructure/database"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	crawlerService "yaolight-workshop/backend/modules/crawler/services"
	datacleanService "yaolight-workshop/backend/modules/dataclean/services"
)

// WorkflowExecutor 工作流执行器
type WorkflowExecutor struct {
	crawlerService   *crawlerService.CrawlerService
	datacleanService *datacleanService.DataCleanService
	aiService        *aiService.AIService
}

// NodeConfig 节点配置
type NodeConfig struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// EdgeConfig 边配置
type EdgeConfig struct {
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"` // 条件节点的输出端口：true 或 false
	TargetHandle string `json:"targetHandle,omitempty"` // 合并节点的输入端口：input-0, input-1, input-2
}

// ExecutionRequest 执行请求
type ExecutionRequest struct {
	Nodes  []NodeConfig `json:"nodes"`
	Edges  []EdgeConfig `json:"edges"`
	UserID uint         `json:"userID,omitempty"` // 用户ID，用于验证模型归属
}

// NodeExecutionResult 节点执行结果
type NodeExecutionResult struct {
	NodeID  string      `json:"node_id"`
	Type    string      `json:"type"`
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error,omitempty"`
}

// ExecutionResult 执行结果
type ExecutionResult struct {
	Success bool                  `json:"success"`
	Results []NodeExecutionResult `json:"results"`
	Error   string                `json:"error,omitempty"`
}

// NewWorkflowExecutor 创建工作流执行器
func NewWorkflowExecutor() *WorkflowExecutor {
	modelRepo := aiRepos.NewAIModelRepository(database.DB)
	templateRepo := aiRepos.NewProviderTemplateRepository(database.DB)
	return &WorkflowExecutor{
		crawlerService:   crawlerService.NewCrawlerService(),
		datacleanService: datacleanService.NewDataCleanService(),
		aiService:        aiService.NewAIService(modelRepo, templateRepo),
	}
}

// Execute 执行工作流
func (e *WorkflowExecutor) Execute(req ExecutionRequest) (*ExecutionResult, error) {

	results := make([]NodeExecutionResult, 0)
	// 使用数据流管理器
	dataFlow := NewDataFlow(req.Edges)
	// 创建变量上下文
	variableContext := NewVariableContext()

	// 找到起始节点（没有入边的节点）
	startNodes := e.findStartNodes(req.Nodes, req.Edges)

	if len(startNodes) == 0 {
		return &ExecutionResult{
			Success: false,
			Error:   "未找到起始节点",
		}, fmt.Errorf("未找到起始节点")
	}

	// 按拓扑顺序执行节点
	executed := make(map[string]bool)
	// 存储条件节点的结果，用于判断边是否应该执行
	conditionResults := make(map[string]bool)
	queue := make([]string, 0)

	// 将起始节点加入队列
	for _, node := range startNodes {
		queue = append(queue, node.ID)
	}

	// 执行节点
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

		// 设置节点类型到变量上下文
		variableContext.SetNodeType(nodeID, nodeConfig.Type)

		// 执行节点（传递userID用于AI节点验证）
		result := e.executeNode(*nodeConfig, dataFlow, variableContext, req.UserID)
		results = append(results, result)

		// 保存节点输出数据到数据流和变量上下文
		if result.Success {
			// 将结果数据转换为 NodeData 格式
			nodeData := NewNodeData(result.Data)
			dataFlow.SetNodeOutput(nodeID, nodeData)
			// 同时保存到变量上下文
			variableContext.SetNodeOutput(nodeID, nodeData)
		}

		executed[nodeID] = true

		// 如果是条件节点，需要根据条件结果选择正确的分支
		if nodeConfig.Type == "condition" && result.Success {
			// 获取条件判断结果
			conditionResult := false
			if resultData, ok := result.Data.(map[string]interface{}); ok {
				if res, exists := resultData["result"]; exists {
					if boolRes, ok := res.(bool); ok {
						conditionResult = boolRes
					}
				}
			}
			// 保存条件节点的结果，供后续判断使用
			conditionResults[nodeID] = conditionResult

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
						// 检查该节点的所有入边是否都已执行
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

	// 检查是否有未执行的节点
	allExecuted := true
	for _, node := range req.Nodes {
		if !executed[node.ID] {
			allExecuted = false
		}
	}

	return &ExecutionResult{
		Success: allExecuted,
		Results: results,
	}, nil
}

// isEdgeFromConditionBranch 检查边是否来自条件节点的未执行分支
// 如果源节点没有执行，递归检查它的上游边是否来自条件节点的未执行分支
func isEdgeFromConditionBranch(edge EdgeConfig, nodes []NodeConfig, edges []EdgeConfig, conditionResults map[string]bool, executed map[string]bool) bool {
	// 如果源节点已执行，需要等待
	if executed[edge.Source] {
		return true
	}

	// 检查这个边是否直接来自条件节点
	for _, sourceNode := range nodes {
		if sourceNode.ID == edge.Source && sourceNode.Type == "condition" {
			if conditionResult, exists := conditionResults[edge.Source]; exists {
				// 条件节点已执行，检查边的sourceHandle是否匹配
				if edge.SourceHandle == "true" && !conditionResult {
					return false // 条件为false，但边是true分支，不等待
				} else if edge.SourceHandle == "false" && conditionResult {
					return false // 条件为true，但边是false分支，不等待
				}
			}
		}
	}

	// 如果源节点没有执行，递归检查它的上游边
	for _, upstreamEdge := range edges {
		if upstreamEdge.Target == edge.Source {
			// 递归检查上游边是否来自条件节点的未执行分支
			if !isEdgeFromConditionBranch(upstreamEdge, nodes, edges, conditionResults, executed) {
				return false // 上游边来自未执行的分支，不等待
			}
		}
	}

	// 默认需要等待
	return true
}

// findStartNodes 找到起始节点（没有入边的节点）
func (e *WorkflowExecutor) findStartNodes(nodes []NodeConfig, edges []EdgeConfig) []NodeConfig {
	hasIncoming := make(map[string]bool)
	for _, edge := range edges {
		hasIncoming[edge.Target] = true
	}

	startNodes := make([]NodeConfig, 0)
	for _, node := range nodes {
		if !hasIncoming[node.ID] {
			startNodes = append(startNodes, node)
		}
	}

	return startNodes
}

// executeNode 执行单个节点
func (e *WorkflowExecutor) executeNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext, userID uint) NodeExecutionResult {
	switch node.Type {
	case "start":
		return e.executeStartNode(node, dataFlow)
	case "crawler":
		return e.executeCrawlerNode(node, dataFlow, variableContext)
	case "dataclean":
		return e.executeDataCleanNode(node, dataFlow, variableContext)
	case "ai":
		return e.executeAINode(node, dataFlow, variableContext, userID)
	case "condition":
		return e.executeConditionNode(node, dataFlow, variableContext)
	case "transform":
		return e.executeTransformNode(node, dataFlow, variableContext)
	case "loop":
		return e.executeLoopNode(node, dataFlow, variableContext)
	case "merge":
		return e.executeMergeNode(node, dataFlow)
	case "delay":
		return e.executeDelayNode(node, dataFlow)
	case "output":
		return e.executeOutputNode(node, dataFlow, variableContext)
	case "end":
		return e.executeEndNode(node, dataFlow)
	default:
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    node.Type,
			Success: false,
			Error:   fmt.Sprintf("未知节点类型: %s", node.Type),
		}
	}
}

// executeCrawlerNode 执行爬虫节点
func (e *WorkflowExecutor) executeCrawlerNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据（可选，可用于动态URL等）
	inputData, _ := dataFlow.GetNodeInputData(node.ID)

	// 获取提取模式
	extractMode := getString(node.Config, "extractMode", "smart")

	// 获取URL配置
	urlConfig := getString(node.Config, "url", "")
	// 获取URL变量（独立字段）
	urlVariable := getString(node.Config, "urlVariable", "")

	// 解析URL
	var finalURL string

	// 优先使用 urlVariable（如果设置了）
	if urlVariable != "" {
		// 提取变量路径（去除 {{}}）
		varPath := strings.Trim(urlVariable, "{{}}")
		varPath = strings.TrimSpace(varPath)

		// 获取变量值
		urlVar, err := variableContext.GetVariable(varPath)
		if err == nil && urlVar != nil {
			// 如果变量值是字符串，直接使用
			if urlStr, ok := urlVar.(string); ok {
				// 检查是否是有效的URL
				if strings.HasPrefix(urlStr, "http://") || strings.HasPrefix(urlStr, "https://") {
					finalURL = urlStr
				} else {
					// 如果不是完整URL，尝试作为相对路径或拼接
					finalURL = urlStr
				}
			} else if urlMap, ok := urlVar.(map[string]interface{}); ok {
				// 如果变量值是对象，尝试提取常见的URL字段
				// 按优先级尝试：url, link, href, src, data
				urlFields := []string{"url", "link", "href", "src", "data"}
				for _, field := range urlFields {
					if val, exists := urlMap[field]; exists {
						if urlStr, ok := val.(string); ok && urlStr != "" {
							finalURL = urlStr
							break
						}
					}
				}
				// 如果还是没找到，转换为字符串（可能不是有效URL，但至少不会报错）
				if finalURL == "" {
					finalURL = fmt.Sprintf("%v", urlVar)
				}
			} else {
				// 其他类型，转换为字符串
				finalURL = fmt.Sprintf("%v", urlVar)
			}
		} else {
			// 如果直接获取失败，尝试使用 ResolveTemplateToInterface（支持路径访问）
			resolved, err := variableContext.ResolveTemplateToInterface(urlVariable)
			if err == nil && resolved != nil {
				// 如果解析结果是字符串，直接使用
				if urlStr, ok := resolved.(string); ok {
					if strings.HasPrefix(urlStr, "http://") || strings.HasPrefix(urlStr, "https://") {
						finalURL = urlStr
					} else if !strings.Contains(urlStr, "{{") {
						// 确保不是未解析的模板字符串
						finalURL = urlStr
					}
				} else if urlMap, ok := resolved.(map[string]interface{}); ok {
					// 如果是对象，尝试提取URL字段
					urlFields := []string{"url", "link", "href", "src", "data"}
					for _, field := range urlFields {
						if val, exists := urlMap[field]; exists {
							if urlStr, ok := val.(string); ok && urlStr != "" {
								finalURL = urlStr
								break
							}
						}
					}
				} else {
					// 其他类型，转换为字符串
					finalURL = fmt.Sprintf("%v", resolved)
				}
			}

			// 如果 ResolveTemplateToInterface 也失败，尝试 ResolveTemplate（字符串模板）
			if finalURL == "" {
				resolved, err := variableContext.ResolveTemplate(urlVariable)
				if err == nil && resolved != "" {
					// 检查是否是未解析的模板字符串（仍然包含 {{}}）
					if !strings.Contains(resolved, "{{") {
						finalURL = resolved
					}
				}
			}

			// 如果变量解析失败，尝试从输入数据中获取URL
			if finalURL == "" && inputData != nil && inputData.Payload != nil {
				// 提取变量路径（去除 {{}} 和节点ID）
				varPath := strings.Trim(urlVariable, "{{}}")
				varPath = strings.TrimSpace(varPath)
				parts := strings.Split(varPath, ".")
				// 如果路径格式是 nodeId.variable.field，提取 variable.field
				if len(parts) >= 2 {
					variablePath := strings.Join(parts[1:], ".")
					urlValue, err := GetDataByPath(inputData.Payload, variablePath)
					if err == nil && urlValue != nil {
						if urlStr, ok := urlValue.(string); ok && urlStr != "" {
							finalURL = urlStr
						} else if urlMap, ok := urlValue.(map[string]interface{}); ok {
							// 如果是对象，尝试提取URL字段
							urlFields := []string{"url", "link", "href", "src", "data"}
							for _, field := range urlFields {
								if val, exists := urlMap[field]; exists {
									if urlStr, ok := val.(string); ok && urlStr != "" {
										finalURL = urlStr
										break
									}
								}
							}
						}
					}
					// 如果路径是 data.field 格式，但字段不存在，尝试从 data 对象中查找所有可能的URL字段
					if finalURL == "" && len(parts) >= 3 && parts[1] == "data" {
						dataValue, err := GetDataByPath(inputData.Payload, "data")
						if err == nil && dataValue != nil {
							if dataMap, ok := dataValue.(map[string]interface{}); ok {
								// 尝试查找常见的URL字段
								urlFields := []string{"url", "link", "href", "src", parts[2]} // 包含原始字段名
								for _, field := range urlFields {
									if val, exists := dataMap[field]; exists {
										if urlStr, ok := val.(string); ok && urlStr != "" {
											finalURL = urlStr
											break
										}
									}
								}
							}
						}
					}
					// 如果还是没找到，尝试直接查找常见的URL字段
					if finalURL == "" {
						if payloadMap, ok := inputData.Payload.(map[string]interface{}); ok {
							urlFields := []string{"url", "link", "href", "src", "data"}
							for _, field := range urlFields {
								if val, exists := payloadMap[field]; exists {
									if urlStr, ok := val.(string); ok && urlStr != "" {
										finalURL = urlStr
										break
									}
								}
							}
						}
					}
				}
			}
		}

		// 如果最终URL仍然包含模板字符串，说明解析失败
		if finalURL != "" && strings.Contains(finalURL, "{{") {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "crawler",
				Success: false,
				Error:   fmt.Sprintf("URL变量解析失败: %s，请检查变量是否存在", urlVariable),
			}
		}

		// 如果用户选择了urlVariable但解析失败（finalURL为空），不应该回退到urlConfig，应该报错
		if finalURL == "" {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "crawler",
				Success: false,
				Error:   fmt.Sprintf("URL变量 %s 解析后为空值，请检查变量路径是否正确或变量是否存在", urlVariable),
			}
		}
	}

	// 如果 urlVariable 没有提供URL（用户没有选择urlVariable），使用 url 字段
	if finalURL == "" && urlConfig != "" {
		// 如果包含 {{ 说明是模板，需要解析
		if strings.Contains(urlConfig, "{{") {
			resolved, err := variableContext.ResolveTemplate(urlConfig)
			if err == nil && resolved != "" {
				finalURL = resolved
			} else {
				finalURL = urlConfig // 解析失败，使用原值
			}
		} else {
			finalURL = urlConfig
		}
	}

	// 如果URL仍为空，尝试从输入数据中获取
	if finalURL == "" {
		// 尝试从输入数据获取
		if inputData.Payload != nil {
			if urlMap, ok := inputData.Payload.(map[string]interface{}); ok {
				if url, exists := urlMap["url"]; exists {
					finalURL = fmt.Sprintf("%v", url)
				}
			}
		}
		// 尝试从变量上下文获取
		if finalURL == "" {
			if urlVar, err := variableContext.GetVariable("url"); err == nil {
				finalURL = fmt.Sprintf("%v", urlVar)
			}
		}
	}

	// 构建爬虫配置
	config := crawlerService.CrawlerConfig{
		URL:            finalURL,
		Method:         getString(node.Config, "method", "GET"),
		Selector:       getString(node.Config, "selector", ""),
		UserAgent:      getString(node.Config, "userAgent", ""),
		Timeout:        getInt(node.Config, "timeout", 30),
		Headers:        make(map[string]string),
		Body:           getString(node.Config, "body", ""),
		BodyType:       getString(node.Config, "bodyType", "json"),
		Cookies:        make(map[string]string),
		Proxy:          getString(node.Config, "proxy", ""),
		RetryCount:     getInt(node.Config, "retryCount", 3),
		RetryDelay:     getInt(node.Config, "retryDelay", 1),
		WaitTime:       getInt(node.Config, "waitTime", 0),
		ExtractType:    getString(node.Config, "extractType", "text"),
		ExtractAttr:    getString(node.Config, "extractAttr", ""),
		Encoding:       getString(node.Config, "encoding", "auto"),
		ExtractMode:    extractMode,
		SmartMode:      extractMode != "custom",                  // 非自定义模式时启用智能模式
		JavaScriptWait: getInt(node.Config, "javascriptWait", 5), // JavaScript等待时间
	}

	// 处理动态URL（如果URL包含变量，从上游数据中获取）
	if config.URL == "" && inputData.Payload != nil {
		if urlMap, ok := inputData.Payload.(map[string]interface{}); ok {
			if url, exists := urlMap["url"]; exists {
				config.URL = fmt.Sprintf("%v", url)
			}
		}
	}

	// 设置自定义Headers（支持变量解析）
	if headersValue, ok := node.Config["headers"]; ok {
		// 如果是字符串，可能是JSON格式，需要解析
		if headersStr, ok := headersValue.(string); ok {
			// 先解析变量
			if strings.Contains(headersStr, "{{") {
				resolved, err := variableContext.ResolveTemplate(headersStr)
				if err == nil {
					headersStr = resolved
				}
			}
			// 尝试解析JSON
			var headersMap map[string]interface{}
			if err := json.Unmarshal([]byte(headersStr), &headersMap); err == nil {
				for key, value := range headersMap {
					config.Headers[key] = fmt.Sprintf("%v", value)
				}
			}
		} else if headersMap, ok := headersValue.(map[string]interface{}); ok {
			// 如果是对象，直接使用
			for key, value := range headersMap {
				// 如果值是字符串且包含变量，解析它
				if strValue, ok := value.(string); ok {
					if strings.Contains(strValue, "{{") {
						resolved, err := variableContext.ResolveTemplate(strValue)
						if err == nil {
							config.Headers[key] = resolved
						} else {
							config.Headers[key] = strValue
						}
					} else {
						config.Headers[key] = strValue
					}
				} else {
					config.Headers[key] = fmt.Sprintf("%v", value)
				}
			}
		}
	}

	// 设置Cookies（支持变量解析）
	if cookiesValue, ok := node.Config["cookies"]; ok {
		// 如果是字符串，可能是JSON格式
		if cookiesStr, ok := cookiesValue.(string); ok {
			// 先解析变量
			if strings.Contains(cookiesStr, "{{") {
				resolved, err := variableContext.ResolveTemplate(cookiesStr)
				if err == nil {
					cookiesStr = resolved
				}
			}
			// 尝试解析JSON
			var cookiesMap map[string]interface{}
			if err := json.Unmarshal([]byte(cookiesStr), &cookiesMap); err == nil {
				for key, value := range cookiesMap {
					config.Cookies[key] = fmt.Sprintf("%v", value)
				}
			}
		} else if cookiesMap, ok := cookiesValue.(map[string]interface{}); ok {
			// 如果是对象，直接使用
			for key, value := range cookiesMap {
				if strValue, ok := value.(string); ok {
					// 如果包含变量，解析它
					if strings.Contains(strValue, "{{") {
						resolved, err := variableContext.ResolveTemplate(strValue)
						if err == nil {
							config.Cookies[key] = resolved
						} else {
							config.Cookies[key] = strValue
						}
					} else {
						config.Cookies[key] = strValue
					}
				} else {
					config.Cookies[key] = fmt.Sprintf("%v", value)
				}
			}
		}
	}

	// 设置分页配置
	if paginationMap, ok := node.Config["pagination"].(map[string]interface{}); ok {
		pagination := &crawlerService.PaginationConfig{
			Enabled:   getBool(paginationMap, "enabled", false),
			Selector:  getString(paginationMap, "selector", ""),
			MaxPages:  getInt(paginationMap, "maxPages", 10),
			PageParam: getString(paginationMap, "pageParam", "page"),
			StartPage: getInt(paginationMap, "startPage", 1),
			Increment: getInt(paginationMap, "increment", 1),
		}
		if pagination.Enabled {
			config.Pagination = pagination
		}
	}

	// 设置重定向和SSL验证
	config.FollowRedirect = getBool(node.Config, "followRedirect", true)
	config.VerifySSL = getBool(node.Config, "verifySSL", true)

	// 设置无头浏览器相关配置（用于SPA应用）
	config.UseHeadless = getBool(node.Config, "useHeadless", false)
	config.WaitForSelector = getString(node.Config, "waitForSelector", "")
	config.DisableImages = getBool(node.Config, "disableImages", false)

	// 执行爬虫
	result, err := e.crawlerService.Execute(config)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "crawler",
			Success: false,
			Error:   err.Error(),
		}
	}

	if !result.Success {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "crawler",
			Success: false,
			Error:   result.Error,
		}
	}

	// 标准化输出格式（按照节点输出定义）
	outputData := make(map[string]interface{})
	if resultData, ok := result.Data.(map[string]interface{}); ok {
		// 提取标准输出变量
		if data, exists := resultData["data"]; exists {
			outputData["data"] = data
		} else {
			outputData["data"] = resultData
		}
		if html, exists := resultData["html"]; exists {
			outputData["html"] = html
		} else if rawHTML, exists := resultData["raw_html"]; exists {
			outputData["html"] = rawHTML
		}
		if text, exists := resultData["text"]; exists {
			outputData["text"] = text
		} else if extracted, ok := resultData["extracted"].(map[string]interface{}); ok {
			if text, exists := extracted["text"]; exists {
				outputData["text"] = text
			}
		}
	} else {
		outputData["data"] = result.Data
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "crawler",
		Success: true,
		Data:    outputData,
	}
}

// executeDataCleanNode 执行数据清洗节点
func (e *WorkflowExecutor) executeDataCleanNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "dataclean",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 如果配置了数据变量，优先使用变量
	dataVariable := getString(node.Config, "dataVariable", "")
	if dataVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(dataVariable)
		if err == nil && resolved != nil {
			// 使用变量值作为输入数据
			inputData = NewNodeData(resolved)
		}
	}

	// 构建清洗配置
	config := datacleanService.CleanConfig{
		CleanType:    getString(node.Config, "cleanType", "custom"),
		RemoveHTML:   getBool(node.Config, "removeHTML", false),
		Trim:         getBool(node.Config, "trim", true),
		RemoveSpaces: getBool(node.Config, "removeSpaces", false),
		ToLowerCase:  getBool(node.Config, "toLowerCase", false),
		ToUpperCase:  getBool(node.Config, "toUpperCase", false),
		Deduplicate:  getBool(node.Config, "deduplicate", false),
	}

	// 如果使用预设配置
	if config.CleanType != "custom" {
		preset := e.datacleanService.GetPreset(config.CleanType)
		// 预设配置与用户配置合并
		if config.RemoveHTML || preset.RemoveHTML {
			config.RemoveHTML = true
		}
		if config.Trim || preset.Trim {
			config.Trim = true
		}
		if config.RemoveSpaces || preset.RemoveSpaces {
			config.RemoveSpaces = true
		}
		if config.ToLowerCase || preset.ToLowerCase {
			config.ToLowerCase = true
		}
		if config.ToUpperCase || preset.ToUpperCase {
			config.ToUpperCase = true
		}
		// 使用预设的提取和替换规则
		if preset.Extract != nil {
			config.Extract = preset.Extract
		}
		if len(preset.Replace) > 0 {
			config.Replace = preset.Replace
		}
	}

	// 处理替换规则
	if replaceRules, ok := node.Config["replace"].([]interface{}); ok {
		config.Replace = make([]datacleanService.ReplaceRule, 0)
		for _, rule := range replaceRules {
			if ruleMap, ok := rule.(map[string]interface{}); ok {
				config.Replace = append(config.Replace, datacleanService.ReplaceRule{
					From:  getString(ruleMap, "from", ""),
					To:    getString(ruleMap, "to", ""),
					Regex: getBool(ruleMap, "regex", false),
				})
			}
		}
	}

	// 处理提取规则
	if extractRule, ok := node.Config["extract"].(map[string]interface{}); ok {
		config.Extract = &datacleanService.ExtractRule{
			Pattern: getString(extractRule, "pattern", ""),
			Group:   getInt(extractRule, "group", 0),
		}
	}

	// 处理过滤规则
	if filterRule, ok := node.Config["filter"].(map[string]interface{}); ok {
		config.Filter = &datacleanService.FilterRule{
			Field:    getString(filterRule, "field", ""),
			Operator: getString(filterRule, "operator", "contains"),
			Value:    getString(filterRule, "value", ""),
		}
	}

	// 处理字段映射
	if fieldMapping, ok := node.Config["fieldMapping"].(map[string]interface{}); ok {
		config.FieldMapping = fieldMapping
	}

	// 执行数据清洗
	payload := ExtractPayload(inputData)
	result, err := e.datacleanService.Execute(payload, config)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "dataclean",
			Success: false,
			Error:   err.Error(),
		}
	}

	if !result.Success {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "dataclean",
			Success: false,
			Error:   result.Error,
		}
	}

	// 将清洗后的数据包装成符合变量定义的格式
	// 变量定义中输出变量是 "cleaned"，所以需要包装成 { "cleaned": result.Data }
	// 同时，如果清洗后的数据是对象，保留其原有结构以便直接访问字段
	var cleanedData map[string]interface{}

	if cleanedObj, ok := result.Data.(map[string]interface{}); ok {
		// 如果清洗后的数据是对象，保留原有结构，同时添加 cleaned 字段
		cleanedData = make(map[string]interface{})
		for k, v := range cleanedObj {
			cleanedData[k] = v
		}
		// 添加 cleaned 字段，指向整个清洗后的数据（用于变量访问）
		cleanedData["cleaned"] = result.Data
	} else {
		// 如果清洗后的数据不是对象（是字符串、数组等），包装成对象
		cleanedData = map[string]interface{}{
			"cleaned": result.Data,
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "dataclean",
		Success: true,
		Data:    cleanedData,
	}
}

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

	// 如果使用已保存的模型，先从模型配置读取默认值
	if modelMode == "saved" {
		modelRepo := aiRepos.NewAIModelRepository(database.DB)
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
		if s, ok := node.Config["stream"].(bool); ok {
			stream = s
			providerConfig["stream"] = s
		} else if _, exists := providerConfig["stream"]; !exists {
			// 如果节点配置没有指定，且模型配置也没有，使用默认值 false
			stream = false
			providerConfig["stream"] = false
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
	} else if modelConfig.Provider == "gemini" || modelConfig.Provider == "grok" {
		// Gemini/Grok (via OpenRouter)
		// 检查 thinking 参数 (OpenRouter 支持 reasoning)
		if thinking, ok := node.Config["thinking"].(bool); ok {
			providerConfig["thinking"] = thinking
		} else if _, exists := providerConfig["thinking"]; !exists {
			providerConfig["thinking"] = false
		}
		// 检查 reasoning 参数 (前端界面可能是这个名字)
		if reasoning, ok := node.Config["reasoning"].(bool); ok {
			providerConfig["reasoning"] = reasoning
		}

		// 检查 reasoning_effort 参数
		if effort, ok := node.Config["reasoning_effort"].(string); ok && effort != "" {
			providerConfig["reasoning_effort"] = effort
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

	// 如果启用流式输出，使用流式方法（但需要等待完成）
	if stream {
		var fullContent strings.Builder
		var fullReasoningContent strings.Builder

		// 非流式执行路径，使用 Background context（不需要取消功能）
		err := provider.ChatStream(context.Background(), modelConfig, prompt, content, providerConfig, func(deltaContent string, done bool, err error) {
			if err != nil {
				return
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
		resultData := map[string]interface{}{
			"result":            fullContent.String(),
			"content":           fullContent.String(),
			"reasoningContent":  fullReasoningContent.String(),
			"reasoning_details": fullReasoningContent.String(), // 兼容 reasoning_details
			"tokensUsed":        0,                             // 流式输出暂时无法获取token数
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

// getUint 从配置中获取uint值
func getUint(m map[string]interface{}, key string, defaultValue uint) uint {
	if v, ok := m[key].(float64); ok {
		return uint(v)
	}
	return defaultValue
}

// executeStartNode 执行开始节点
func (e *WorkflowExecutor) executeStartNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	// 获取用户输入的数据
	inputData := getString(node.Config, "inputData", "")
	inputDataType := getString(node.Config, "inputDataType", "auto")

	var initialData map[string]interface{}

	// 如果用户输入了数据，使用用户输入
	if inputData != "" {
		switch inputDataType {
		case "json":
			// 强制按JSON解析
			var jsonData interface{}
			if err := json.Unmarshal([]byte(inputData), &jsonData); err == nil {
				// 如果解析成功，包装成对象
				if obj, ok := jsonData.(map[string]interface{}); ok {
					initialData = obj
				} else {
					// 如果不是对象，包装在data字段中
					initialData = map[string]interface{}{
						"data": jsonData,
					}
				}
			} else {
				// JSON解析失败，作为字符串处理
				initialData = map[string]interface{}{
					"data": inputData,
				}
			}
		case "url":
			// URL格式：包装在url字段中
			initialData = map[string]interface{}{
				"url": inputData,
			}
		case "number":
			// 数字格式：尝试转换为数字
			if num, err := strconv.ParseFloat(inputData, 64); err == nil {
				initialData = map[string]interface{}{
					"data": num,
				}
			} else {
				// 转换失败，作为字符串
				initialData = map[string]interface{}{
					"data": inputData,
				}
			}
		case "text":
			// 文本格式：作为字符串
			initialData = map[string]interface{}{
				"data": inputData,
			}
		case "string":
			// 兼容旧版本：作为字符串
			initialData = map[string]interface{}{
				"data": inputData,
			}
		case "auto":
			fallthrough
		default:
			// 自动检测：尝试解析JSON
			var jsonData interface{}
			if err := json.Unmarshal([]byte(inputData), &jsonData); err == nil {
				// JSON解析成功
				if obj, ok := jsonData.(map[string]interface{}); ok {
					initialData = obj
				} else {
					initialData = map[string]interface{}{
						"data": jsonData,
					}
				}
			} else {
				// 不是JSON，作为字符串
				initialData = map[string]interface{}{
					"data": inputData,
				}
			}
		}
		// 添加时间戳
		initialData["timestamp"] = time.Now().Unix()
	} else {
		// 没有用户输入，使用默认数据
		initialData = map[string]interface{}{
			"message":   "工作流开始",
			"timestamp": time.Now().Unix(),
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "start",
		Success: true,
		Data:    initialData,
	}
}

// executeConditionNode 执行条件节点
func (e *WorkflowExecutor) executeConditionNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "condition",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取条件配置
	field := getString(node.Config, "field", "")
	fieldVariable := getString(node.Config, "fieldVariable", "")
	operator := getString(node.Config, "operator", "==")
	value := getString(node.Config, "value", "")
	valueVariable := getString(node.Config, "valueVariable", "")

	// 如果配置了字段变量，优先使用变量值
	if fieldVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(fieldVariable)
		if err == nil {
			if str, ok := resolved.(string); ok {
				field = str
			} else {
				field = fmt.Sprintf("%v", resolved)
			}
		}
	}

	// 如果配置了值变量，优先使用变量值
	if valueVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(valueVariable)
		if err == nil {
			if str, ok := resolved.(string); ok {
				value = str
			} else {
				value = fmt.Sprintf("%v", resolved)
			}
		}
	}

	if field == "" {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "condition",
			Success: false,
			Error:   "条件字段为空",
		}
	}

	// 从输入数据中获取字段值
	fieldValue, err := GetDataByPath(ExtractPayload(inputData), field)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "condition",
			Success: false,
			Error:   fmt.Sprintf("获取字段值失败: %v", err),
		}
	}

	// 执行条件判断
	result := evaluateCondition(fieldValue, operator, value)

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "condition",
		Success: true,
		Data: map[string]interface{}{
			"result":       result,
			"field":        field,
			"fieldValue":   fieldValue,
			"operator":     operator,
			"compareValue": value,
			// 传递原始数据
			"data": ExtractPayload(inputData),
		},
	}
}

// evaluateCondition 评估条件表达式
func evaluateCondition(fieldValue interface{}, operator, compareValue string) bool {
	switch operator {
	case "==":
		return fmt.Sprintf("%v", fieldValue) == compareValue
	case "!=":
		return fmt.Sprintf("%v", fieldValue) != compareValue
	case ">":
		return compareNumbers(fieldValue, compareValue) > 0
	case "<":
		return compareNumbers(fieldValue, compareValue) < 0
	case ">=":
		return compareNumbers(fieldValue, compareValue) >= 0
	case "<=":
		return compareNumbers(fieldValue, compareValue) <= 0
	case "contains":
		fieldStr := fmt.Sprintf("%v", fieldValue)
		return strings.Contains(fieldStr, compareValue)
	default:
		return false
	}
}

// compareNumbers 比较数字
func compareNumbers(a interface{}, b string) int {
	var numA, numB float64
	var ok bool

	// 转换 a 为数字
	switch v := a.(type) {
	case int:
		numA = float64(v)
		ok = true
	case float64:
		numA = v
		ok = true
	case string:
		if parsed, err := fmt.Sscanf(v, "%f", &numA); err == nil && parsed == 1 {
			ok = true
		}
	}

	if !ok {
		return 0
	}

	// 转换 b 为数字
	if _, err := fmt.Sscanf(b, "%f", &numB); err != nil {
		return 0
	}

	if numA > numB {
		return 1
	} else if numA < numB {
		return -1
	}
	return 0
}

// executeTransformNode 执行转换节点
func (e *WorkflowExecutor) executeTransformNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "transform",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取转换规则
	transformType := getString(node.Config, "transformType", "")
	_ = getString(node.Config, "script", "") // script 暂未使用

	// 获取原始数据
	originalData := ExtractPayload(inputData)

	// 执行数据转换
	transformedData := originalData
	switch transformType {
	case "map":
		// 映射转换（需要根据 script 执行）
		transformedData = originalData
	case "filter":
		// 过滤转换
		transformedData = originalData
	case "sort":
		// 排序转换
		transformedData = originalData
	case "group":
		// 分组转换
		transformedData = originalData
	default:
		// 默认不转换
		transformedData = originalData
	}

	// TODO: 根据 script 执行实际的转换逻辑

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "transform",
		Success: true,
		Data:    transformedData,
	}
}

// executeLoopNode 执行循环节点
func (e *WorkflowExecutor) executeLoopNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "loop",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取循环配置
	loopType := getString(node.Config, "loopType", "foreach")
	items := getString(node.Config, "items", "")

	// TODO: 实现循环逻辑
	// 目前只是传递数据
	results := make([]interface{}, 0)
	if loopType == "foreach" && items != "" {
		// 从输入数据中获取要遍历的数组
		itemsData, err := GetDataByPath(ExtractPayload(inputData), items)
		if err == nil {
			if arr, ok := itemsData.([]interface{}); ok {
				for _, item := range arr {
					results = append(results, item)
				}
			}
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "loop",
		Success: true,
		Data: map[string]interface{}{
			"loopType": loopType,
			"results":  results,
			"count":    len(results),
		},
	}
}

// executeMergeNode 执行合并节点
func (e *WorkflowExecutor) executeMergeNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	// 获取所有上游节点的输入数据
	inputs, err := dataFlow.GetNodeInput(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	if len(inputs) == 0 {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   "合并节点没有输入数据",
		}
	}

	// 合并所有输入数据
	mergedData := MergeData(inputs...)

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "merge",
		Success: true,
		Data:    ExtractPayload(mergedData),
	}
}

// executeDelayNode 执行延迟节点
func (e *WorkflowExecutor) executeDelayNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	// 获取延迟时间（秒）
	delaySeconds := getInt(node.Config, "seconds", 1)
	if delaySeconds <= 0 {
		delaySeconds = 1
	}

	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
	}

	// 执行延迟
	time.Sleep(time.Duration(delaySeconds) * time.Second)

	// 延迟节点应该传递上游数据，而不是生成新数据
	outputData := ExtractPayload(inputData)
	if outputData == nil {
		outputData = map[string]interface{}{
			"message":      "延迟完成",
			"delaySeconds": delaySeconds,
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "delay",
		Success: true,
		Data:    outputData,
	}
}

// executeEndNode 执行结束节点
func (e *WorkflowExecutor) executeEndNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "end",
		Success: true,
		Data: map[string]interface{}{
			"message":   "工作流结束",
			"finalData": ExtractPayload(inputData),
		},
	}
}

// executeOutputNode 执行输出节点
func (e *WorkflowExecutor) executeOutputNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "output",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取输出格式
	format := getString(node.Config, "format", "json")
	destination := getString(node.Config, "destination", "file")

	// TODO: 根据格式和目标执行实际的输出操作
	// 目前只是返回数据

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "output",
		Success: true,
		Data: map[string]interface{}{
			"format":      format,
			"destination": destination,
			"data":        ExtractPayload(inputData),
		},
	}
}

// 辅助函数
func getString(m map[string]interface{}, key string, defaultValue string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

func getInt(m map[string]interface{}, key string, defaultValue int) int {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case float64:
			return int(v)
		case string:
			i, err := strconv.Atoi(v)
			if err == nil {
				return i
			}
		}
	}
	return defaultValue
}

func getBool(m map[string]interface{}, key string, defaultValue bool) bool {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case bool:
			return v
		case string:
			return v == "true" || v == "1" || v == "yes"
		case int:
			return v != 0
		case float64:
			return v != 0
		}
	}
	return defaultValue
}
