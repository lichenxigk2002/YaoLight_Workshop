package moonshot

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

type MoonshotProvider struct {
	client *http.Client
}

type moonshotMessage struct {
	Role       string                   `json:"role"`
	Content    string                   `json:"content,omitempty"`
	ToolCallID string                   `json:"tool_call_id,omitempty"`
	ToolCalls  []map[string]interface{} `json:"tool_calls,omitempty"`
	Partial    bool                     `json:"partial,omitempty"`
}

type moonshotStreamOptions struct {
	IncludeUsage bool `json:"include_usage,omitempty"`
}

type moonshotRequest struct {
	Model            string                 `json:"model"`
	Messages         []moonshotMessage      `json:"messages"`
	Tools            []providers.ToolDef    `json:"tools,omitempty"`
	Stream           bool                   `json:"stream,omitempty"`
	Temperature      *float64               `json:"temperature,omitempty"`
	MaxTokens        *int                   `json:"max_tokens,omitempty"`
	TopP             *float64               `json:"top_p,omitempty"`
	FrequencyPenalty *float64               `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64               `json:"presence_penalty,omitempty"`
	Stop             []string               `json:"stop,omitempty"`
	Thinking         map[string]interface{} `json:"thinking,omitempty"`
	StreamOptions    *moonshotStreamOptions `json:"stream_options,omitempty"`
}

type moonshotResponse struct {
	Choices []struct {
		Message struct {
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content,omitempty"`
			ToolCalls        []struct {
				ID       string `json:"id"`
				Type     string `json:"type"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls,omitempty"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Model string `json:"model"`
}

type moonshotStreamResponse struct {
	Choices []struct {
		Delta struct {
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content,omitempty"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
	Model string `json:"model,omitempty"`
}

func NewMoonshotProvider() providers.AIProvider {
	return &MoonshotProvider{
		client: providers.NewHTTPClient(),
	}
}

func (p *MoonshotProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	messages := buildPromptMessages(config.SystemPrompt, prompt, content)
	reqBody := buildRequest(config, messages, providerConfig, false)

	var response moonshotResponse
	if err := p.doJSONRequest(context.Background(), config, reqBody, &response); err != nil {
		return nil, err
	}

	return toChatResponse(config, &response)
}

func (p *MoonshotProvider) ChatWithTools(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}) (*providers.ChatResponseWithTools, error) {
	apiMessages := make([]moonshotMessage, 0, len(messages)+1)
	if systemPrompt != "" {
		apiMessages = append(apiMessages, moonshotMessage{
			Role:    "system",
			Content: systemPrompt,
		})
	}

	for _, message := range messages {
		msg := moonshotMessage{
			Role:       message.Role,
			Content:    message.Content,
			ToolCallID: message.ToolCallID,
		}
		if len(message.ToolCalls) > 0 {
			msg.ToolCalls = make([]map[string]interface{}, 0, len(message.ToolCalls))
			for _, tc := range message.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, map[string]interface{}{
					"id":   tc.ID,
					"type": tc.Type,
					"function": map[string]interface{}{
						"name":      tc.Function.Name,
						"arguments": tc.Function.Arguments,
					},
				})
			}
		}
		apiMessages = append(apiMessages, msg)
	}

	reqBody := buildRequest(config, apiMessages, providerConfig, false)
	if len(tools) > 0 {
		reqBody.Tools = tools
	}

	var response moonshotResponse
	if err := p.doJSONRequest(ctx, config, reqBody, &response); err != nil {
		return nil, err
	}
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	choice := response.Choices[0]
	out := &providers.ChatResponseWithTools{
		Content:    choice.Message.Content,
		TokensUsed: response.Usage.TotalTokens,
		Usage: &providers.TokenUsage{
			PromptTokens:     response.Usage.PromptTokens,
			CompletionTokens: response.Usage.CompletionTokens,
			TotalTokens:      response.Usage.TotalTokens,
		},
		Model: response.Model,
	}
	if out.Model == "" {
		out.Model = config.ModelName
	}

	for _, tc := range choice.Message.ToolCalls {
		out.ToolCalls = append(out.ToolCalls, &providers.ToolCall{
			ID:   tc.ID,
			Type: tc.Type,
			Function: struct {
				Name      string `json:"name"`
				Arguments string `json:"arguments"`
			}{
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			},
		})
	}

	return out, nil
}

func (p *MoonshotProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	reqCtx, cancel := withRequestTimeout(ctx, config.RequestTimeoutSeconds)
	defer cancel()

	messages := buildPromptMessages(config.SystemPrompt, prompt, content)
	reqBody := buildRequest(config, messages, providerConfig, true)
	reqBody.StreamOptions = &moonshotStreamOptions{IncludeUsage: true}

	baseURL := getBaseURL(config.BaseURL)
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	var fullContent strings.Builder
	var fullReasoning strings.Builder
	var usage *providers.TokenUsage

	for scanner.Scan() {
		select {
		case <-reqCtx.Done():
			callback("", true, reqCtx.Err(), usage)
			return reqCtx.Err()
		default:
		}

		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			callback(finalStreamContent(fullContent.String(), fullReasoning.String()), true, nil, usage)
			return nil
		}

		var chunk moonshotStreamResponse
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if chunk.Usage != nil {
			usage = &providers.TokenUsage{
				PromptTokens:     chunk.Usage.PromptTokens,
				CompletionTokens: chunk.Usage.CompletionTokens,
				TotalTokens:      chunk.Usage.TotalTokens,
			}
		}

		if len(chunk.Choices) == 0 {
			continue
		}

		delta := chunk.Choices[0].Delta
		if delta.ReasoningContent != "" {
			fullReasoning.WriteString(delta.ReasoningContent)
			callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil, usage)
		}
		if delta.Content != "" {
			fullContent.WriteString(delta.Content)
			callback("[CONTENT_DELTA]"+delta.Content, false, nil, usage)
		}

		if chunk.Choices[0].FinishReason != "" {
			callback(finalStreamContent(fullContent.String(), fullReasoning.String()), true, nil, usage)
			return nil
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read stream: %w", err)
	}

	callback(finalStreamContent(fullContent.String(), fullReasoning.String()), true, nil, usage)
	return nil
}

func (p *MoonshotProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	chatResp, err := p.Chat(config, prompt, "", nil)
	if err != nil {
		return nil, err
	}

	return &providers.CompleteResponse{
		Text:       chatResp.Content,
		TokensUsed: chatResp.TokensUsed,
	}, nil
}

func (p *MoonshotProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	return nil, fmt.Errorf("Moonshot embedding is not implemented yet")
}

func buildPromptMessages(systemPrompt, prompt, content string) []moonshotMessage {
	messages := make([]moonshotMessage, 0, 2)
	if systemPrompt != "" {
		messages = append(messages, moonshotMessage{
			Role:    "system",
			Content: systemPrompt,
		})
	}

	userContent := prompt
	if content != "" {
		userContent = fmt.Sprintf("%s\n\n%s", prompt, content)
	}
	messages = append(messages, moonshotMessage{
		Role:    "user",
		Content: userContent,
	})

	return messages
}

func buildRequest(config *providers.AIModelConfig, messages []moonshotMessage, providerConfig map[string]interface{}, stream bool) *moonshotRequest {
	reqBody := &moonshotRequest{
		Model:    config.ModelName,
		Messages: messages,
		Stream:   stream,
	}

	if temperature := normalizeMoonshotTemperature(config.ModelName, config.Temperature); temperature != nil {
		reqBody.Temperature = temperature
	}
	if config.MaxTokens != nil {
		reqBody.MaxTokens = config.MaxTokens
	}
	if topP := normalizeMoonshotTopP(config.ModelName, config.TopP); topP != nil {
		reqBody.TopP = topP
	}
	if config.FrequencyPenalty != nil {
		reqBody.FrequencyPenalty = config.FrequencyPenalty
	}
	if config.PresencePenalty != nil {
		reqBody.PresencePenalty = config.PresencePenalty
	}
	if len(config.StopSequences) > 0 {
		reqBody.Stop = config.StopSequences
	}
	if thinking := normalizeThinking(providerConfig); thinking != nil {
		reqBody.Thinking = thinking
	}

	return reqBody
}

func normalizeThinking(providerConfig map[string]interface{}) map[string]interface{} {
	if providerConfig == nil {
		return nil
	}

	if raw, ok := providerConfig["thinking"].(map[string]interface{}); ok && len(raw) > 0 {
		return raw
	}

	if enabled, ok := providerConfig["thinking"].(bool); ok {
		if enabled {
			return map[string]interface{}{"type": "enabled"}
		}
		return map[string]interface{}{"type": "disabled"}
	}

	if enabled, ok := providerConfig["reasoning"].(bool); ok {
		if enabled {
			return map[string]interface{}{"type": "enabled"}
		}
		return map[string]interface{}{"type": "disabled"}
	}

	return nil
}

func normalizeMoonshotTemperature(modelName string, temperature *float64) *float64 {
	if temperature == nil {
		return nil
	}

	if strings.EqualFold(modelName, "moonshot-v1") && *temperature != 1 {
		v := 1.0
		return &v
	}

	return temperature
}

func normalizeMoonshotTopP(modelName string, topP *float64) *float64 {
	if topP == nil {
		return nil
	}

	if strings.EqualFold(modelName, "moonshot-v1") && *topP != 0.95 {
		v := 0.95
		return &v
	}

	return topP
}

func (p *MoonshotProvider) doJSONRequest(ctx context.Context, config *providers.AIModelConfig, reqBody *moonshotRequest, out interface{}) error {
	reqCtx, cancel := withRequestTimeout(ctx, config.RequestTimeoutSeconds)
	defer cancel()

	baseURL := getBaseURL(config.BaseURL)
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	return nil
}

func toChatResponse(config *providers.AIModelConfig, response *moonshotResponse) (*providers.ChatResponse, error) {
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	choice := response.Choices[0]
	modelName := response.Model
	if modelName == "" {
		modelName = config.ModelName
	}

	return &providers.ChatResponse{
		Content:    choice.Message.Content,
		TokensUsed: response.Usage.TotalTokens,
		Usage: &providers.TokenUsage{
			PromptTokens:     response.Usage.PromptTokens,
			CompletionTokens: response.Usage.CompletionTokens,
			TotalTokens:      response.Usage.TotalTokens,
		},
		Model:            modelName,
		ReasoningDetails: choice.Message.ReasoningContent,
	}, nil
}

func finalStreamContent(content, reasoning string) string {
	if reasoning == "" {
		return content
	}
	return "[REASONING]" + reasoning + "[/REASONING]" + content
}

func getBaseURL(baseURL string) string {
	if strings.TrimSpace(baseURL) == "" {
		return "https://api.moonshot.cn/v1"
	}
	return strings.TrimRight(baseURL, "/")
}

func withRequestTimeout(ctx context.Context, seconds int) (context.Context, context.CancelFunc) {
	if seconds <= 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, time.Duration(seconds)*time.Second)
}
