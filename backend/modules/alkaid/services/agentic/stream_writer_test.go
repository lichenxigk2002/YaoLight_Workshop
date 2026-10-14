package agentic

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

func TestSSEWriterEmitsEventsInExpectedOrder(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	writer := NewSSEWriter(ctx, 0, 42, "inspect my workflow", 0)

	if err := writer.WritePhaseChanged(alkaidModels.PhasePlanning); err != nil {
		t.Fatalf("WritePhaseChanged failed: %v", err)
	}
	if err := writer.WriteInteractionMode("analyze", "inspect current workflow", false); err != nil {
		t.Fatalf("WriteInteractionMode failed: %v", err)
	}
	if err := writer.WriteToolStepStarted("step-1", "get_workflow", alkaidModels.PhasePlanning); err != nil {
		t.Fatalf("WriteToolStepStarted failed: %v", err)
	}
	if err := writer.WriteToolStepFinished("step-1", alkaidModels.ToolStepSuccess, "workflow loaded", ""); err != nil {
		t.Fatalf("WriteToolStepFinished failed: %v", err)
	}
	if err := writer.WritePendingWorkflow(6, 5); err != nil {
		t.Fatalf("WritePendingWorkflow failed: %v", err)
	}
	if err := writer.WritePendingPatch(2, &alkaidModels.PendingPatchSummary{
		UpdatedNodeIDs: []string{"node-1"},
	}); err != nil {
		t.Fatalf("WritePendingPatch failed: %v", err)
	}
	if err := writer.WriteDone(); err != nil {
		t.Fatalf("WriteDone failed: %v", err)
	}

	body := recorder.Body.String()
	expectedEvents := []string{
		"event: phase_changed",
		"event: interaction_mode",
		"event: tool_step_started",
		"event: tool_step_finished",
		"event: pending_workflow",
		"event: pending_patch",
		"event: done",
	}

	lastIndex := -1
	for _, event := range expectedEvents {
		idx := strings.Index(body, event)
		if idx == -1 {
			t.Fatalf("expected SSE stream to contain %q, body: %s", event, body)
		}
		if idx <= lastIndex {
			t.Fatalf("expected %q to appear after previous events, body: %s", event, body)
		}
		lastIndex = idx
	}
}

func TestFilterToolDefsByName(t *testing.T) {
	filtered := FilterToolDefsByName(GetToolDefsForLLM(), map[string]struct{}{
		"get_workflow":     {},
		"search_knowledge": {},
	})

	if len(filtered) != 2 {
		t.Fatalf("expected 2 filtered tools, got %d", len(filtered))
	}
	for _, toolDef := range filtered {
		if toolDef.Function == nil {
			t.Fatalf("expected filtered tool to include function definition")
		}
		if toolDef.Function.Name != "get_workflow" && toolDef.Function.Name != "search_knowledge" {
			t.Fatalf("unexpected filtered tool %q", toolDef.Function.Name)
		}
	}
}
