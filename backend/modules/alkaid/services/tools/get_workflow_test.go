package tools

import (
	"testing"

	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

func TestBuildWorkflowLLMViewPreservesAllNodesAndEdges(t *testing.T) {
	description := "test workflow"
	meta := &workflowModels.Workflow{
		ID:          7,
		Name:        "复杂工作流",
		Description: &description,
		Status:      "draft",
		Version:     "1.0.0",
	}
	graph := &workflowSvc.SaveWorkflowNodesRequest{
		Nodes: []workflowSvc.WorkflowNodeData{
			{ID: "start-1", Type: "start", Data: map[string]interface{}{"label": "开始", "config": map[string]interface{}{"trigger": "manual"}}},
			{ID: "crawler-1", Type: "crawler", Data: map[string]interface{}{"label": "抓取 A", "config": map[string]interface{}{"urlVariable": "{{start-1.data.urlA}}"}}},
			{ID: "crawler-2", Type: "crawler", Data: map[string]interface{}{"label": "抓取 B", "config": map[string]interface{}{"urlVariable": "{{start-1.data.urlB}}"}}},
			{ID: "merge-1", Type: "merge", Data: map[string]interface{}{"label": "合并", "config": map[string]interface{}{"mode": "append"}}},
			{ID: "end-1", Type: "end", Data: map[string]interface{}{"label": "结束", "config": map[string]interface{}{"action": "none"}}},
		},
		Edges: []workflowSvc.EdgeData{
			{ID: "e1", Source: "start-1", Target: "crawler-1"},
			{ID: "e2", Source: "start-1", Target: "crawler-2"},
			{ID: "e3", Source: "crawler-1", Target: "merge-1"},
			{ID: "e4", Source: "crawler-2", Target: "merge-1"},
			{ID: "e5", Source: "merge-1", Target: "end-1"},
		},
	}

	view, summary := buildWorkflowLLMView(meta, graph)

	if view.NodeCount != 5 || summary.NodeCount != 5 {
		t.Fatalf("expected 5 nodes, got view=%d summary=%d", view.NodeCount, summary.NodeCount)
	}
	if view.EdgeCount != 5 || summary.EdgeCount != 5 {
		t.Fatalf("expected 5 edges, got view=%d summary=%d", view.EdgeCount, summary.EdgeCount)
	}
	if got := view.NodeTypeCounts["crawler"]; got != 2 {
		t.Fatalf("expected 2 crawler nodes, got %d", got)
	}
	if len(view.TraversalHints.BranchNodeIDs) != 1 || view.TraversalHints.BranchNodeIDs[0] != "start-1" {
		t.Fatalf("expected start-1 to be the only branch node, got %+v", view.TraversalHints.BranchNodeIDs)
	}
	if len(view.TraversalHints.MergeNodeIDs) != 1 || view.TraversalHints.MergeNodeIDs[0] != "merge-1" {
		t.Fatalf("expected merge-1 to be the only merge node, got %+v", view.TraversalHints.MergeNodeIDs)
	}
	if len(view.Nodes) != 5 {
		t.Fatalf("expected llm view to contain every node, got %d", len(view.Nodes))
	}
	if len(view.Edges) != 5 {
		t.Fatalf("expected llm view to contain every edge, got %d", len(view.Edges))
	}
	if view.Name != meta.Name || view.WorkflowID != meta.ID {
		t.Fatalf("expected workflow metadata to be preserved, got name=%q id=%d", view.Name, view.WorkflowID)
	}

	var mergeNode *workflowLLMNodeView
	for i := range view.Nodes {
		if view.Nodes[i].ID == "merge-1" {
			mergeNode = &view.Nodes[i]
			break
		}
	}
	if mergeNode == nil {
		t.Fatalf("expected merge-1 to exist in llm view")
	}
	if len(mergeNode.Incoming) != 2 {
		t.Fatalf("expected merge-1 to have 2 incoming nodes, got %d", len(mergeNode.Incoming))
	}
}
