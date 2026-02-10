package tools

import (
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	workflowExecutor "yaolight-workshop/backend/modules/workflow/services"
)

// Runner 工具执行所需依赖（由 agentic 层注入）
type Runner struct {
	CapabilitiesService CapabilitiesProvider
	Repo                *alkaidRepos.AlkaidRepository
	WorkflowService     WorkflowServiceProvider
	Executor            *workflowExecutor.WorkflowExecutor
	// NodeSpecByType 按节点类型返回规格（由外部注入，避免 tools 依赖 services）
	NodeSpecByType func(nodeType string) (interface{}, error)
	// RequestContext 本次请求的上下文（如前端传入的 currentWorkflow），供 get_workflow 等工具按需使用
	RequestContext map[string]interface{}
}

// CapabilitiesProvider 能力说明提供者（避免循环依赖）
type CapabilitiesProvider interface {
	GetCapabilities() (interface{}, error)
}

// WorkflowServiceProvider 工作流服务提供者（仅暴露 alkaid 所需方法）
type WorkflowServiceProvider interface {
	GetWorkflowNodes(workflowID uint) (interface{}, error)
	SaveWorkflowNodes(workflowID uint, req interface{}) error
}
