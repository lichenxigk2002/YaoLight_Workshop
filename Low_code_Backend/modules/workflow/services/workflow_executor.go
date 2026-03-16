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

// WorkflowExecutor executes workflow nodes.
type WorkflowExecutor struct {
	crawlerService   *crawlerService.CrawlerService
	datacleanService *datacleanService.DataCleanService
	aiService        *aiService.AIService
	userRepo         repository.UserRepository
	pricingService   *aiService.PricingService
}

// NodeConfig describes a workflow node.
type NodeConfig struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// EdgeConfig describes an edge between two nodes.
type EdgeConfig struct {
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"` // Condition branch handle, such as true or false.
	TargetHandle string `json:"targetHandle,omitempty"` // Input slot handle, such as input-0 or input-1.
}

// ExecutionRequest is the workflow execution payload.
type ExecutionRequest struct {
	Nodes         []NodeConfig           `json:"nodes"`
	Edges         []EdgeConfig           `json:"edges"`
	UserID        uint                   `json:"userID,omitempty"`     // User ID for permission-aware execution.
	WorkflowID    uint                   `json:"workflowId,omitempty"` // Workflow ID for task association.
	RuntimeInput  interface{}            `json:"runtimeInput,omitempty"`
	RuntimeMeta   map[string]interface{} `json:"runtimeMeta,omitempty"`
	OnTaskCreated func(taskID uint)      `json:"-"`
}

// NodeExecutionResult is the result of one node execution.
type NodeExecutionResult struct {
	NodeID     string      `json:"node_id"`
	Type       string      `json:"type"`
	Success    bool        `json:"success"`
	Data       interface{} `json:"data"`
	Error      string      `json:"error,omitempty"`
	ErrorStack string      `json:"errorStack,omitempty"`
}

// ExecutionResult is the final workflow execution result.
type ExecutionResult struct {
	Success bool                  `json:"success"`
	Results []NodeExecutionResult `json:"results"`
	Error   string                `json:"error,omitempty"`
}

// NewWorkflowExecutor creates a workflow executor.
func NewWorkflowExecutor() *WorkflowExecutor {
	modelRepo := aiRepos.NewAIModelRepository(database.DB)
	templateRepo := aiRepos.NewProviderTemplateRepository(database.DB)
	userRepo := userRepos.NewUserRepository(database.DB)
	pricingRepo := aiRepos.NewPricingConfigRepository(database.DB)
	capabilityRepo := aiRepos.NewCapabilityConfigRepository(database.DB)
	return &WorkflowExecutor{
		crawlerService:   crawlerService.NewCrawlerService(),
		datacleanService: datacleanService.NewDataCleanService(),
		aiService:        aiService.NewAIService(modelRepo, templateRepo, pricingRepo, capabilityRepo),
		userRepo:         userRepo,
		pricingService:   aiService.NewPricingService(pricingRepo),
	}
}

// Execute runs a workflow in non-stream mode.
func (e *WorkflowExecutor) Execute(req ExecutionRequest) (*ExecutionResult, error) {
	results := make([]NodeExecutionResult, 0)
	dataFlow := NewDataFlow(req.Edges)
	variableContext := NewVariableContext()
	execMeta := ExecutionMeta{
		UserID:       req.UserID,
		RuntimeInput: req.RuntimeInput,
		RuntimeMeta:  req.RuntimeMeta,
	}
	if req.WorkflowID > 0 {
		wid := req.WorkflowID
		execMeta.WorkflowID = &wid
	}

	startNodes := e.findStartNodes(req.Nodes, req.Edges)
	if len(startNodes) == 0 {
		return &ExecutionResult{
			Success: false,
			Error:   "未找到起始节点",
		}, fmt.Errorf("未找到起始节点")
	}

	executed := make(map[string]bool)
	nodeStatus := make(map[string]string)
	conditionResults := make(map[string]bool)
	queue := make([]string, 0, len(startNodes))
	workflowFailed := false

	findNodeConfig := func(nodeID string) *NodeConfig {
		for i := range req.Nodes {
			if req.Nodes[i].ID == nodeID {
				return &req.Nodes[i]
			}
		}
		return nil
	}

	evaluateNodeState := func(nodeID string) (string, string) {
		hasIncoming := false
		for _, edge := range req.Edges {
			if edge.Target != nodeID {
				continue
			}
			hasIncoming = true

			if !isEdgeActive(edge, req.Nodes, req.Edges, conditionResults, executed) {
				continue
			}
			if !executed[edge.Source] {
				return "waiting", ""
			}
			if nodeStatus[edge.Source] != "completed" {
				return "blocked", fmt.Sprintf("上游节点 %s 未成功执行", edge.Source)
			}
		}

		if !hasIncoming {
			return "ready", ""
		}
		return "ready", ""
	}

	var markNodeSkipped func(nodeID string, reason string)
	var enqueueTarget func(nodeID string)

	markNodeSkipped = func(nodeID string, reason string) {
		if executed[nodeID] {
			return
		}
		nodeConfig := findNodeConfig(nodeID)
		if nodeConfig == nil {
			return
		}

		results = append(results, NodeExecutionResult{
			NodeID:  nodeID,
			Type:    nodeConfig.Type,
			Success: false,
			Error:   reason,
		})
		executed[nodeID] = true
		nodeStatus[nodeID] = "skipped"

		for _, edge := range req.Edges {
			if edge.Source == nodeID {
				enqueueTarget(edge.Target)
			}
		}
	}

	enqueueTarget = func(nodeID string) {
		if executed[nodeID] {
			return
		}
		state, reason := evaluateNodeState(nodeID)
		switch state {
		case "ready":
			queue = append(queue, nodeID)
		case "blocked":
			markNodeSkipped(nodeID, reason)
		}
	}

	for _, node := range startNodes {
		queue = append(queue, node.ID)
	}

	for len(queue) > 0 {
		nodeID := queue[0]
		queue = queue[1:]

		if executed[nodeID] {
			continue
		}

		state, reason := evaluateNodeState(nodeID)
		switch state {
		case "waiting":
			continue
		case "blocked":
			markNodeSkipped(nodeID, reason)
			continue
		}

		nodeConfig := findNodeConfig(nodeID)
		if nodeConfig == nil {
			continue
		}

		variableContext.SetNodeType(nodeID, nodeConfig.Type)
		result := e.executeNodeSafely(*nodeConfig, dataFlow, variableContext, execMeta)
		results = append(results, result)

		executed[nodeID] = true
		if result.Success {
			nodeData := NewNodeData(result.Data)
			dataFlow.SetNodeOutput(nodeID, nodeData)
			variableContext.SetNodeOutput(nodeID, nodeData)
			nodeStatus[nodeID] = "completed"
		} else {
			nodeStatus[nodeID] = "failed"
			workflowFailed = true
		}

		if nodeConfig.Type == "condition" && result.Success {
			conditionResult := false
			if resultData, ok := result.Data.(map[string]interface{}); ok {
				if res, exists := resultData["result"]; exists {
					if boolRes, ok := res.(bool); ok {
						conditionResult = boolRes
					}
				}
			}
			conditionResults[nodeID] = conditionResult

			for _, edge := range req.Edges {
				if edge.Source != nodeID || executed[edge.Target] {
					continue
				}
				shouldExecute := false
				if edge.SourceHandle == "true" && conditionResult {
					shouldExecute = true
				} else if edge.SourceHandle == "false" && !conditionResult {
					shouldExecute = true
				} else if edge.SourceHandle == "" {
					shouldExecute = true
				}
				if shouldExecute {
					enqueueTarget(edge.Target)
				}
			}
			continue
		}

		for _, edge := range req.Edges {
			if edge.Source == nodeID {
				enqueueTarget(edge.Target)
			}
		}
	}

	changed := true
	for changed {
		changed = false
		for _, node := range req.Nodes {
			if executed[node.ID] {
				continue
			}
			state, reason := evaluateNodeState(node.ID)
			if state == "blocked" {
				markNodeSkipped(node.ID, reason)
				changed = true
			}
		}
	}

	for _, node := range req.Nodes {
		if !executed[node.ID] {
			markNodeSkipped(node.ID, "节点未满足执行条件，已跳过")
		}
	}

	return &ExecutionResult{
		Success: !workflowFailed,
		Results: results,
	}, nil
}

// isEdgeFromConditionBranch is the legacy helper used by the old stream executor.
func isEdgeFromConditionBranch(edge EdgeConfig, nodes []NodeConfig, edges []EdgeConfig, conditionResults map[string]bool, executed map[string]bool) bool {
	if executed[edge.Source] {
		return true
	}

	for _, sourceNode := range nodes {
		if sourceNode.ID == edge.Source && sourceNode.Type == "condition" {
			if conditionResult, exists := conditionResults[edge.Source]; exists {
				if edge.SourceHandle == "true" && !conditionResult {
					return false
				} else if edge.SourceHandle == "false" && conditionResult {
					return false
				}
			}
		}
	}

	for _, upstreamEdge := range edges {
		if upstreamEdge.Target == edge.Source {
			if !isEdgeFromConditionBranch(upstreamEdge, nodes, edges, conditionResults, executed) {
				return false
			}
		}
	}

	return true
}

// findStartNodes returns all nodes without incoming edges.
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

// executeNode dispatches to the concrete node executor.
func (e *WorkflowExecutor) executeNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext, meta ExecutionMeta) NodeExecutionResult {
	switch node.Type {
	case "start":
		return e.executeStartNode(node, dataFlow, meta)
	case "crawler":
		return e.executeCrawlerNode(node, dataFlow, variableContext)
	case "dataclean":
		return e.executeDataCleanNode(node, dataFlow, variableContext)
	case "ai":
		return e.executeAINode(node, dataFlow, variableContext, meta.UserID)
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
		return e.executeOutputNode(node, dataFlow, variableContext, meta)
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

// Node executors live in dedicated files:
// - executeCrawlerNode -> crawler_node.go
// - executeDataCleanNode -> dataclean_node.go
// - executeAINode -> ai_node.go
// - executeConditionNode -> condition_node.go
// - executeStartNode -> start_node.go
// - executeTransformNode -> transform_node.go
// - executeLoopNode -> loop_node.go
// - executeMergeNode -> merge_node.go
// - executeDelayNode -> delay_node.go
// - executeEndNode -> end_node.go
// - executeOutputNode -> output_node.go
