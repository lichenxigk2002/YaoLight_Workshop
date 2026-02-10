package tools

import (
	"fmt"

	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

// toolGetWorkflow 占位（无 Runner 时使用）
func toolGetWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"workflow": nil}, "当前无画布（占位）", nil
}

// runGetWorkflow 从请求上下文或会话关联的 workflowId 读取画布节点/边（LLM 按需调用时优先用前端传入的当前画布）
func (r *Registry) runGetWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner != nil && r.runner.RequestContext != nil {
		if cw := r.runner.RequestContext["currentWorkflow"]; cw != nil {
			return map[string]interface{}{"workflow": cw}, "已获取当前画布工作流（来自前端）", nil
		}
	}
	if r.runner == nil || r.runner.Repo == nil {
		return toolGetWorkflow(params, sessionID)
	}
	session, err := r.runner.Repo.GetSessionByID(sessionID)
	if err != nil || session.WorkflowID == nil || *session.WorkflowID == 0 {
		return map[string]interface{}{"workflow": nil}, "当前无画布", nil
	}
	if r.runner.WorkflowService == nil {
		return map[string]interface{}{"workflow": nil}, "当前无画布", nil
	}
	nodesResp, err := r.runner.WorkflowService.GetWorkflowNodes(*session.WorkflowID)
	if err != nil {
		return map[string]interface{}{"workflow": nil, "error": err.Error()}, "获取画布失败", nil
	}
	n := 0
	if req, ok := nodesResp.(*workflowSvc.SaveWorkflowNodesRequest); ok {
		n = len(req.Nodes)
	}
	return map[string]interface{}{"workflow": nodesResp}, fmt.Sprintf("当前画布共 %d 节点", n), nil
}
