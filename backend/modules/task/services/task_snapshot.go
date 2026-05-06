package services

import (
	"yaolight-workshop/backend/modules/task/models"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

func retryExecutionRequestFromSnapshot(task *models.Task) (workflowServices.ExecutionRequest, bool) {
	if task == nil || task.ExecutionContext == nil || task.ExecutionContext.Data == nil {
		return workflowServices.ExecutionRequest{}, false
	}

	contextMap, ok := task.ExecutionContext.Data.(map[string]interface{})
	if !ok {
		return workflowServices.ExecutionRequest{}, false
	}
	rawSnapshot, ok := contextMap["workflow_snapshot"]
	if !ok {
		return workflowServices.ExecutionRequest{}, false
	}
	snapshotMap, ok := rawSnapshot.(map[string]interface{})
	if !ok {
		return workflowServices.ExecutionRequest{}, false
	}

	rawNodes, ok := snapshotMap["nodes"].([]interface{})
	if !ok {
		return workflowServices.ExecutionRequest{}, false
	}
	nodes := make([]workflowServices.NodeConfig, 0, len(rawNodes))
	for _, item := range rawNodes {
		nodeMap, ok := item.(map[string]interface{})
		if !ok {
			return workflowServices.ExecutionRequest{}, false
		}
		nodeID, _ := nodeMap["id"].(string)
		nodeType, _ := nodeMap["type"].(string)
		config, _ := nodeMap["config"].(map[string]interface{})
		nodes = append(nodes, workflowServices.NodeConfig{
			ID:     nodeID,
			Type:   nodeType,
			Config: config,
		})
	}

	rawEdges, ok := snapshotMap["edges"].([]interface{})
	if !ok {
		return workflowServices.ExecutionRequest{}, false
	}
	edges := make([]workflowServices.EdgeConfig, 0, len(rawEdges))
	for _, item := range rawEdges {
		edgeMap, ok := item.(map[string]interface{})
		if !ok {
			return workflowServices.ExecutionRequest{}, false
		}
		edges = append(edges, workflowServices.EdgeConfig{
			Source:       asString(edgeMap["source"]),
			Target:       asString(edgeMap["target"]),
			SourceHandle: asString(edgeMap["sourceHandle"]),
			TargetHandle: asString(edgeMap["targetHandle"]),
		})
	}

	return workflowServices.ExecutionRequest{
		UserID:       task.UserID,
		WorkflowID:   task.WorkflowID,
		Nodes:        nodes,
		Edges:        edges,
		RuntimeInput: snapshotMap["runtimeInput"],
		RuntimeMeta:  asStringMap(snapshotMap["runtimeMeta"]),
	}, true
}

func asString(v interface{}) string {
	s, _ := v.(string)
	return s
}

func asStringMap(v interface{}) map[string]interface{} {
	if v == nil {
		return nil
	}
	m, _ := v.(map[string]interface{})
	return m
}
