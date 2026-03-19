package agentic

import (
	"strings"
	"testing"

	"yaolight-workshop/backend/modules/ai/services/providers"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
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

func TestShouldUseAgenticPlanning(t *testing.T) {
	cases := []struct {
		name     string
		message  string
		expected bool
	}{
		{
			name:     "plain greeting",
			message:  "你好，你是谁？",
			expected: false,
		},
		{
			name:     "usage question",
			message:  "工作流编辑器怎么用？",
			expected: false,
		},
		{
			name:     "inspect current workflow",
			message:  "帮我看看当前工作流哪里有问题",
			expected: true,
		},
		{
			name:     "modify nodes on canvas",
			message:  "把当前画布里的节点整理一下，顺便优化连线",
			expected: true,
		},
		{
			name:     "generate workflow",
			message:  "帮我生成一个抓取新闻并总结的工作流",
			expected: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := shouldUseAgenticPlanning(tc.message, ""); got != tc.expected {
				t.Fatalf("shouldUseAgenticPlanning(%q) = %v, want %v", tc.message, got, tc.expected)
			}
		})
	}
}

func TestDecideRoute(t *testing.T) {
	cases := []struct {
		name string
		msg  string
		want RouteMode
	}{
		{
			name: "plain chat",
			msg:  "你好，你是谁？",
			want: RouteChat,
		},
		{
			name: "analyze current workflow",
			msg:  "帮我看看当前工作流哪里有问题",
			want: RouteAnalyze,
		},
		{
			name: "modify current workflow",
			msg:  "把当前画布里的节点整理一下，顺便优化连线",
			want: RouteAct,
		},
		{
			name: "generate workflow",
			msg:  "帮我生成一个新闻摘要工作流",
			want: RouteAct,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := DecideRoute(TurnContext{
				Request: RunStreamRequest{Message: tc.msg},
			})
			if got.Mode != tc.want {
				t.Fatalf("DecideRoute(%q) = %s, want %s", tc.msg, got.Mode, tc.want)
			}
		})
	}
}

func TestProcessDirectChatStreamChunkStripsTaggedMarkers(t *testing.T) {
	var fullContent strings.Builder
	var fullReasoning strings.Builder

	processDirectChatStreamChunk(nil, &fullContent, &fullReasoning, "[CONTENT_DELTA]你好")
	processDirectChatStreamChunk(nil, &fullContent, &fullReasoning, "[CONTENT_DELTA]呀")
	processDirectChatStreamChunk(nil, &fullContent, &fullReasoning, "[REASONING_DELTA]skip")
	processDirectChatStreamChunk(nil, &fullContent, &fullReasoning, "[CONTENT]你好呀[/CONTENT]")

	if got := fullContent.String(); got != "你好呀" {
		t.Fatalf("expected tagged stream content to be stripped, got %q", got)
	}
	if got := fullReasoning.String(); got != "skip" {
		t.Fatalf("expected reasoning delta to stay in reasoning buffer, got %q", got)
	}
}

func TestBuildConversationHistoryForDecisionExcludesCurrentMessage(t *testing.T) {
	messages := []alkaidModels.AlkaidMessage{
		{ID: 1, Role: "user", Content: "first question"},
		{ID: 2, Role: "assistant", Content: "first answer"},
		{ID: 3, Role: "user", Content: "latest question"},
	}

	got := buildConversationHistoryForDecision(messages, 3)
	if strings.Contains(got, "latest question") {
		t.Fatalf("expected latest user message to be excluded, got %q", got)
	}
	if !strings.Contains(got, "first question") || !strings.Contains(got, "first answer") {
		t.Fatalf("expected previous conversation to stay in history, got %q", got)
	}
}

func TestBuildToolContentForLLMPrefersGetWorkflowLLMView(t *testing.T) {
	result := map[string]interface{}{
		"llmView": map[string]interface{}{
			"summary": "workflow snapshot",
			"nodes": []interface{}{
				map[string]interface{}{"id": "node-1", "type": "start"},
			},
		},
		"workflow": map[string]interface{}{
			"raw": strings.Repeat("x", 50000),
		},
	}

	got := buildToolContentForLLM("get_workflow", result, "fallback summary")
	if got == "fallback summary" {
		t.Fatalf("expected get_workflow to prefer llmView over summary")
	}
	if !strings.Contains(got, `"summary":"workflow snapshot"`) {
		t.Fatalf("expected llmView JSON content, got %q", got)
	}
	if strings.Contains(got, `"raw"`) {
		t.Fatalf("expected large raw workflow payload to stay out of llm content, got %q", got)
	}
}

func TestBuildToolContentForLLMFallsBackToSummaryForLargeNonWorkflowResult(t *testing.T) {
	result := map[string]interface{}{
		"payload": strings.Repeat("y", 9000),
	}

	got := buildToolContentForLLM("search_knowledge", result, "summary only")
	if got != "summary only" {
		t.Fatalf("expected large non-workflow tool result to fall back to summary, got %q", got)
	}
}

func TestBuildAnalyzeUserPromptConstrainsAnalyzeMode(t *testing.T) {
	got := buildAnalyzeUserPrompt("帮我看看当前工作流", "用户：之前的上下文")
	if !strings.Contains(got, "workflow analyze mode") {
		t.Fatalf("expected analyze mode marker in prompt, got %q", got)
	}
	if !strings.Contains(got, "不要交付待应用工作流") {
		t.Fatalf("expected analyze prompt to forbid delivery actions, got %q", got)
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
