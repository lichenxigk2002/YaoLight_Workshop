package tools

import "fmt"

// toolProposePatch 占位（无 Runner 时使用）
func toolProposePatch(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"status": "pending_approval", "message": "请在前端确认应用（占位）"}, "已提出补丁（占位）", nil
}

// runProposePatch 写入 session.pendingPatch，不写画布
func (r *Registry) runProposePatch(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.Repo == nil {
		return toolProposePatch(params, sessionID)
	}
	session, err := r.runner.Repo.GetSessionByID(sessionID)
	if err != nil {
		return nil, "", err
	}
	patch, _ := params["patch"].([]interface{})
	if patch == nil {
		return map[string]interface{}{"status": "error", "message": "缺少 patch"}, "参数错误", nil
	}
	session.PendingPatchJSON.Data = patch
	if err := r.runner.Repo.UpdateSession(session); err != nil {
		return nil, "", err
	}
	return map[string]interface{}{"status": "pending_approval", "message": "已提出修改，请在前端确认应用"}, fmt.Sprintf("已提出 %d 处修改，等待用户确认", len(patch)), nil
}
