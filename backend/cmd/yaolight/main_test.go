package main

import "testing"

func TestMCPToolPathReadTools(t *testing.T) {
	path, q, err := mcpToolPath("get_task_logs", map[string]any{
		"id":    "12",
		"level": "error",
		"limit": "50",
	})
	if err != nil {
		t.Fatal(err)
	}
	if path != "/mcp/tools/tasks/12/logs" {
		t.Fatalf("unexpected path: %s", path)
	}
	if q.Get("level") != "error" || q.Get("limit") != "50" {
		t.Fatalf("unexpected query: %s", q.Encode())
	}
}

func TestMCPToolDefinitionsIncludeControlledExecution(t *testing.T) {
	names := make(map[string]bool)
	for _, tool := range mcpToolDefinitions() {
		if name, ok := tool["name"].(string); ok {
			names[name] = true
		}
	}
	for _, name := range []string{"run_workflow", "cancel_task", "retry_task"} {
		if !names[name] {
			t.Fatalf("expected tool %s in definitions", name)
		}
	}
}
