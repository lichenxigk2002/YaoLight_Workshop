package tools

import "fmt"

// toolListWorkflows 占位（无 Runner 时使用）
func toolListWorkflows(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"workflows": []interface{}{}, "total": int64(0)}, "工作流列表占位", nil
}

// runListWorkflows 按当前会话用户分页列出工作流摘要（id、name、description、status）
func (r *Registry) runListWorkflows(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.Repo == nil || r.runner.WorkflowService == nil {
		return toolListWorkflows(params, sessionID)
	}
	session, err := r.runner.Repo.GetSessionByID(sessionID)
	if err != nil {
		return map[string]interface{}{"workflows": []interface{}{}, "total": int64(0)}, "获取会话失败", nil
	}
	page, pageSize := 1, 20
	if p, ok := params["page"].(float64); ok && p >= 1 {
		page = int(p)
	}
	if ps, ok := params["pageSize"].(float64); ok && ps >= 1 && ps <= 100 {
		pageSize = int(ps)
	}
	list, total, err := r.runner.WorkflowService.ListWorkflowsByUserID(session.UserID, page, pageSize)
	if err != nil {
		return map[string]interface{}{"workflows": []interface{}{}, "total": int64(0)}, "获取列表失败", nil
	}
	return map[string]interface{}{"workflows": list, "total": total}, fmt.Sprintf("共 %d 个工作流", total), nil
}
