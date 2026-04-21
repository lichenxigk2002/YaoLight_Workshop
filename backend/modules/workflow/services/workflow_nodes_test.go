package services

import (
	"errors"
	"testing"
)

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

func TestMergeNodeSupportsFiveConfiguredInputs(t *testing.T) {
	df := NewDataFlow([]EdgeConfig{
		{Source: "n1", Target: "m1", TargetHandle: "input-4"},
		{Source: "n2", Target: "m1", TargetHandle: "input-0"},
		{Source: "n3", Target: "m1", TargetHandle: "input-3"},
		{Source: "n4", Target: "m1", TargetHandle: "input-1"},
		{Source: "n5", Target: "m1", TargetHandle: "input-2"},
	})
	df.SetNodeOutput("n1", NewNodeData([]interface{}{5}))
	df.SetNodeOutput("n2", NewNodeData([]interface{}{1}))
	df.SetNodeOutput("n3", NewNodeData([]interface{}{4}))
	df.SetNodeOutput("n4", NewNodeData([]interface{}{2}))
	df.SetNodeOutput("n5", NewNodeData([]interface{}{3}))

	exec := &WorkflowExecutor{}
	res := exec.executeMergeNode(NodeConfig{
		ID:   "m1",
		Type: "merge",
		Config: map[string]interface{}{
			"mergeType":  "concat",
			"inputCount": 5,
		},
	}, df)
	if !res.Success {
		t.Fatalf("expected success, got error: %s", res.Error)
	}
	out := res.Data.(map[string]interface{})["merged"].([]interface{})
	expected := []int{1, 2, 3, 4, 5}
	if len(out) != len(expected) {
		t.Fatalf("unexpected merged length: %#v", out)
	}
	for i, item := range out {
		if item.(int) != expected[i] {
			t.Fatalf("unexpected order at %d: %#v", i, out)
		}
	}
}

func TestMergeNodeIgnoresInputsBeyondConfiguredCount(t *testing.T) {
	df := NewDataFlow([]EdgeConfig{
		{Source: "n1", Target: "m1", TargetHandle: "input-0"},
		{Source: "n2", Target: "m1", TargetHandle: "input-1"},
		{Source: "n3", Target: "m1", TargetHandle: "input-2"},
	})
	df.SetNodeOutput("n1", NewNodeData([]interface{}{1}))
	df.SetNodeOutput("n2", NewNodeData([]interface{}{2}))
	df.SetNodeOutput("n3", NewNodeData([]interface{}{3}))

	exec := &WorkflowExecutor{}
	res := exec.executeMergeNode(NodeConfig{
		ID:   "m1",
		Type: "merge",
		Config: map[string]interface{}{
			"mergeType":  "concat",
			"inputCount": 2,
		},
	}, df)
	if !res.Success {
		t.Fatalf("expected success, got error: %s", res.Error)
	}
	out := res.Data.(map[string]interface{})["merged"].([]interface{})
	if len(out) != 2 || out[0].(int) != 1 || out[1].(int) != 2 {
		t.Fatalf("unexpected merged output: %#v", out)
	}
}

func TestExecuteStartNodeSkipsManualStartForOpenAPI(t *testing.T) {
	exec := &WorkflowExecutor{}
	res := exec.executeStartNode(NodeConfig{
		ID:   "start-manual",
		Type: "start",
		Config: map[string]interface{}{
			"inputMode": "manual",
			"inputData": "{\"fallback\":true}",
		},
	}, NewDataFlow(nil), ExecutionMeta{
		RuntimeInput: map[string]interface{}{"fromAPI": true},
		RuntimeMeta:  map[string]interface{}{"source": "open_api"},
	})
	if res.Success {
		t.Fatalf("manual start node should be skipped during open_api execution")
	}
	if !isSkippedStartNodeResult(res) {
		t.Fatalf("expected skipped manual start result, got %#v", res)
	}
}

func TestExecuteStartNodeSkipsManualStartForOpenAPIWithoutRuntimeInput(t *testing.T) {
	exec := &WorkflowExecutor{}
	res := exec.executeStartNode(NodeConfig{
		ID:   "start-manual",
		Type: "start",
		Config: map[string]interface{}{
			"inputMode": "manual",
			"inputData": "{\"fallback\":true}",
		},
	}, NewDataFlow(nil), ExecutionMeta{
		RuntimeMeta: map[string]interface{}{"source": "open_api"},
	})
	if res.Success {
		t.Fatalf("manual start node should be skipped during open_api execution without runtime input")
	}
	if !isSkippedStartNodeResult(res) {
		t.Fatalf("expected skipped manual start result without runtime input, got %#v", res)
	}
}

func TestExecuteStartNodeConsumesRuntimeInputForAPIStart(t *testing.T) {
	exec := &WorkflowExecutor{}
	res := exec.executeStartNode(NodeConfig{
		ID:   "start-api",
		Type: "start",
		Config: map[string]interface{}{
			"inputMode": "api_input",
		},
	}, NewDataFlow(nil), ExecutionMeta{
		RuntimeInput: map[string]interface{}{"fromAPI": true},
		RuntimeMeta:  map[string]interface{}{"source": "open_api"},
	})
	if !res.Success {
		t.Fatalf("expected success, got error: %s", res.Error)
	}
	data, ok := res.Data.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map data, got %#v", res.Data)
	}
	if got, ok := data["fromAPI"].(bool); !ok || !got {
		t.Fatalf("expected API runtime input, got %#v", data)
	}
}

func TestExecuteStartNodePreservesLegacyOpenAPIBehaviorWithoutInputMode(t *testing.T) {
	exec := &WorkflowExecutor{}
	res := exec.executeStartNode(NodeConfig{
		ID:     "start-legacy",
		Type:   "start",
		Config: map[string]interface{}{},
	}, NewDataFlow(nil), ExecutionMeta{
		RuntimeInput: map[string]interface{}{"fromAPI": true},
		RuntimeMeta:  map[string]interface{}{"source": "open_api"},
	})
	if !res.Success {
		t.Fatalf("legacy start node should continue consuming runtime input, got error: %s", res.Error)
	}
	if isSkippedStartNodeResult(res) {
		t.Fatalf("legacy start node should not be skipped for open_api execution")
	}
	data, ok := res.Data.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map data, got %#v", res.Data)
	}
	if got, ok := data["fromAPI"].(bool); !ok || !got {
		t.Fatalf("expected legacy start node to receive API runtime input, got %#v", data)
	}
}

func TestCollectTaskResultPayloadPrefersAPIOutputsOnlyForOpenAPI(t *testing.T) {
	dataFlow := NewDataFlow(nil)
	dataFlow.SetNodeOutput("output-api", NewNodeData(map[string]interface{}{
		"response": map[string]interface{}{"message": "public"},
		"data":     map[string]interface{}{"raw": true},
	}))
	dataFlow.SetNodeOutput("terminal", NewNodeData(map[string]interface{}{"message": "internal"}))

	nodes := []NodeConfig{
		{ID: "output-api", Type: "output", Config: map[string]interface{}{"outputMode": "api_output"}},
		{ID: "terminal", Type: "llm", Config: map[string]interface{}{}},
	}
	terminalNodes := []NodeConfig{{ID: "terminal", Type: "llm", Config: map[string]interface{}{}}}

	internal := collectTaskResultPayload(dataFlow, nodes, terminalNodes, false)
	if internal == nil {
		t.Fatalf("expected internal result payload")
	}
	internalMap, ok := internal.Data.(map[string]interface{})
	if !ok || internalMap["message"] != "internal" {
		t.Fatalf("expected terminal-node result for internal execution, got %#v", internal.Data)
	}

	public := collectTaskResultPayload(dataFlow, nodes, terminalNodes, true)
	if public == nil {
		t.Fatalf("expected public result payload")
	}
	publicMap, ok := public.Data.(map[string]interface{})
	if !ok || publicMap["message"] != "public" {
		t.Fatalf("expected api_output result for open api execution, got %#v", public.Data)
	}
}

func TestResolveOutputResponsePayloadRequiresConfiguredPathToExist(t *testing.T) {
	payload := map[string]interface{}{
		"result": map[string]interface{}{
			"summary": "public",
		},
		"internal": "debug",
	}

	value, err := resolveOutputResponsePayload(payload, "result.summary")
	if err != nil {
		t.Fatalf("expected response path to resolve, got error: %v", err)
	}
	if value != "public" {
		t.Fatalf("unexpected resolved value: %#v", value)
	}

	if _, err := resolveOutputResponsePayload(payload, "result.missing"); err == nil {
		t.Fatalf("expected missing response path to fail")
	}
}

func TestResolveOutputResponsePayloadAllowsEmptyPath(t *testing.T) {
	payload := map[string]interface{}{"result": "all"}

	value, err := resolveOutputResponsePayload(payload, "")
	if err != nil {
		t.Fatalf("expected empty response path to return whole payload, got error: %v", err)
	}
	if got, ok := value.(map[string]interface{}); !ok || got["result"] != "all" {
		t.Fatalf("unexpected payload: %#v", value)
	}
}

func TestEffectiveOutputResponsePathOnlyAppliesToAPIOutput(t *testing.T) {
	if got := effectiveOutputResponsePath("api_output", " result.summary "); got != "result.summary" {
		t.Fatalf("expected api_output to use trimmed response path, got %q", got)
	}
	if got := effectiveOutputResponsePath("artifact_export", "result.missing"); got != "" {
		t.Fatalf("expected artifact export to ignore stale response path, got %q", got)
	}
	if got := effectiveOutputResponsePath("", "result.missing"); got != "" {
		t.Fatalf("expected default output mode to ignore response path, got %q", got)
	}
}

func TestValidatePublishedAPICanvasNodesRequiresAPIInputAndOutput(t *testing.T) {
	validNodes := []WorkflowNodeData{
		{ID: "start-api", Type: "start", Data: map[string]interface{}{"config": map[string]interface{}{"inputMode": "api_input"}}},
		{ID: "output-api", Type: "output", Data: map[string]interface{}{"config": map[string]interface{}{"outputMode": "api_output"}}},
	}
	if err := validatePublishedAPICanvasNodes(validNodes); err != nil {
		t.Fatalf("expected valid published API canvas, got error: %v", err)
	}

	missingInput := []WorkflowNodeData{
		{ID: "start-manual", Type: "start", Data: map[string]interface{}{"config": map[string]interface{}{"inputMode": "manual"}}},
		{ID: "output-api", Type: "output", Data: map[string]interface{}{"config": map[string]interface{}{"outputMode": "api_output"}}},
	}
	if err := validatePublishedAPICanvasNodes(missingInput); !errors.Is(err, ErrPublishedWorkflowAPICanvasInvalid) {
		t.Fatalf("expected missing api_input to fail with published canvas error, got %v", err)
	}

	missingOutput := []WorkflowNodeData{
		{ID: "start-api", Type: "start", Data: map[string]interface{}{"config": map[string]interface{}{"inputMode": "api_input"}}},
		{ID: "output-artifact", Type: "output", Data: map[string]interface{}{"config": map[string]interface{}{"outputMode": "artifact_export"}}},
	}
	if err := validatePublishedAPICanvasNodes(missingOutput); !errors.Is(err, ErrPublishedWorkflowAPICanvasInvalid) {
		t.Fatalf("expected missing api_output to fail with published canvas error, got %v", err)
	}
}

func TestSkippedStartNodeResultIsRecognized(t *testing.T) {
	result := skippedStartNodeResult("start-manual")
	if !isSkippedStartNodeResult(result) {
		t.Fatalf("expected skipped start helper to recognize skipped result")
	}
	if result.Success {
		t.Fatalf("skipped start result should not be marked successful")
	}
}
