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
}

// NewRegistry 创建注册表并注册所有工具（需传入 Runner）
func NewRegistry(runner *Runner) *Registry {
	r := &Registry{runner: runner, handlers: make(map[string]ToolHandler)}
	if runner != nil {
		r.Register("search_knowledge", r.runSearchKnowledge)
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

// ToolNames 返回已注册的工具名列表
func (r *Registry) ToolNames() []string {
	names := make([]string, 0, len(r.handlers))
	for n := range r.handlers {
		names = append(names, n)
	}
	return names
}
