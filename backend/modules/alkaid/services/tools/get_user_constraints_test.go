package tools

import "testing"

func TestDefaultUserConstraintsAllowLargeWorkflows(t *testing.T) {
	maxNodes, ok := defaultUserConstraints["maxNodes"].(int)
	if !ok {
		t.Fatalf("expected maxNodes to be an int, got %#v", defaultUserConstraints["maxNodes"])
	}
	if maxNodes != -1 {
		t.Fatalf("expected maxNodes to be -1 for no hard limit, got %d", maxNodes)
	}

	policy, ok := defaultUserConstraints["nodeCountPolicy"].(string)
	if !ok || policy != "prefer_minimal_but_complete" {
		t.Fatalf("unexpected nodeCountPolicy: %#v", defaultUserConstraints["nodeCountPolicy"])
	}
}
