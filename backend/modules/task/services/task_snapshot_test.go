package services

import (
	"testing"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/task/models"
)

func TestRetryExecutionRequestFromSnapshot(t *testing.T) {
	task := &models.Task{
		UserID:     9,
		WorkflowID: 21,
		ExecutionContext: &shared.JSONB{Data: map[string]interface{}{
			"workflow_snapshot": map[string]interface{}{
				"nodes": []interface{}{
					map[string]interface{}{
						"id":     "start",
						"type":   "start",
						"config": map[string]interface{}{"inputData": "hello"},
					},
					map[string]interface{}{
						"id":     "ai-1",
						"type":   "ai",
						"config": map[string]interface{}{"prompt": "x"},
					},
				},
				"edges": []interface{}{
					map[string]interface{}{
						"source": "start",
						"target": "ai-1",
					},
				},
				"runtimeInput": map[string]interface{}{
					"payload": "from-api",
				},
				"runtimeMeta": map[string]interface{}{
					"source": "open_api",
				},
			},
		}},
	}

	req, ok := retryExecutionRequestFromSnapshot(task)
	if !ok {
		t.Fatal("expected snapshot to build execution request")
	}
	if req.UserID != 9 || req.WorkflowID != 21 {
		t.Fatalf("unexpected request identity: %#v", req)
	}
	if len(req.Nodes) != 2 || req.Nodes[1].ID != "ai-1" {
		t.Fatalf("unexpected nodes: %#v", req.Nodes)
	}
	if len(req.Edges) != 1 || req.Edges[0].Target != "ai-1" {
		t.Fatalf("unexpected edges: %#v", req.Edges)
	}
	inputMap, ok := req.RuntimeInput.(map[string]interface{})
	if !ok || inputMap["payload"] != "from-api" {
		t.Fatalf("unexpected runtime input: %#v", req.RuntimeInput)
	}
	if req.RuntimeMeta["source"] != "open_api" {
		t.Fatalf("unexpected runtime meta: %#v", req.RuntimeMeta)
	}
}
