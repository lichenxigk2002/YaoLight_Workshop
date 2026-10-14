package gpt

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"yaolight-workshop/backend/modules/ai/services/providers"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestChatWithToolsSendsToolsAndParsesToolCalls(t *testing.T) {
	var received map[string]interface{}
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body: io.NopCloser(bytes.NewBufferString(`{
			"choices":[{
				"message":{
					"content":"",
					"tool_calls":[{
						"id":"call_1",
						"type":"function",
						"function":{"name":"get_workflow","arguments":"{}"}
					}]
				}
			}],
			"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}
		}`)),
		}, nil
	})}

	provider := &GPTProvider{client: client}
	resp, err := provider.ChatWithTools(
		context.Background(),
		&providers.AIModelConfig{
			Provider:  "gpt",
			ModelName: "openai/gpt-5.4",
			APIKey:    "test-key",
			BaseURL:   "https://openrouter.test/v1",
		},
		"system",
		[]providers.ChatMessage{{Role: "user", Content: "解释当前工作流"}},
		[]providers.ToolDef{{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "get_workflow",
				Description: "Get workflow",
				Parameters:  map[string]interface{}{"type": "object"},
			},
		}},
		nil,
	)
	if err != nil {
		t.Fatalf("ChatWithTools returned error: %v", err)
	}
	if len(resp.ToolCalls) != 1 {
		t.Fatalf("expected one tool call, got %d", len(resp.ToolCalls))
	}
	if resp.ToolCalls[0].Function.Name != "get_workflow" {
		t.Fatalf("unexpected tool call name: %s", resp.ToolCalls[0].Function.Name)
	}
	if resp.TokensUsed != 15 {
		t.Fatalf("unexpected token usage: %d", resp.TokensUsed)
	}

	tools, ok := received["tools"].([]interface{})
	if !ok || len(tools) != 1 {
		t.Fatalf("expected request to include one tool, got %#v", received["tools"])
	}
	messages, ok := received["messages"].([]interface{})
	if !ok || len(messages) != 2 {
		t.Fatalf("expected system + user messages, got %#v", received["messages"])
	}
}

func TestChatWithToolsStreamEmitsContentDeltas(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
			Body: io.NopCloser(bytes.NewBufferString(
				"data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n\n" +
					"data: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}\n\n" +
					"data: {\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2,\"total_tokens\":3}}\n\n" +
					"data: [DONE]\n\n",
			)),
		}, nil
	})}

	provider := &GPTProvider{client: client}
	var streamed string
	resp, err := provider.ChatWithToolsStream(
		context.Background(),
		&providers.AIModelConfig{
			Provider:  "gpt",
			ModelName: "openai/gpt-5.2-pro",
			APIKey:    "test-key",
			BaseURL:   "https://openrouter.test/v1",
		},
		"system",
		[]providers.ChatMessage{{Role: "user", Content: "打招呼"}},
		nil,
		nil,
		func(content string, done bool, err error, usage *providers.TokenUsage) {
			if err != nil {
				t.Fatalf("stream callback error: %v", err)
			}
			streamed += content
		},
	)
	if err != nil {
		t.Fatalf("ChatWithToolsStream returned error: %v", err)
	}
	if streamed != "你好" {
		t.Fatalf("expected streamed content, got %q", streamed)
	}
	if resp.Content != "你好" {
		t.Fatalf("expected full response content, got %q", resp.Content)
	}
	if resp.TokensUsed != 3 {
		t.Fatalf("unexpected token usage: %d", resp.TokensUsed)
	}
}
