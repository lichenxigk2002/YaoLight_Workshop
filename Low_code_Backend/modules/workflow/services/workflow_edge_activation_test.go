package services

import "testing"

func TestIsEdgeActiveIgnoresUnselectedConditionBranch(t *testing.T) {
	nodes := []NodeConfig{
		{ID: "cond", Type: "condition"},
		{ID: "target", Type: "merge"},
	}
	edges := []EdgeConfig{
		{Source: "cond", Target: "target", SourceHandle: "true"},
	}

	active := isEdgeActive(
		edges[0],
		nodes,
		edges,
		map[string]bool{"cond": false},
		map[string]bool{"cond": true},
	)

	if active {
		t.Fatalf("expected unselected condition branch to be inactive")
	}
}

func TestIsEdgeActiveIgnoresNestedUnselectedConditionBranch(t *testing.T) {
	nodes := []NodeConfig{
		{ID: "cond", Type: "condition"},
		{ID: "mid", Type: "transform"},
		{ID: "target", Type: "merge"},
	}
	edges := []EdgeConfig{
		{Source: "cond", Target: "mid", SourceHandle: "true"},
		{Source: "mid", Target: "target"},
	}

	active := isEdgeActive(
		edges[1],
		nodes,
		edges,
		map[string]bool{"cond": false},
		map[string]bool{},
	)

	if active {
		t.Fatalf("expected downstream edge of an unselected condition branch to be inactive")
	}
}
