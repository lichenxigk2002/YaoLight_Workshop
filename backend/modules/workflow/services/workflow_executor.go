package services

import (
	"context"
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
	crawlerService      *crawlerService.CrawlerService
	datacleanService    *datacleanService.DataCleanService
	aiService           *aiService.AIService
	userRepo            repository.UserRepository
	pricingService      *aiService.PricingService
	codeRuntimeRegistry *CodeRuntimeRegistry
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
	SourceHandle string `json:"sourceHandle,omitempty"`
	TargetHandle string `json:"targetHandle,omitempty"`
}

// ExecutionRequest is the workflow execution payload.
type ExecutionRequest struct {
	Nodes         []NodeConfig           `json:"nodes"`
	Edges         []EdgeConfig           `json:"edges"`
	UserID        uint                   `json:"userID,omitempty"`
	WorkflowID    uint                   `json:"workflowId,omitempty"`
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
		crawlerService:      crawlerService.NewCrawlerService(),
		datacleanService:    datacleanService.NewDataCleanService(),
		aiService:           aiService.NewAIService(modelRepo, templateRepo, pricingRepo, capabilityRepo),
		userRepo:            userRepo,
		pricingService:      aiService.NewPricingService(pricingRepo),
		codeRuntimeRegistry: NewDefaultCodeRuntimeRegistry(),
	}
}

// Execute runs a workflow in non-stream mode.
func (e *WorkflowExecutor) Execute(req ExecutionRequest) (*ExecutionResult, error) {
	return e.executeConcurrentWorkflow(req, concurrentRunOptions{ctx: context.Background()})
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
	case "code":
		return e.executeCodeNode(node, dataFlow, variableContext)
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
