package tools

import "testing"

func TestRegistryModeGateBlocksMutatingToolsOutsideAllowedModes(t *testing.T) {
	registry := NewRegistry(nil)

	if _, _, err := registry.ExecuteToolForMode("explain", "propose_workflow", `{}`, 1); err == nil {
		t.Fatalf("expected propose_workflow to be blocked in explain mode")
	}
	if _, _, err := registry.ExecuteToolForMode("trial_debug", "propose_patch", `{}`, 1); err == nil {
		t.Fatalf("expected propose_patch to be blocked in trial_debug mode")
	}
}

func TestRegistryModeGateAllowsReadOnlyExplainTools(t *testing.T) {
	registry := NewRegistry(nil)

	if _, _, err := registry.ExecuteToolForMode("explain", "get_workflow", `{}`, 1); err != nil {
		t.Fatalf("expected get_workflow to be allowed in explain mode: %v", err)
	}
	if _, _, err := registry.ExecuteToolForMode("explain", "search_knowledge", `{}`, 1); err != nil {
		t.Fatalf("expected search_knowledge to be allowed in explain mode: %v", err)
	}
}

func TestRegistryModeGateAllowsReadOnlyChatTools(t *testing.T) {
	registry := NewRegistry(nil)

	for _, toolName := range []string{"search_knowledge", "get_capabilities", "get_workflow", "get_node_spec", "get_available_models"} {
		if _, _, err := registry.ExecuteToolForMode("chat", toolName, `{"query":"test"}`, 1); err != nil && toolName == "search_knowledge" {
			t.Fatalf("expected %s to be allowed in chat mode: %v", toolName, err)
		}
		if toolName != "search_knowledge" {
			if _, _, err := registry.ExecuteToolForMode("chat", toolName, `{}`, 1); err != nil {
				t.Fatalf("expected %s to be allowed in chat mode: %v", toolName, err)
			}
		}
	}
}
