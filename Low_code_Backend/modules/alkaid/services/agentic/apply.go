package agentic

import (
	"fmt"

	"yaolight-workshop/backend/infrastructure/database"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

// ApplyWorkflowRequest 应用工作流请求
type ApplyWorkflowRequest struct {
	SessionID  uint
	UserID     uint
	WorkflowID uint // 可选，若为 0 则用 session.WorkflowID
}

// ApplyWorkflow 将会话的 pendingWorkflow 写入画布并清空 pending
func ApplyWorkflow(req ApplyWorkflowRequest) error {
	repo := alkaidRepos.NewAlkaidRepository()
	session, err := repo.GetSessionByID(req.SessionID)
	if err != nil {
		return err
	}
	if session.UserID != req.UserID {
		return fmt.Errorf("无权操作该会话")
	}
	if session.PendingWorkflowJSON.Data == nil {
		return fmt.Errorf("无待应用的工作流")
	}
	workflowID := req.WorkflowID
	if workflowID == 0 && session.WorkflowID != nil {
		workflowID = *session.WorkflowID
	}
	if workflowID == 0 {
		return fmt.Errorf("未关联工作流，无法应用")
	}

	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	workflowService := workflowSvc.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo)
	wf, err := workflowService.GetWorkflowByID(workflowID)
	if err != nil {
		return err
	}
	if wf.UserID != req.UserID {
		return fmt.Errorf("无该工作流操作权限")
	}

	allow, reason, err := CallBeforeApplyWorkflow(req.SessionID, workflowID, req.UserID)
	if err != nil {
		return fmt.Errorf("Hook 调用失败: %w", err)
	}
	if !allow {
		return fmt.Errorf("操作被拒绝: %s", reason)
	}

	// 将 pending 转为 SaveWorkflowNodesRequest
	data, ok := session.PendingWorkflowJSON.Data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("待应用数据格式错误")
	}
	nodesRaw, _ := data["nodes"].([]interface{})
	edgesRaw, _ := data["edges"].([]interface{})
	nodes := make([]workflowSvc.WorkflowNodeData, 0, len(nodesRaw))
	for _, n := range nodesRaw {
		node, _ := n.(map[string]interface{})
		nodes = append(nodes, mapToNodeData(node))
	}
	edges := make([]workflowSvc.EdgeData, 0, len(edgesRaw))
	for _, e := range edgesRaw {
		edge, _ := e.(map[string]interface{})
		edges = append(edges, mapToEdgeData(edge))
	}
	saveReq := &workflowSvc.SaveWorkflowNodesRequest{Nodes: nodes, Edges: edges}
	if err := workflowService.SaveWorkflowNodes(workflowID, saveReq); err != nil {
		return err
	}

	session.PendingWorkflowJSON.Data = nil
	return repo.UpdateSession(session)
}

func mapToNodeData(node map[string]interface{}) workflowSvc.WorkflowNodeData {
	position, _ := node["position"].(map[string]interface{})
	if position == nil {
		position = map[string]interface{}{"x": 0, "y": 0}
	}
	data, _ := node["data"].(map[string]interface{})
	if data == nil {
		data = map[string]interface{}{}
	}
	id, _ := node["id"].(string)
	typ, _ := node["type"].(string)
	return workflowSvc.WorkflowNodeData{
		ID:       id,
		Type:     typ,
		Position: position,
		Data:     data,
	}
}

func mapToEdgeData(edge map[string]interface{}) workflowSvc.EdgeData {
	id, _ := edge["id"].(string)
	src, _ := edge["source"].(string)
	tgt, _ := edge["target"].(string)
	sh, _ := edge["sourceHandle"].(string)
	th, _ := edge["targetHandle"].(string)
	if id == "" {
		id = src + "-" + tgt
	}
	return workflowSvc.EdgeData{ID: id, Source: src, Target: tgt, SourceHandle: sh, TargetHandle: th}
}

// ApplyPatchRequest 应用补丁请求
type ApplyPatchRequest struct {
	SessionID  uint
	UserID     uint
	WorkflowID uint
}

// ApplyPatch 将会话的 pendingPatch 应用到画布并清空 pending（简化：仅清空 pending，实际应用 patch 可后续对接）
func ApplyPatch(req ApplyPatchRequest) error {
	repo := alkaidRepos.NewAlkaidRepository()
	session, err := repo.GetSessionByID(req.SessionID)
	if err != nil {
		return err
	}
	if session.UserID != req.UserID {
		return fmt.Errorf("无权操作该会话")
	}
	if session.PendingPatchJSON.Data == nil {
		return fmt.Errorf("无待应用的补丁")
	}
	workflowID := req.WorkflowID
	if workflowID == 0 && session.WorkflowID != nil {
		workflowID = *session.WorkflowID
	}
	if workflowID == 0 {
		return fmt.Errorf("未关联工作流，无法应用补丁")
	}
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	workflowService := workflowSvc.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo)
	wf, err := workflowService.GetWorkflowByID(workflowID)
	if err != nil {
		return err
	}
	if wf.UserID != req.UserID {
		return fmt.Errorf("无该工作流操作权限")
	}

	current, err := workflowService.GetWorkflowNodes(workflowID)
	if err != nil {
		return err
	}
	patchList, err := PatchFromSession(session.PendingPatchJSON.Data)
	if err != nil {
		return err
	}
	after, err := ApplyPatchToWorkflow(current, patchList)
	if err != nil {
		return fmt.Errorf("应用补丁失败: %w", err)
	}
	if err := workflowService.SaveWorkflowNodes(workflowID, after); err != nil {
		return err
	}

	session.PendingPatchJSON.Data = nil
	return repo.UpdateSession(session)
}
