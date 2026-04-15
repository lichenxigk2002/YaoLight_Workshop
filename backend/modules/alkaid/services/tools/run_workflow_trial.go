package tools

import (
	"fmt"

	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

// toolRunWorkflowTrial 占位（无 Runner 时使用）
func toolRunWorkflowTrial(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"placeholder": true}, "试跑占位", nil
}

// runRunWorkflowTrial 将 workflow 转为 ExecutionRequest 并调用执行器试跑
func (r *Registry) runRunWorkflowTrial(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.Executor == nil {
		return toolRunWorkflowTrial(params, sessionID)
	}
	workflow, ok := params["workflow"].(map[string]interface{})
	if !ok {
		return map[string]interface{}{"success": false, "error": "缺少 workflow"}, "参数错误", nil
	}
	req := workflowToExecutionRequest(workflow, sessionID)
	res, err := r.runner.Executor.Execute(req)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}, "试跑失败: " + err.Error(), nil
	}
	if !res.Success {
		return map[string]interface{}{"success": false, "results": res.Results, "error": res.Error}, "试跑未完全成功", nil
	}
	return map[string]interface{}{"success": true, "results": res.Results}, fmt.Sprintf("试跑成功，%d 个节点执行完成", len(res.Results)), nil
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
