package tools

import (
	"fmt"

	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

// toolRunWorkflowTrial 占位（无 Runner 时使用）
func toolRunWorkflowTrial(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"success": true, "level": "quick", "placeholder": true, "summary": "试跑占位"}, "试跑占位", nil
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
	req := workflowToExecutionRequest(workflow, sessionID)
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
