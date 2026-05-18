package services

import (
	"reflect"
	"testing"
)

func TestDataFlowGetNodeInputDataMergesMultipleInputs(t *testing.T) {
	df := NewDataFlow([]EdgeConfig{
		{Source: "a", Target: "c"},
		{Source: "b", Target: "c"},
	})
	df.SetNodeOutput("a", NewNodeData("first"))
	df.SetNodeOutput("b", NewNodeData(map[string]interface{}{"value": 2}))

	got, err := df.GetNodeInputData("c")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	payload := got.Payload.(map[string]interface{})
	if payload["input_0"] != "first" {
		t.Fatalf("unexpected first input: %#v", payload)
	}
	if !reflect.DeepEqual(payload["input_1"], map[string]interface{}{"value": 2}) {
		t.Fatalf("unexpected second input: %#v", payload)
	}
}

func TestDataFlowGetNodeInputWithEdgesIncludesMissingSources(t *testing.T) {
	df := NewDataFlow([]EdgeConfig{
		{Source: "present", Target: "target", TargetHandle: "input-0"},
		{Source: "missing", Target: "target", TargetHandle: "input-1"},
	})
	df.SetNodeOutput("present", NewNodeData(1))

	got, err := df.GetNodeInputWithEdges("target")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 inputs, got %d", len(got))
	}
	if got[0].Data == nil || got[0].Data.Payload != 1 {
		t.Fatalf("unexpected present input: %#v", got[0])
	}
	if got[1].Data != nil {
		t.Fatalf("expected missing input data to be nil, got %#v", got[1].Data)
	}
}

func TestTryGetDataByPathRejectsMalformedPaths(t *testing.T) {
	_, found, err := TryGetDataByPath(map[string]interface{}{"items": []interface{}{1}}, "items[]")
	if err == nil || found {
		t.Fatalf("expected malformed path error, found=%v err=%v", found, err)
	}

	_, found, err = TryGetDataByPath(map[string]interface{}{"items": []interface{}{1}}, "items[2]")
	if err != nil {
		t.Fatalf("expected nil error for missing index, got %v", err)
	}
	if found {
		t.Fatalf("expected found=false for out of range index")
	}
}

func TestMergeDataSkipsNilPayloads(t *testing.T) {
	got := MergeData(NewNodeData("a"), nil, NewNodeData(nil), NewNodeData("d"))
	payload := got.Payload.(map[string]interface{})
	if len(payload) != 2 {
		t.Fatalf("expected 2 merged payloads, got %#v", payload)
	}
	if payload["input_0"] != "a" || payload["input_3"] != "d" {
		t.Fatalf("unexpected merged payload: %#v", payload)
	}
}
