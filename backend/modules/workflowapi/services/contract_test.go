package services

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"yaolight-workshop/backend/infrastructure/shared"
	artifactModels "yaolight-workshop/backend/modules/artifact/models"
	workflowAPIModels "yaolight-workshop/backend/modules/workflowapi/models"
)

func TestValidateContractSchema(t *testing.T) {
	schema := map[string]interface{}{
		"type":     "object",
		"required": []interface{}{"url", "limit"},
		"properties": map[string]interface{}{
			"url":   map[string]interface{}{"type": "string"},
			"limit": map[string]interface{}{"type": "integer"},
			"tags": map[string]interface{}{
				"type":  "array",
				"items": map[string]interface{}{"type": "string"},
			},
		},
	}

	valid := map[string]interface{}{
		"url":   "https://example.com",
		"limit": 5.0,
		"tags":  []interface{}{"a", "b"},
	}
	if err := validateContractSchema(valid, schema, "input"); err != nil {
		t.Fatalf("expected valid schema, got error: %v", err)
	}

	invalid := map[string]interface{}{
		"url":   "https://example.com",
		"limit": "oops",
	}
	if err := validateContractSchema(invalid, schema, "input"); err == nil {
		t.Fatalf("expected schema validation error")
	}
}

func TestApplyContractMapping(t *testing.T) {
	source := map[string]interface{}{
		"url": "https://example.com",
		"meta": map[string]interface{}{
			"limit": 3.0,
		},
		"data": map[string]interface{}{
			"items": []interface{}{
				map[string]interface{}{"title": "first"},
				map[string]interface{}{"title": "second"},
			},
		},
	}

	mapping := map[string]interface{}{
		"data.targetUrl": "url",
		"options.limit": map[string]interface{}{
			"path": "meta.limit",
		},
		"options.firstTitle": map[string]interface{}{
			"path": "data.items[0].title",
		},
		"options.mode": map[string]interface{}{
			"value": "strict",
		},
	}

	mapped, ok := applyContractMapping(source, mapping).(map[string]interface{})
	if !ok {
		t.Fatalf("expected mapped object")
	}

	data := mapped["data"].(map[string]interface{})
	if got := data["targetUrl"]; got != "https://example.com" {
		t.Fatalf("unexpected targetUrl: %#v", got)
	}

	options := mapped["options"].(map[string]interface{})
	if got := options["mode"]; got != "strict" {
		t.Fatalf("unexpected mode: %#v", got)
	}
	if got := options["firstTitle"]; got != "first" {
		t.Fatalf("unexpected firstTitle: %#v", got)
	}
}

func TestFilterArtifactsByExposure(t *testing.T) {
	artifacts := []artifactModels.Artifact{
		{NodeID: "output-a"},
		{NodeID: "output-b"},
	}

	selected := filterArtifactsByExposure(artifacts, "selected", map[string]struct{}{"output-b": {}})
	if len(selected) != 1 || selected[0].NodeID != "output-b" {
		t.Fatalf("unexpected selected artifacts: %#v", selected)
	}

	none := filterArtifactsByExposure(artifacts, "none", nil)
	if len(none) != 0 {
		t.Fatalf("expected no artifacts, got %#v", none)
	}
}

func TestOptionalJSONTracksNullAndValue(t *testing.T) {
	var req EndpointUpsertRequest
	if err := json.Unmarshal([]byte(`{"requestSchema":null,"inputMapping":{"target":"input.url"}}`), &req); err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !req.RequestSchema.Set {
		t.Fatalf("expected requestSchema to be marked as set")
	}
	if req.RequestSchema.Value != nil {
		t.Fatalf("expected requestSchema to preserve explicit null, got %#v", req.RequestSchema.Value)
	}
	if !req.InputMapping.Set {
		t.Fatalf("expected inputMapping to be marked as set")
	}
	mapping, ok := req.InputMapping.Value.(map[string]interface{})
	if !ok || mapping["target"] != "input.url" {
		t.Fatalf("unexpected inputMapping: %#v", req.InputMapping.Value)
	}
}

func TestJSONBFieldPtrAllowsClearingValues(t *testing.T) {
	if jsonbFieldPtr(nil) != nil {
		t.Fatalf("expected nil JSONB pointer when clearing field")
	}
	value := jsonbFieldPtr(map[string]interface{}{"ok": true})
	if value == nil {
		t.Fatalf("expected non-nil JSONB pointer")
	}
	data, ok := value.Data.(map[string]interface{})
	if !ok || data["ok"] != true {
		t.Fatalf("unexpected JSONB payload: %#v", value.Data)
	}
}

func TestIsArtifactExposedHonorsEndpointPolicy(t *testing.T) {
	endpoint := &workflowAPIModels.WorkflowAPIEndpoint{ExposeArtifacts: "selected"}
	endpoint.ExposedArtifactIDs = &shared.JSONB{Data: []interface{}{"output-a"}}
	if !isArtifactExposed(endpoint, "output-a") {
		t.Fatalf("expected selected artifact to be exposed")
	}
	if isArtifactExposed(endpoint, "output-b") {
		t.Fatalf("expected non-selected artifact to stay hidden")
	}
	endpoint.ExposeArtifacts = "none"
	if isArtifactExposed(endpoint, "output-a") {
		t.Fatalf("expected artifact exposure to be disabled")
	}
}

func TestNormalizeAPIKeyStatusRejectsUnknownValue(t *testing.T) {
	status, err := normalizeAPIKeyStatus("inactive")
	if err != nil || status != "inactive" {
		t.Fatalf("expected inactive to be accepted, got status=%q err=%v", status, err)
	}

	if _, err := normalizeAPIKeyStatus(""); !errors.Is(err, ErrInvalidKeyStatus) {
		t.Fatalf("expected empty status to be rejected, got %v", err)
	}

	if _, err := normalizeAPIKeyStatus("disable"); !errors.Is(err, ErrInvalidKeyStatus) {
		t.Fatalf("expected unknown status to be rejected, got %v", err)
	}
}

func TestValidateAPIKeyExpiryRequiresFutureTime(t *testing.T) {
	now := time.Date(2026, time.April, 21, 10, 0, 0, 0, time.UTC)

	past := now.Add(-time.Minute)
	if err := validateAPIKeyExpiry(&past, now); !errors.Is(err, ErrInvalidKeyExpiry) {
		t.Fatalf("expected past expiry to be rejected, got %v", err)
	}

	same := now
	if err := validateAPIKeyExpiry(&same, now); !errors.Is(err, ErrInvalidKeyExpiry) {
		t.Fatalf("expected current-time expiry to be rejected, got %v", err)
	}

	future := now.Add(time.Minute)
	if err := validateAPIKeyExpiry(&future, now); err != nil {
		t.Fatalf("expected future expiry to be accepted, got %v", err)
	}

	if err := validateAPIKeyExpiry(nil, now); err != nil {
		t.Fatalf("expected nil expiry to be accepted, got %v", err)
	}
}

func TestShouldValidateResponseSchemaOnlyForCompletedStatus(t *testing.T) {
	if shouldValidateResponseSchema("failed") {
		t.Fatalf("failed invocations should not validate response schema")
	}
	if !shouldValidateResponseSchema("completed") {
		t.Fatalf("completed invocations should validate response schema even when result is null")
	}
}

func TestWrapValidationErrorMarksErrorAsBadRequest(t *testing.T) {
	err := wrapValidationError(errors.New("input.url is required"))
	if !errors.Is(err, ErrValidationFailed) {
		t.Fatalf("expected wrapped validation error, got %v", err)
	}
	if err.Error() != "workflow api validation failed: input.url is required" {
		t.Fatalf("unexpected wrapped validation message: %s", err.Error())
	}
}

func TestShouldValidatePublishedEndpointCanvasOnlyOnPublishTransition(t *testing.T) {
	if !shouldValidatePublishedEndpointCanvas("draft", "published") {
		t.Fatalf("expected draft -> published transition to require canvas validation")
	}
	if shouldValidatePublishedEndpointCanvas("published", "published") {
		t.Fatalf("expected published -> published edit to skip canvas validation")
	}
	if shouldValidatePublishedEndpointCanvas("published", "draft") {
		t.Fatalf("expected unpublish to skip canvas validation")
	}
}
