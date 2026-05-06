package services

import (
	"errors"
	"fmt"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/task/models"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

var ErrNoResumableFailedNodes = errors.New("task has no resumable failed nodes")

func buildResumeExecutionState(
	sourceTaskID uint,
	nodes []workflowServices.NodeConfig,
	edges []workflowServices.EdgeConfig,
	executions []models.TaskNodeExecution,
) (*workflowServices.ResumeExecutionState, error) {
	nodeByID := make(map[string]workflowServices.NodeConfig, len(nodes))
	outgoing := make(map[string][]string, len(nodes))
	for _, node := range nodes {
		nodeByID[node.ID] = node
	}
	for _, edge := range edges {
		outgoing[edge.Source] = append(outgoing[edge.Source], edge.Target)
	}

	executionByNodeID := make(map[string]models.TaskNodeExecution, len(executions))
	rerunNodeIDs := make(map[string]bool)
	queue := make([]string, 0)
	for _, execution := range executions {
		if _, exists := nodeByID[execution.NodeID]; !exists {
			continue
		}
		executionByNodeID[execution.NodeID] = execution
		if isRetrySeedExecution(execution) {
			if !rerunNodeIDs[execution.NodeID] {
				rerunNodeIDs[execution.NodeID] = true
				queue = append(queue, execution.NodeID)
			}
		}
	}

	if len(rerunNodeIDs) == 0 {
		return nil, fmt.Errorf("%w: 该任务没有可续跑的失败节点", ErrNoResumableFailedNodes)
	}

	for len(queue) > 0 {
		nodeID := queue[0]
		queue = queue[1:]
		for _, target := range outgoing[nodeID] {
			if rerunNodeIDs[target] {
				continue
			}
			rerunNodeIDs[target] = true
			queue = append(queue, target)
		}
	}

	reusedNodes := make(map[string]workflowServices.ResumeNodeState)
	for _, node := range nodes {
		if rerunNodeIDs[node.ID] {
			continue
		}
		execution, ok := executionByNodeID[node.ID]
		if !ok || execution.Status != "completed" {
			continue
		}
		reusedNodes[node.ID] = workflowServices.ResumeNodeState{
			OutputData:    taskJSONBValue(execution.OutputData),
			HasOutputData: execution.OutputData != nil,
		}
	}

	return &workflowServices.ResumeExecutionState{
		Mode:         "resume_failed",
		SourceTaskID: sourceTaskID,
		ReusedNodes:  reusedNodes,
	}, nil
}

func isRetrySeedExecution(execution models.TaskNodeExecution) bool {
	switch execution.Status {
	case "failed", "timeout", "running":
		return true
	case "cancelled":
		return execution.StartedAt != nil
	default:
		return false
	}
}

func taskJSONBValue(data *shared.JSONB) interface{} {
	if data == nil {
		return nil
	}
	return data.Data
}
