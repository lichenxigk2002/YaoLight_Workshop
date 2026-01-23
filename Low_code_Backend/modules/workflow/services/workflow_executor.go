package services

import (
	"fmt"

	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/database"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	crawlerService "yaolight-workshop/backend/modules/crawler/services"
	datacleanService "yaolight-workshop/backend/modules/dataclean/services"
	userRepos "yaolight-workshop/backend/modules/user/repositories"
)

// WorkflowExecutor 工作流执行器
type WorkflowExecutor struct {
	crawlerService   *crawlerService.CrawlerService
	datacleanService *datacleanService.DataCleanService
	aiService        *aiService.AIService
	userRepo         repository.UserRepository
	pricingService   *aiService.PricingService
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
	Nodes      []NodeConfig `json:"nodes"`
	Edges      []EdgeConfig `json:"edges"`
	UserID     uint         `json:"userID,omitempty"`     // 用户ID，用于验证模型归属
	WorkflowID uint         `json:"workflowId,omitempty"` // 工作流ID，用于关联任务记录
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
	userRepo := userRepos.NewUserRepository(database.DB)
	pricingRepo := aiRepos.NewPricingConfigRepository(database.DB)
	return &WorkflowExecutor{
		crawlerService:   crawlerService.NewCrawlerService(),
		datacleanService: datacleanService.NewDataCleanService(),
		aiService:        aiService.NewAIService(modelRepo, templateRepo, pricingRepo),
		userRepo:         userRepo,
		pricingService:   aiService.NewPricingService(pricingRepo),
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

// executeCrawlerNode 已迁移到 crawler_node.go

// executeDataCleanNode 已迁移到 dataclean_node.go

// executeAINode 已迁移到 ai_node.go

// executeConditionNode 已迁移到 condition_node.go

// 以下函数已迁移到独立文件：
// - executeStartNode -> start_node.go
// - executeTransformNode -> transform_node.go
// - executeLoopNode -> loop_node.go
// - executeMergeNode -> merge_node.go
// - executeDelayNode -> delay_node.go
// - executeEndNode -> end_node.go
// - executeOutputNode -> output_node.go
