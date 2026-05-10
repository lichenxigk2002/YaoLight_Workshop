package tools

import (
	"fmt"
	"sort"

	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

// toolRunWorkflowTrial 占位（无 Runner 时使用）
func toolRunWorkflowTrial(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	summary := "试跑不可用：未初始化工作流执行器"
	return map[string]interface{}{
		"success":     false,
		"level":       trialLevel(params),
		"unavailable": true,
		"error":       summary,
		"summary":     summary,
	}, summary, nil
}

// runRunWorkflowTrial 将 workflow 转为 ExecutionRequest 并调用执行器试跑
func (r *Registry) runRunWorkflowTrial(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.Executor == nil {
		return toolRunWorkflowTrial(params, sessionID)
	}
	workflow, ok := params["workflow"].(map[string]interface{})
	if !ok {
		return map[string]interface{}{"success": false, "level": trialLevel(params), "error": "缺少 workflow", "summary": "参数错误"}, "参数错误", nil
	}
	level := trialLevel(params)
	req := workflowToExecutionRequest(workflow, r.userIDForSession(sessionID))
	if level == "quick" {
		return runQuickWorkflowTrial(req)
	}
	res, err := r.runner.Executor.Execute(req)
	if err != nil {
		summary := "试跑失败: " + err.Error()
		return map[string]interface{}{"success": false, "level": level, "error": err.Error(), "summary": summary, "costEstimate": trialCostEstimate(level)}, summary, nil
	}
	if !res.Success {
		failedNodeID, failedNodeLabel, failedReason := firstFailedNode(res.Results)
		summary := "试跑未完全成功"
		if failedNodeID != "" {
			summary = fmt.Sprintf("试跑失败，失败节点: %s", failedNodeID)
		}
		if failedReason == "" {
			failedReason = res.Error
		}
		return map[string]interface{}{
			"success":         false,
			"level":           level,
			"results":         res.Results,
			"error":           res.Error,
			"failedNodeId":    failedNodeID,
			"failedNodeLabel": failedNodeLabel,
			"failedStage":     "node_execution",
			"reason":          failedReason,
			"summary":         summary,
			"costEstimate":    trialCostEstimate(level),
		}, summary, nil
	}
	summary := fmt.Sprintf("试跑成功，%d 个节点执行完成", len(res.Results))
	return map[string]interface{}{"success": true, "level": level, "results": res.Results, "summary": summary, "costEstimate": trialCostEstimate(level)}, summary, nil
}

func (r *Registry) userIDForSession(sessionID uint) uint {
	if r == nil || r.runner == nil || r.runner.Repo == nil {
		return sessionID
	}
	session, err := r.runner.Repo.GetSessionByID(sessionID)
	if err != nil || session == nil || session.UserID == 0 {
		return sessionID
	}
	return session.UserID
}

func runQuickWorkflowTrial(req workflowSvc.ExecutionRequest) (result interface{}, resultSummary string, err error) {
	issues := inspectWorkflowExecutionShape(req)
	notes := quickTrialNotes(req)
	if len(issues) > 0 {
		summary := fmt.Sprintf("快速检查发现 %d 处问题", len(issues))
		return map[string]interface{}{
			"success":      false,
			"level":        "quick",
			"dryRun":       true,
			"issues":       issues,
			"notes":        notes,
			"summary":      summary,
			"costEstimate": trialCostEstimate("quick"),
		}, summary, nil
	}

	summary := fmt.Sprintf("快速检查通过，%d 个节点可进入试跑前校验", len(req.Nodes))
	return map[string]interface{}{
		"success":      true,
		"level":        "quick",
		"dryRun":       true,
		"results":      quickTrialResults(req.Nodes),
		"notes":        notes,
		"summary":      summary,
		"costEstimate": trialCostEstimate("quick"),
	}, summary, nil
}

func inspectWorkflowExecutionShape(req workflowSvc.ExecutionRequest) []map[string]interface{} {
	issues := make([]map[string]interface{}, 0)
	nodeByID := make(map[string]workflowSvc.NodeConfig, len(req.Nodes))
	incoming := make(map[string]int, len(req.Nodes))
	outgoing := make(map[string]int, len(req.Nodes))
	knownTypes := map[string]struct{}{
		"start": {}, "crawler": {}, "dataclean": {}, "ai": {}, "condition": {},
		"transform": {}, "code": {}, "loop": {}, "merge": {}, "output": {}, "end": {}, "delay": {},
	}

	for i, node := range req.Nodes {
		if node.ID == "" {
			issues = append(issues, map[string]interface{}{"path": fmt.Sprintf("nodes[%d].id", i), "message": "节点缺少 id"})
			continue
		}
		if _, exists := nodeByID[node.ID]; exists {
			issues = append(issues, map[string]interface{}{"path": fmt.Sprintf("nodes[%d].id", i), "nodeId": node.ID, "message": "节点 id 重复"})
		}
		nodeByID[node.ID] = node
		if node.Type == "" {
			issues = append(issues, map[string]interface{}{"path": fmt.Sprintf("nodes[%d].type", i), "nodeId": node.ID, "message": "节点缺少 type"})
			continue
		}
		if _, ok := knownTypes[node.Type]; !ok {
			issues = append(issues, map[string]interface{}{"path": fmt.Sprintf("nodes[%d].type", i), "nodeId": node.ID, "message": "未知节点类型: " + node.Type})
		}
	}

	for i, edge := range req.Edges {
		if _, ok := nodeByID[edge.Source]; !ok {
			issues = append(issues, map[string]interface{}{"path": fmt.Sprintf("edges[%d].source", i), "nodeId": edge.Source, "message": "边的 source 节点不存在"})
		} else {
			outgoing[edge.Source]++
		}
		if _, ok := nodeByID[edge.Target]; !ok {
			issues = append(issues, map[string]interface{}{"path": fmt.Sprintf("edges[%d].target", i), "nodeId": edge.Target, "message": "边的 target 节点不存在"})
		} else {
			incoming[edge.Target]++
		}
	}

	if len(req.Nodes) > 1 {
		for _, node := range req.Nodes {
			if node.ID == "" {
				continue
			}
			if incoming[node.ID] == 0 && node.Type != "start" {
				issues = append(issues, map[string]interface{}{"path": "nodes", "nodeId": node.ID, "message": "节点没有上游输入"})
			}
			if outgoing[node.ID] == 0 && node.Type != "output" && node.Type != "end" {
				issues = append(issues, map[string]interface{}{"path": "nodes", "nodeId": node.ID, "message": "节点没有下游输出"})
			}
		}
	}

	return issues
}

func quickTrialNotes(req workflowSvc.ExecutionRequest) []string {
	notes := make([]string, 0)
	for _, node := range req.Nodes {
		if node.Type == "ai" && nodeUsesSystemModel(node) {
			notes = append(notes, "检测到系统预设 AI 节点；快速检查不会调用模型或校验余额，正式试跑/执行仍需要星尘余额。")
			break
		}
	}
	return notes
}

func quickTrialResults(nodes []workflowSvc.NodeConfig) []workflowSvc.NodeExecutionResult {
	results := make([]workflowSvc.NodeExecutionResult, 0, len(nodes))
	sorted := append([]workflowSvc.NodeConfig(nil), nodes...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].ID < sorted[j].ID })
	for _, node := range sorted {
		results = append(results, workflowSvc.NodeExecutionResult{
			NodeID:  node.ID,
			Type:    node.Type,
			Success: true,
			Data: map[string]interface{}{
				"dryRun":  true,
				"checked": "shape",
			},
		})
	}
	return results
}

func nodeUsesSystemModel(node workflowSvc.NodeConfig) bool {
	if node.Config == nil {
		return true
	}
	mode, _ := node.Config["modelMode"].(string)
	return mode == "" || mode == "system"
}

func trialLevel(params map[string]interface{}) string {
	level, _ := params["level"].(string)
	switch level {
	case "quick", "standard", "full":
		return level
	default:
		return "quick"
	}
}

func trialCostEstimate(level string) string {
	switch level {
	case "full":
		return "high"
	case "standard":
		return "medium"
	default:
		return "low"
	}
}

func firstFailedNode(results []workflowSvc.NodeExecutionResult) (nodeID string, nodeLabel string, reason string) {
	for _, result := range results {
		if result.Success {
			continue
		}
		return result.NodeID, result.Type, result.Error
	}
	return "", "", ""
}

func workflowToExecutionRequest(workflow map[string]interface{}, userID uint) workflowSvc.ExecutionRequest {
	nodes, _ := workflow["nodes"].([]interface{})
	edges, _ := workflow["edges"].([]interface{})
	nodeConfigs := make([]workflowSvc.NodeConfig, 0, len(nodes))
	for _, n := range nodes {
		node, _ := n.(map[string]interface{})
		id, _ := node["id"].(string)
		typ, _ := node["type"].(string)
		data, _ := node["data"].(map[string]interface{})
		config := map[string]interface{}{}
		if data != nil && data["config"] != nil {
			config, _ = data["config"].(map[string]interface{})
		}
		nodeConfigs = append(nodeConfigs, workflowSvc.NodeConfig{ID: id, Type: typ, Config: config})
	}
	edgeConfigs := make([]workflowSvc.EdgeConfig, 0, len(edges))
	for _, e := range edges {
		edge, _ := e.(map[string]interface{})
		src, _ := edge["source"].(string)
		tgt, _ := edge["target"].(string)
		sh, _ := edge["sourceHandle"].(string)
		th, _ := edge["targetHandle"].(string)
		edgeConfigs = append(edgeConfigs, workflowSvc.EdgeConfig{Source: src, Target: tgt, SourceHandle: sh, TargetHandle: th})
	}
	return workflowSvc.ExecutionRequest{Nodes: nodeConfigs, Edges: edgeConfigs, UserID: userID}
}
