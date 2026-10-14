package tools

import (
	"encoding/json"
	"fmt"
)

// ToolHandler 工具处理函数：入参为 JSON 解析后的 map 与 sessionID，返回结果对象、给用户看的结果摘要、错误
type ToolHandler func(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error)

// Registry 工具注册表，仅限 alkaid 模块内使用
type Registry struct {
	runner   *Runner
	handlers map[string]ToolHandler
	meta     map[string]ToolMeta
}

type ToolMeta struct {
	Name         string   `json:"name"`
	AllowedModes []string `json:"allowedModes"`
	Mutating     bool     `json:"mutating"`
	Description  string   `json:"description"`
}

// NewRegistry 创建注册表并注册所有工具（需传入 Runner）
func NewRegistry(runner *Runner) *Registry {
	r := &Registry{runner: runner, handlers: make(map[string]ToolHandler), meta: defaultToolMeta()}
	if runner != nil {
		r.Register("search_knowledge", r.runSearchKnowledge)
		r.Register("list_project_website_sources", r.runListProjectWebsiteSources)
		r.Register("check_url_accessibility", r.runCheckURLAccessibility)
		r.Register("get_capabilities", r.runGetCapabilities)
		r.Register("get_workflow", r.runGetWorkflow)
		r.Register("get_node_spec", r.runGetNodeSpec)
		r.Register("list_workflows", r.runListWorkflows)
		r.Register("get_available_models", r.runGetAvailableModels)
		r.Register("get_user_constraints", r.runGetUserConstraints)
		r.Register("validate_workflow", r.runValidateWorkflow)
		r.Register("run_workflow_trial", r.runRunWorkflowTrial)
		r.Register("propose_workflow", r.runProposeWorkflow)
		r.Register("propose_patch", r.runProposePatch)
	} else {
		// 无 runner 时使用占位
		r.Register("search_knowledge", toolSearchKnowledge)
		r.Register("list_project_website_sources", toolListProjectWebsiteSources)
		r.Register("check_url_accessibility", toolCheckURLAccessibility)
		r.Register("get_capabilities", toolGetCapabilities)
		r.Register("get_workflow", toolGetWorkflow)
		r.Register("get_node_spec", toolGetNodeSpec)
		r.Register("list_workflows", toolListWorkflows)
		r.Register("get_available_models", toolGetAvailableModels)
		r.Register("get_user_constraints", toolGetUserConstraints)
		r.Register("validate_workflow", toolValidateWorkflow)
		r.Register("run_workflow_trial", toolRunWorkflowTrial)
		r.Register("propose_workflow", toolProposeWorkflow)
		r.Register("propose_patch", toolProposePatch)
	}
	return r
}

// Register 注册一个工具
func (r *Registry) Register(name string, h ToolHandler) {
	r.handlers[name] = h
}

func (r *Registry) IsAllowed(mode string, name string) bool {
	meta, ok := r.meta[name]
	if !ok {
		return false
	}
	if len(meta.AllowedModes) == 0 {
		return true
	}
	for _, allowedMode := range meta.AllowedModes {
		if allowedMode == mode {
			return true
		}
	}
	return false
}

func (r *Registry) ToolMeta(name string) *ToolMeta {
	meta, ok := r.meta[name]
	if !ok {
		return nil
	}
	return &meta
}

// ExecuteTool 统一入口：根据工具名路由到对应实现
func (r *Registry) ExecuteTool(name string, paramsJSON string, sessionID uint) (result interface{}, resultSummary string, err error) {
	var params map[string]interface{}
	if paramsJSON != "" {
		if err := json.Unmarshal([]byte(paramsJSON), &params); err != nil {
			return nil, "", fmt.Errorf("工具参数 JSON 解析失败: %w", err)
		}
	}
	if params == nil {
		params = make(map[string]interface{})
	}

	h, ok := r.handlers[name]
	if !ok {
		return nil, "", fmt.Errorf("未知工具: %s", name)
	}
	return h(params, sessionID)
}

func (r *Registry) ExecuteToolForMode(mode string, name string, paramsJSON string, sessionID uint) (result interface{}, resultSummary string, err error) {
	if !r.IsAllowed(mode, name) {
		return nil, "", fmt.Errorf("工具 %s 不允许在 %s 模式执行", name, mode)
	}
	if r.runner != nil && !isToolEnabledForRunnerRequest(r.runner.RequestContext, name) {
		return nil, "", fmt.Errorf("工具 %s 已被当前会话设置禁用", name)
	}
	return r.ExecuteTool(name, paramsJSON, sessionID)
}

func defaultToolMeta() map[string]ToolMeta {
	return map[string]ToolMeta{
		"search_knowledge":             {Name: "search_knowledge", AllowedModes: []string{"chat", "explain", "generate", "repair"}, Mutating: false, Description: "Search Alkaid knowledge."},
		"list_project_website_sources": {Name: "list_project_website_sources", AllowedModes: []string{"chat", "explain", "generate", "repair"}, Mutating: false, Description: "List project website sources."},
		"check_url_accessibility":      {Name: "check_url_accessibility", AllowedModes: []string{"generate", "repair"}, Mutating: false, Description: "Check crawler source URL accessibility."},
		"get_capabilities":             {Name: "get_capabilities", AllowedModes: []string{"chat", "explain", "generate"}, Mutating: false, Description: "Get workflow capabilities."},
		"get_workflow":                 {Name: "get_workflow", AllowedModes: []string{"chat", "explain", "repair", "trial_debug"}, Mutating: false, Description: "Get current workflow."},
		"get_node_spec":                {Name: "get_node_spec", AllowedModes: []string{"chat", "explain", "generate", "repair", "trial_debug"}, Mutating: false, Description: "Get node specification."},
		"list_workflows":               {Name: "list_workflows", AllowedModes: []string{"chat", "explain", "repair", "trial_debug"}, Mutating: false, Description: "List workflows."},
		"get_available_models":         {Name: "get_available_models", AllowedModes: []string{"chat", "generate", "repair"}, Mutating: false, Description: "List available models."},
		"get_user_constraints":         {Name: "get_user_constraints", AllowedModes: []string{"generate", "repair"}, Mutating: false, Description: "Get user generation constraints."},
		"validate_workflow":            {Name: "validate_workflow", AllowedModes: []string{"generate", "repair", "trial_debug"}, Mutating: false, Description: "Validate workflow draft."},
		"run_workflow_trial":           {Name: "run_workflow_trial", AllowedModes: []string{"generate", "repair", "trial_debug"}, Mutating: false, Description: "Trial-run workflow draft."},
		"propose_workflow":             {Name: "propose_workflow", AllowedModes: []string{"generate", "repair"}, Mutating: true, Description: "Store pending workflow."},
		"propose_patch":                {Name: "propose_patch", AllowedModes: []string{"repair"}, Mutating: true, Description: "Store pending patch."},
	}
}

// ToolNames 返回已注册的工具名列表
func (r *Registry) ToolNames() []string {
	names := make([]string, 0, len(r.handlers))
	for n := range r.handlers {
		names = append(names, n)
	}
	return names
}

func isToolEnabledForRunnerRequest(requestContext map[string]interface{}, toolName string) bool {
	if requestContext == nil {
		return true
	}
	switch toolName {
	case "search_knowledge":
		return boolParam(requestContext, "allowKnowledgeTools", true)
	case "list_project_website_sources":
		return boolParam(requestContext, "allowWebsiteSourceTools", true)
	default:
		return true
	}
}
