package tools

import "testing"

func TestNormalizeNodeType(t *testing.T) {
	tests := map[string]string{
		"merge":       "merge",
		" Merge ":     "merge",
		"merge_node":  "merge",
		"data clean":  "dataclean",
		"data-clean":  "dataclean",
		"output-node": "output",
	}

	for input, expected := range tests {
		if actual := normalizeNodeType(input); actual != expected {
			t.Fatalf("normalizeNodeType(%q) = %q, want %q", input, actual, expected)
		}
	}
}

func TestRunGetNodeSpecRequiresNodeType(t *testing.T) {
	registry := &Registry{
		runner: &Runner{
			NodeSpecByType: func(nodeType string) (interface{}, error) {
				return map[string]string{"type": nodeType}, nil
			},
		},
	}

	_, _, err := registry.runGetNodeSpec(map[string]interface{}{}, 1)
	if err == nil {
		t.Fatalf("expected error when nodeType is missing")
	}
}

func TestRunGetNodeSpecNormalizesAlias(t *testing.T) {
	registry := &Registry{
		runner: &Runner{
			NodeSpecByType: func(nodeType string) (interface{}, error) {
				return map[string]string{"type": nodeType}, nil
			},
		},
	}

	result, _, err := registry.runGetNodeSpec(map[string]interface{}{"nodeType": "merge_node"}, 1)
	if err != nil {
		t.Fatalf("expected normalized alias to succeed: %v", err)
	}

	resultMap, ok := result.(map[string]string)
	if !ok {
		t.Fatalf("unexpected result type: %T", result)
	}
	if resultMap["type"] != "merge" {
		t.Fatalf("expected normalized node type 'merge', got %q", resultMap["type"])
	}
}

func TestRunGetNodeSpecUnknownTypeFails(t *testing.T) {
	registry := &Registry{
		runner: &Runner{
			NodeSpecByType: func(nodeType string) (interface{}, error) {
				return nil, nil
			},
		},
	}

	_, _, err := registry.runGetNodeSpec(map[string]interface{}{"nodeType": "unknown-node"}, 1)
	if err == nil {
		t.Fatalf("expected unsupported nodeType to fail")
	}
}
