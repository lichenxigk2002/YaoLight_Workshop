package tools

import (
	"encoding/json"
	"fmt"
)

// toolProposeWorkflow 占位（无 Runner 时使用）
func toolProposeWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"status": "pending_approval", "message": "请在前端确认应用（占位）"}, "已提出工作流（占位）", nil
}

// runProposeWorkflow 写入 session.pendingWorkflow，不写画布
func (r *Registry) runProposeWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.Repo == nil {
		return toolProposeWorkflow(params, sessionID)
	}
	workflow := extractWorkflowFromProposeParams(params)
	if workflow == nil {
		return map[string]interface{}{"status": "error", "message": "缺少 workflow"}, "参数错误", nil
	}
	if err := r.runner.Repo.SavePendingWorkflow(sessionID, workflow); err != nil {
		return nil, "", err
	}
	nodeCount, edgeCount := 0, 0
	if w, ok := workflow.(map[string]interface{}); ok {
		if n, ok := w["nodes"].([]interface{}); ok {
			nodeCount = len(n)
		}
		if e, ok := w["edges"].([]interface{}); ok {
			edgeCount = len(e)
		}
	}
	return map[string]interface{}{"status": "pending_approval", "message": "已生成工作流，请在前端确认应用"}, fmt.Sprintf("已提出工作流，共 %d 节点 %d 边，等待用户确认", nodeCount, edgeCount), nil
}

func extractWorkflowFromProposeParams(params map[string]interface{}) interface{} {
	if workflow := params["workflow"]; workflow != nil {
		return workflow
	}
	draft, _ := params["draft"].(map[string]interface{})
	if draft == nil {
		return nil
	}
	if workflow, ok := draft["workflow"].(map[string]interface{}); ok {
		return workflow
	}
	workflowJSON, _ := draft["workflowJson"].(string)
	if workflowJSON == "" {
		workflowJSON, _ = draft["WorkflowJSON"].(string)
	}
	if workflowJSON == "" {
		return nil
	}
	var workflow map[string]interface{}
	if err := json.Unmarshal([]byte(workflowJSON), &workflow); err != nil {
		return nil
	}
	return workflow
}
