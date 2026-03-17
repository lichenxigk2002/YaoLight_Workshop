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

func TestShouldForceCrawlerPreparation(t *testing.T) {
	cases := []struct {
		name     string
		message  string
		expected bool
	}{
		{
			name:     "explicit crawler url",
			message:  "请抓取 https://example.com/article/1 的正文",
			expected: true,
		},
		{
			name:     "crawler keyword",
			message:  "做一个网页爬虫工作流，提取新闻列表",
			expected: true,
		},
		{
			name:     "non crawler request",
			message:  "请帮我总结一篇文章",
			expected: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := shouldForceCrawlerPreparation(tc.message); got != tc.expected {
				t.Fatalf("expected %v, got %v", tc.expected, got)
			}
		})
	}
}

func TestEnsureCrawlerNodeDefaults(t *testing.T) {
	workflow := map[string]interface{}{
		"nodes": []interface{}{
			map[string]interface{}{
				"id":   "crawler-1",
				"type": "crawler",
				"data": map[string]interface{}{
					"config": map[string]interface{}{
						"url": "https://example.com/article/1",
					},
				},
			},
		},
	}

	changed := ensureCrawlerNodeDefaults(workflow)
	if !changed {
		t.Fatalf("expected crawler defaults to be added")
	}

	node := workflow["nodes"].([]interface{})[0].(map[string]interface{})
	config := node["data"].(map[string]interface{})["config"].(map[string]interface{})
	if config["method"] != "GET" {
		t.Fatalf("expected default method GET, got %#v", config["method"])
	}
	if config["extractMode"] != "smart" {
		t.Fatalf("expected default extractMode smart, got %#v", config["extractMode"])
	}
	if config["extractType"] != "text" {
		t.Fatalf("expected default extractType text, got %#v", config["extractType"])
	}
	if config["timeout"] != 30 {
		t.Fatalf("expected default timeout 30, got %#v", config["timeout"])
	}
	if config["retryCount"] != 3 {
		t.Fatalf("expected default retryCount 3, got %#v", config["retryCount"])
	}
	if config["useHeadless"] != false {
		t.Fatalf("expected default useHeadless false, got %#v", config["useHeadless"])
	}
}

func TestValidateCrawlerNodeConfigs(t *testing.T) {
	workflow := map[string]interface{}{
		"nodes": []interface{}{
			map[string]interface{}{
				"id":   "crawler-1",
				"type": "crawler",
				"data": map[string]interface{}{
					"config": map[string]interface{}{
						"method":      "GET",
						"extractMode": "custom",
						"extractType": "attr",
					},
				},
			},
		},
	}

	errors := validateCrawlerNodeConfigs(workflow)
	if len(errors) != 3 {
		t.Fatalf("expected 3 crawler config errors, got %d: %#v", len(errors), errors)
	}
}
