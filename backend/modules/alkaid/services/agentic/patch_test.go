package agentic

import (
	"testing"

	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

func mockWorkflow(nodes []workflowSvc.WorkflowNodeData, edges []workflowSvc.EdgeData) *workflowSvc.SaveWorkflowNodesRequest {
	return &workflowSvc.SaveWorkflowNodesRequest{Nodes: nodes, Edges: edges}
}

func mockNode(id, typ string) workflowSvc.WorkflowNodeData {
	return workflowSvc.WorkflowNodeData{
		ID:       id,
		Type:     typ,
		Position: map[string]interface{}{"x": float64(0), "y": float64(0)},
		Data:     map[string]interface{}{"type": typ},
	}
}

func TestComputeWorkflowDiffEmitsSetEdgesWhenEdgesAreCleared(t *testing.T) {
	current := mockWorkflow(
		[]workflowSvc.WorkflowNodeData{mockNode("start-1", "start"), mockNode("ai-1", "ai")},
		[]workflowSvc.EdgeData{{ID: "start-1-ai-1", Source: "start-1", Target: "ai-1"}},
	)
	proposedNodes := []interface{}{
		map[string]interface{}{"id": "start-1", "type": "start", "position": map[string]interface{}{"x": float64(0), "y": float64(0)}, "data": map[string]interface{}{"type": "start"}},
		map[string]interface{}{"id": "ai-1", "type": "ai", "position": map[string]interface{}{"x": float64(0), "y": float64(0)}, "data": map[string]interface{}{"type": "ai"}},
	}

	patch, err := ComputeWorkflowDiff(current, proposedNodes, []interface{}{})
	if err != nil {
		t.Fatalf("ComputeWorkflowDiff returned error: %v", err)
	}
	if len(patch) != 1 || patch[0]["op"] != PatchOpSetEdges {
		t.Fatalf("expected one set_edges patch, got %#v", patch)
	}
	value, ok := patch[0]["value"].([]interface{})
	if !ok || len(value) != 0 {
		t.Fatalf("expected empty set_edges value, got %#v", patch[0]["value"])
	}
}

func TestApplyPatchToWorkflowKeepsParallelHandledEdgesDistinct(t *testing.T) {
	current := mockWorkflow(
		[]workflowSvc.WorkflowNodeData{
			mockNode("condition-1", "condition"),
			mockNode("merge-1", "merge"),
		},
		nil,
	)
	patch := []interface{}{
		map[string]interface{}{
			"op": PatchOpSetEdges,
			"value": []interface{}{
				map[string]interface{}{"source": "condition-1", "target": "merge-1", "sourceHandle": "true", "targetHandle": "input-0"},
				map[string]interface{}{"source": "condition-1", "target": "merge-1", "sourceHandle": "false", "targetHandle": "input-1"},
			},
		},
	}

	after, err := ApplyPatchToWorkflow(current, patch)
	if err != nil {
		t.Fatalf("ApplyPatchToWorkflow returned error: %v", err)
	}
	if len(after.Edges) != 2 {
		t.Fatalf("expected two edges, got %#v", after.Edges)
	}
	if after.Edges[0].ID != "condition-1-merge-1-true-input-0" || after.Edges[1].ID != "condition-1-merge-1-false-input-1" {
		t.Fatalf("expected handled fallback ids, got %#v", after.Edges)
	}
}

func TestApplyPatchToWorkflowFiltersDanglingSetEdges(t *testing.T) {
	current := mockWorkflow(
		[]workflowSvc.WorkflowNodeData{
			mockNode("start-1", "start"),
			mockNode("ai-1", "ai"),
		},
		[]workflowSvc.EdgeData{{ID: "old", Source: "start-1", Target: "ai-1"}},
	)
	patch := []interface{}{
		map[string]interface{}{
			"op": PatchOpSetEdges,
			"value": []interface{}{
				map[string]interface{}{"id": "start-1-ai-1", "source": "start-1", "target": "ai-1"},
				map[string]interface{}{"id": "start-1-missing-1", "source": "start-1", "target": "missing-1"},
				map[string]interface{}{"id": "empty-source", "source": "", "target": "ai-1"},
			},
		},
	}

	after, err := ApplyPatchToWorkflow(current, patch)
	if err != nil {
		t.Fatalf("ApplyPatchToWorkflow returned error: %v", err)
	}
	if len(after.Edges) != 1 || after.Edges[0].ID != "start-1-ai-1" {
		t.Fatalf("expected only valid edge, got %#v", after.Edges)
	}
}

func TestApplyPatchToWorkflowRemovesEdgesToNodesRemovedInSamePatch(t *testing.T) {
	current := mockWorkflow(
		[]workflowSvc.WorkflowNodeData{
			mockNode("start-1", "start"),
			mockNode("ai-1", "ai"),
			mockNode("output-1", "output"),
		},
		[]workflowSvc.EdgeData{{ID: "start-1-ai-1", Source: "start-1", Target: "ai-1"}},
	)
	patch := []interface{}{
		map[string]interface{}{"op": PatchOpRemove, "nodeId": "ai-1"},
		map[string]interface{}{
			"op": PatchOpSetEdges,
			"value": []interface{}{
				map[string]interface{}{"id": "start-1-ai-1", "source": "start-1", "target": "ai-1"},
				map[string]interface{}{"id": "start-1-output-1", "source": "start-1", "target": "output-1"},
			},
		},
	}

	after, err := ApplyPatchToWorkflow(current, patch)
	if err != nil {
		t.Fatalf("ApplyPatchToWorkflow returned error: %v", err)
	}
	if len(after.Nodes) != 2 {
		t.Fatalf("expected removed node to be gone, got %#v", after.Nodes)
	}
	if len(after.Edges) != 1 || after.Edges[0].ID != "start-1-output-1" {
		t.Fatalf("expected only edge to remaining node, got %#v", after.Edges)
	}
}
