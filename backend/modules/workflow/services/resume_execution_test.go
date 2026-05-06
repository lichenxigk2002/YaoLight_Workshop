package services

import (
	"testing"
)

func TestExecuteConcurrentWorkflowReusesCompletedNodes(t *testing.T) {
	exec := NewWorkflowExecutor()
	req := ExecutionRequest{
		Nodes: []NodeConfig{
			{ID: "start", Type: "start", Config: map[string]interface{}{}},
			{ID: "cond", Type: "condition", Config: map[string]interface{}{"field": "flag", "operator": "==", "value": true}},
			{ID: "trueDelay", Type: "delay", Config: map[string]interface{}{"seconds": 0}},
			{ID: "falseDelay", Type: "delay", Config: map[string]interface{}{"seconds": 0}},
		},
		Edges: []EdgeConfig{
			{Source: "start", Target: "cond"},
			{Source: "cond", Target: "trueDelay", SourceHandle: "true"},
			{Source: "cond", Target: "falseDelay", SourceHandle: "false"},
		},
		ResumeState: &ResumeExecutionState{
			Mode:         "resume_failed",
			SourceTaskID: 1,
			ReusedNodes: map[string]ResumeNodeState{
				"start": {OutputData: map[string]interface{}{"flag": true}, HasOutputData: true},
				"cond":  {OutputData: map[string]interface{}{"result": true}, HasOutputData: true},
			},
		},
	}

	result, err := exec.Execute(req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got %#v", result)
	}

	statusByNode := map[string]bool{}
	for _, item := range result.Results {
		statusByNode[item.NodeID] = item.Success
	}

	if !statusByNode["trueDelay"] {
		t.Fatalf("expected true branch to execute")
	}
	if statusByNode["falseDelay"] {
		t.Fatalf("expected false branch not to execute successfully")
	}
}
