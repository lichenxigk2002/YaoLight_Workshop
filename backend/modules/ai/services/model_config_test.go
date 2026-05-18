package services

import (
	"strings"
	"testing"

	"yaolight-workshop/backend/infrastructure/config"
)

func TestGetCustomModelConfig(t *testing.T) {
	temp := 0.7
	got, err := GetModelConfigForExecution("custom", 0, 0, map[string]interface{}{
		"provider":         "qianwen",
		"modelName":        "gpt-test",
		"apiKey":           "sk-test",
		"baseUrl":          "https://example.test/v1",
		"temperature":      temp,
		"maxTokens":        float64(2048),
		"frequencyPenalty": float64(0.2),
		"presencePenalty":  float64(0.1),
	}, nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got.Provider != "qwen" {
		t.Fatalf("expected normalized provider qwen, got %q", got.Provider)
	}
	if got.ModelName != "gpt-test" || got.APIKey != "sk-test" || got.BaseURL != "https://example.test/v1" {
		t.Fatalf("unexpected config: %#v", got)
	}
	if got.Temperature == nil || *got.Temperature != temp {
		t.Fatalf("unexpected temperature: %#v", got.Temperature)
	}
	if got.MaxTokens == nil || *got.MaxTokens != 2048 {
		t.Fatalf("unexpected max tokens: %#v", got.MaxTokens)
	}
}

func TestGetCustomModelConfigRequiresFields(t *testing.T) {
	_, err := GetModelConfigForExecution("custom", 0, 0, map[string]interface{}{
		"provider": "deepseek",
	}, nil)
	if err == nil || !strings.Contains(err.Error(), "缺少必填字段") {
		t.Fatalf("expected required fields error, got %v", err)
	}
}

func TestGetSystemPresetConfigUsesProviderDefaults(t *testing.T) {
	originalKey := config.DeepSeekAPIKey
	t.Cleanup(func() { config.DeepSeekAPIKey = originalKey })
	config.DeepSeekAPIKey = "deepseek-key"

	got, err := GetModelConfigForExecution("system", 0, 0, map[string]interface{}{
		"provider":  "deepseek",
		"maxTokens": float64(4096),
	}, nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got.Provider != "deepseek" || got.APIKey != "deepseek-key" || got.BaseURL != "https://api.deepseek.com" {
		t.Fatalf("unexpected system config: %#v", got)
	}
	if got.MaxTokens == nil || *got.MaxTokens != 4096 {
		t.Fatalf("unexpected max tokens: %#v", got.MaxTokens)
	}
}

func TestGetModelConfigForExecutionRejectsUnknownMode(t *testing.T) {
	_, err := GetModelConfigForExecution("missing", 0, 0, nil, nil)
	if err == nil || !strings.Contains(err.Error(), "unknown model mode") {
		t.Fatalf("expected unknown mode error, got %v", err)
	}
}
