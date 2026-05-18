package services

import (
	"strings"
	"testing"
)

func TestJSONExtractorExtractWorkflowJSONFromFencedBlock(t *testing.T) {
	extractor := NewJSONExtractor()
	got, err := extractor.ExtractWorkflowJSON("before\n```json\n{\"nodes\":[{\"id\":\"n1\"}],\"edges\":[]}\n```\nafter")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if !strings.Contains(got, `"nodes"`) {
		t.Fatalf("expected workflow json, got %q", got)
	}
}

func TestJSONExtractorExtractWorkflowJSONFromBracesWithNestedString(t *testing.T) {
	extractor := NewJSONExtractor()
	got, err := extractor.ExtractWorkflowJSON(`prefix {"message":"brace } inside string","nested":{"ok":true}} suffix`)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got != `{"message":"brace } inside string","nested":{"ok":true}}` {
		t.Fatalf("unexpected json: %q", got)
	}
}

func TestJSONExtractorValidateWorkflow(t *testing.T) {
	extractor := NewJSONExtractor()
	workflow := `{
		"version":"1",
		"exportedAt":"2026-05-18T00:00:00Z",
		"nodes":[{"id":"start"}],
		"edges":[]
	}`

	got, err := extractor.ExtractAndValidateWorkflow(workflow)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got["version"] != "1" {
		t.Fatalf("unexpected workflow: %#v", got)
	}
}

func TestJSONExtractorValidateWorkflowRejectsMissingFields(t *testing.T) {
	extractor := NewJSONExtractor()
	_, err := extractor.ExtractAndValidateWorkflow(`{"version":"1","nodes":[]}`)
	if err == nil || !strings.Contains(err.Error(), "缺少必需字段") {
		t.Fatalf("expected missing field error, got %v", err)
	}
}

func TestJSONExtractorHasJSONCodeBlock(t *testing.T) {
	extractor := NewJSONExtractor()
	if !extractor.HasJSONCodeBlock("```json\n{}\n```") {
		t.Fatalf("expected json code block")
	}
	if extractor.HasJSONCodeBlock("```\n{}\n```") {
		t.Fatalf("did not expect plain code block to match")
	}
}
