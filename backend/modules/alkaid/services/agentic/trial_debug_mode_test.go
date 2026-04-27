package agentic

import (
	"strings"
	"testing"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

func TestWorkflowMapFromGetWorkflowResultAddsVersionAndEdges(t *testing.T) {
	workflow := workflowMapFromGetWorkflowResult(map[string]interface{}{
		"workflow": map[string]interface{}{
			"nodes": []interface{}{map[string]interface{}{"id": "start-1", "type": "start"}},
		},
	})

	if workflow == nil {
		t.Fatalf("expected workflow map")
	}
	if workflow["version"] != "1.0.0" {
		t.Fatalf("expected default version, got %#v", workflow["version"])
	}
	if _, ok := workflow["edges"].([]interface{}); !ok {
		t.Fatalf("expected default edges array, got %#v", workflow["edges"])
	}
}

func TestTrialDebugNarrativeIncludesFailedNode(t *testing.T) {
	got := trialDebugNarrative(alkaidModels.TrialReport{
		Success:         false,
		FailedNodeID:    "ai-1",
		FailedNodeLabel: "AI 总结",
		Observations:    []string{"模型未配置"},
	})

	if !strings.Contains(got, "AI 总结") {
		t.Fatalf("expected failed node label in narrative, got %q", got)
	}
	if !strings.Contains(got, "模型未配置") {
		t.Fatalf("expected reason in narrative, got %q", got)
	}
}
