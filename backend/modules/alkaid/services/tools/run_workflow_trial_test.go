package tools

import (
	"strings"
	"testing"

	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

func TestRunQuickWorkflowTrialDoesNotRequireBalance(t *testing.T) {
	req := workflowSvc.ExecutionRequest{
		UserID: 0,
		Nodes: []workflowSvc.NodeConfig{
			{ID: "start", Type: "start"},
			{ID: "ai", Type: "ai", Config: map[string]interface{}{"modelMode": "system"}},
			{ID: "end", Type: "end"},
		},
		Edges: []workflowSvc.EdgeConfig{
			{Source: "start", Target: "ai"},
			{Source: "ai", Target: "end"},
		},
	}

	result, summary, err := runQuickWorkflowTrial(req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !strings.Contains(summary, "快速检查通过") {
		t.Fatalf("unexpected summary: %s", summary)
	}

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}
	if success, _ := resultMap["success"].(bool); !success {
		t.Fatalf("expected success result: %#v", resultMap)
	}
	if dryRun, _ := resultMap["dryRun"].(bool); !dryRun {
		t.Fatalf("expected dryRun result: %#v", resultMap)
	}
	notes, _ := resultMap["notes"].([]string)
	if len(notes) == 0 || !strings.Contains(notes[0], "不会调用模型或校验余额") {
		t.Fatalf("expected system AI dry-run note, got %#v", notes)
	}
}

func TestInspectWorkflowExecutionShapeReportsBrokenEdges(t *testing.T) {
	req := workflowSvc.ExecutionRequest{
		Nodes: []workflowSvc.NodeConfig{
			{ID: "start", Type: "start"},
			{ID: "ai", Type: "ai"},
		},
		Edges: []workflowSvc.EdgeConfig{
			{Source: "start", Target: "missing"},
		},
	}

	issues := inspectWorkflowExecutionShape(req)
	if len(issues) == 0 {
		t.Fatal("expected broken edge issues")
	}

	var foundMissingTarget bool
	for _, issue := range issues {
		if strings.Contains(issue["message"].(string), "target 节点不存在") {
			foundMissingTarget = true
			break
		}
	}
	if !foundMissingTarget {
		t.Fatalf("expected missing target issue, got %#v", issues)
	}
}
