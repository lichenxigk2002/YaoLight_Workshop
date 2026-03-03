package services

import "testing"

func TestTryGetDataByPath(t *testing.T) {
	data := map[string]interface{}{
		"a": map[string]interface{}{
			"b": []interface{}{map[string]interface{}{"c": 1}},
		},
	}

	v, found, err := TryGetDataByPath(data, "a.b[0].c")
	if err != nil || !found {
		t.Fatalf("expected found=true err=nil, got found=%v err=%v", found, err)
	}
	if v.(int) != 1 {
		t.Fatalf("expected 1, got %v", v)
	}

	_, found, err = TryGetDataByPath(data, "a.b[1].c")
	if err != nil {
		t.Fatalf("expected err=nil, got %v", err)
	}
	if found {
		t.Fatalf("expected found=false")
	}
}

func TestEvaluateConditionAny(t *testing.T) {
	if !evaluateConditionAny(10, ">", 2) {
		t.Fatalf("expected true")
	}
	if evaluateConditionAny(1, "<", 0) {
		t.Fatalf("expected false")
	}
	if !evaluateConditionAny("hello world", "contains", "world") {
		t.Fatalf("expected true")
	}
	if !evaluateConditionAny("a", "in", "a,b,c") {
		t.Fatalf("expected true")
	}
}

func TestTransformMap(t *testing.T) {
	vc := NewVariableContext()
	original := map[string]interface{}{"data": map[string]interface{}{"title": "t1", "url": "u1"}}
	res, err := transformData(vc, "map", original, "{\"title\":\"data.title\",\"url\":\"data.url\"}")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	m := res.(map[string]interface{})
	if m["title"].(string) != "t1" || m["url"].(string) != "u1" {
		t.Fatalf("unexpected result: %#v", m)
	}
}

func TestMergeNodeOrdersByTargetHandle(t *testing.T) {
	df := NewDataFlow([]EdgeConfig{
		{Source: "n1", Target: "m1", TargetHandle: "input-1"},
		{Source: "n2", Target: "m1", TargetHandle: "input-0"},
	})
	df.SetNodeOutput("n1", NewNodeData([]interface{}{1}))
	df.SetNodeOutput("n2", NewNodeData([]interface{}{2}))

	exec := &WorkflowExecutor{}
	res := exec.executeMergeNode(NodeConfig{ID: "m1", Type: "merge", Config: map[string]interface{}{"mergeType": "concat"}}, df)
	if !res.Success {
		t.Fatalf("expected success, got error: %s", res.Error)
	}
	out := res.Data.(map[string]interface{})["merged"].([]interface{})
	if len(out) != 2 || out[0].(int) != 2 || out[1].(int) != 1 {
		t.Fatalf("unexpected order: %#v", out)
	}
}
