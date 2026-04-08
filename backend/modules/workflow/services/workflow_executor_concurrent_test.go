package services

import (
	"testing"
	"time"
)

func TestExecuteRunsIndependentBranchesConcurrently(t *testing.T) {
	exec := NewWorkflowExecutor()
	req := ExecutionRequest{
		Nodes: []NodeConfig{
			{ID: "start", Type: "start", Config: map[string]interface{}{}},
			{ID: "d1", Type: "delay", Config: map[string]interface{}{"seconds": 1}},
			{ID: "d2", Type: "delay", Config: map[string]interface{}{"seconds": 1}},
			{ID: "d3", Type: "delay", Config: map[string]interface{}{"seconds": 1}},
		},
		Edges: []EdgeConfig{
			{Source: "start", Target: "d1"},
			{Source: "start", Target: "d2"},
			{Source: "start", Target: "d3"},
		},
	}

	startedAt := time.Now()
	result, err := exec.Execute(req)
	elapsed := time.Since(startedAt)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got %#v", result)
	}
	if elapsed >= 2500*time.Millisecond {
		t.Fatalf("expected concurrent execution under 2.5s, got %v", elapsed)
	}
}

func TestExecuteConditionMergeDoesNotDeadlock(t *testing.T) {
	exec := NewWorkflowExecutor()
	req := ExecutionRequest{
		RuntimeInput: map[string]interface{}{
			"flag": false,
		},
		Nodes: []NodeConfig{
			{ID: "start", Type: "start", Config: map[string]interface{}{}},
			{ID: "cond", Type: "condition", Config: map[string]interface{}{"field": "flag", "operator": "==", "value": true}},
			{ID: "trueDelay", Type: "delay", Config: map[string]interface{}{"seconds": 1}},
			{ID: "falseDelay", Type: "delay", Config: map[string]interface{}{"seconds": 1}},
			{ID: "merge", Type: "merge", Config: map[string]interface{}{"mergeType": "concat", "inputCount": 2}},
		},
		Edges: []EdgeConfig{
			{Source: "start", Target: "cond"},
			{Source: "cond", Target: "trueDelay", SourceHandle: "true"},
			{Source: "cond", Target: "falseDelay", SourceHandle: "false"},
			{Source: "trueDelay", Target: "merge", TargetHandle: "input-0"},
			{Source: "falseDelay", Target: "merge", TargetHandle: "input-1"},
		},
	}

	result, err := exec.Execute(req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got %#v", result)
	}

	seenMerge := false
	for _, nodeResult := range result.Results {
		if nodeResult.NodeID == "merge" {
			seenMerge = true
			if !nodeResult.Success {
				t.Fatalf("expected merge success, got %#v", nodeResult)
			}
		}
	}
	if !seenMerge {
		t.Fatalf("expected merge node to execute")
	}
}
