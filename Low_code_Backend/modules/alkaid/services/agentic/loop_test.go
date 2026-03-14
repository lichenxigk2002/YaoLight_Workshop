package agentic

import (
	"testing"

	"yaolight-workshop/backend/modules/ai/services/providers"
)

func TestShouldAttemptWorkflowFallbackForStructuredWorkflowReply(t *testing.T) {
	userMessage := "please generate a complex workflow for me"
	assistantContent := "Here is the draft.\n\n<!-- workflow-json -->\n{\"version\":\"1.0.0\",\"nodes\":[{\"id\":\"node-1\",\"type\":\"start\"}],\"edges\":[]"

	if !shouldAttemptWorkflowFallback(userMessage, assistantContent) {
		t.Fatalf("expected fallback to trigger for structured workflow reply")
	}
}

func TestShouldAttemptWorkflowFallbackForPlainReply(t *testing.T) {
	userMessage := "please explain the merge node"
	assistantContent := "The merge node combines inputs from multiple branches."

	if shouldAttemptWorkflowFallback(userMessage, assistantContent) {
		t.Fatalf("expected fallback to stay disabled for plain explanatory reply")
	}
}

func TestBuildWorkflowFallbackConfigClonesBaseConfig(t *testing.T) {
	temperature := 0.7
	maxTokens := 4000
	base := &providers.AIModelConfig{
		Provider:    "deepseek",
		ModelName:   "deepseek-chat",
		Temperature: &temperature,
		MaxTokens:   &maxTokens,
	}

	cfg := buildWorkflowFallbackConfig(base)
	if cfg == nil {
		t.Fatalf("expected fallback config")
	}
	if cfg == base {
		t.Fatalf("expected fallback config to clone base config")
	}
	if cfg.Temperature == nil || *cfg.Temperature != 0.2 {
		t.Fatalf("unexpected fallback temperature: %#v", cfg.Temperature)
	}
	if cfg.MaxTokens == nil || *cfg.MaxTokens != 8192 {
		t.Fatalf("unexpected fallback max tokens: %#v", cfg.MaxTokens)
	}
	if *base.Temperature != 0.7 {
		t.Fatalf("base temperature should remain unchanged, got %v", *base.Temperature)
	}
	if *base.MaxTokens != 4000 {
		t.Fatalf("base max tokens should remain unchanged, got %v", *base.MaxTokens)
	}
}
