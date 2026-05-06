package services

import (
	"errors"
	"testing"
	"time"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/task/models"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

func TestBuildResumeExecutionStateDoesNotSeedUnreachedCancelledBranch(t *testing.T) {
	now := time.Now()
	nodes := []workflowServices.NodeConfig{
		{ID: "start", Type: "start"},
		{ID: "cond", Type: "condition"},
		{ID: "true-ai", Type: "ai"},
		{ID: "false-ai", Type: "ai"},
	}
	edges := []workflowServices.EdgeConfig{
		{Source: "start", Target: "cond"},
		{Source: "cond", Target: "true-ai", SourceHandle: "true"},
		{Source: "cond", Target: "false-ai", SourceHandle: "false"},
	}
	executions := []models.TaskNodeExecution{
		{NodeID: "start", Status: "completed", OutputData: &shared.JSONB{Data: map[string]interface{}{"payload": 1}}},
		{NodeID: "cond", Status: "completed", OutputData: &shared.JSONB{Data: map[string]interface{}{"result": true}}},
		{NodeID: "true-ai", Status: "cancelled", StartedAt: &now},
		{NodeID: "false-ai", Status: "cancelled"},
	}

	resumeState, err := buildResumeExecutionState(1, nodes, edges, executions)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resumeState.IsReused("false-ai") {
		t.Fatalf("inactive false branch should not be reused")
	}
	if resumeState.IsReused("true-ai") {
		t.Fatalf("cancelled running node should rerun")
	}
}

func TestBuildResumeExecutionStateReturnsSentinelWhenNoResumableNodes(t *testing.T) {
	nodes := []workflowServices.NodeConfig{
		{ID: "start", Type: "start"},
		{ID: "ai-1", Type: "ai"},
	}
	edges := []workflowServices.EdgeConfig{
		{Source: "start", Target: "ai-1"},
	}
	executions := []models.TaskNodeExecution{
		{NodeID: "start", Status: "completed", OutputData: &shared.JSONB{Data: map[string]interface{}{"payload": 1}}},
		{NodeID: "ai-1", Status: "cancelled"},
	}

	_, err := buildResumeExecutionState(1, nodes, edges, executions)
	if err == nil {
		t.Fatal("expected no-resumable-nodes error")
	}
	if !errors.Is(err, ErrNoResumableFailedNodes) {
		t.Fatalf("expected sentinel error, got %v", err)
	}
}
