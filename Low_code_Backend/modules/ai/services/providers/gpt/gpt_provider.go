package gpt

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

type GPTProvider struct {
	client *http.Client
}

func NewGPTProvider() providers.AIProvider {
	return &GPTProvider{
		client: &http.Client{},
	}
}

func (p *GPTProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	var messages []map[string]interface{}

	var rawMessages []map[string]interface{}
	if strings.HasPrefix(strings.TrimSpace(prompt), "[") {
		if err := json.Unmarshal([]byte(prompt), &rawMessages); err == nil {
			messages = rawMessages
		}
	}

	if messages == nil {
		messages = []map[string]interface{}{
			{
				"role":    "user",
				"content": prompt,
			},
		}
		if content != "" {
			messages[0]["content"] = fmt.Sprintf("%s\n\n%s", prompt, content)
		}
	}

	if config.SystemPrompt != "" {
		messages = append([]map[string]interface{}{
			{
				"role":    "system",
				"content": config.SystemPrompt,
			},
		}, messages...)
	}

	requestBody := map[string]interface{}{
		"model":       config.ModelName,
		"messages":    messages,
		"temperature": 0.7,
		"max_tokens":  2000,
	}

	if val, ok := providerConfig["reasoning"]; ok {
		if enabled, ok := val.(bool); ok && enabled {
			reasoningConfig := map[string]interface{}{
				"enabled": true,
			}
			if effort, ok := providerConfig["reasoning_effort"].(string); ok && effort != "" {
				reasoningConfig["effort"] = effort
			}
			requestBody["reasoning"] = reasoningConfig
		} else if reasoningMap, ok := val.(map[string]interface{}); ok {
			requestBody["reasoning"] = reasoningMap
		}
	}

	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
	}
	if config.TopP != nil {
		requestBody["top_p"] = *config.TopP
	}
	if val, ok := providerConfig["frequencyPenalty"]; ok {
		if fp, ok := val.(float64); ok {
			requestBody["frequency_penalty"] = fp
		}
	}
	if val, ok := providerConfig["presencePenalty"]; ok {
		if pp, ok := val.(float64); ok {
			requestBody["presence_penalty"] = pp
		}
	}

	if len(config.StopSequences) > 0 {
		requestBody["stop"] = config.StopSequences
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))
	req.Header.Set("HTTP-Referer", "https://github.com/yaolight-workshop")
	req.Header.Set("X-Title", "YaoLight Workshop")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content          string      `json:"content"`
				ReasoningDetails interface{} `json:"reasoning_details,omitempty"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens        int `json:"prompt_tokens"`
			CompletionTokens    int `json:"completion_tokens"`
			TotalTokens         int `json:"total_tokens"`
			PromptTokensDetails struct {
				CachedTokens int `json:"cached_tokens"`
			} `json:"prompt_tokens_details"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	usage := &providers.TokenUsage{
		PromptTokens:     response.Usage.PromptTokens,
		CompletionTokens: response.Usage.CompletionTokens,
		TotalTokens:      response.Usage.TotalTokens,
	}
	if response.Usage.PromptTokensDetails.CachedTokens > 0 {
		cached := response.Usage.PromptTokensDetails.CachedTokens
		usage.CacheReadTokens = &cached
	}

	return &providers.ChatResponse{
		Content:          response.Choices[0].Message.Content,
		TokensUsed:       response.Usage.TotalTokens,
		Usage:            usage,
		Model:            config.ModelName,
		ReasoningDetails: response.Choices[0].Message.ReasoningDetails,
	}, nil
}

func (p *GPTProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	messages := []map[string]interface{}{
		{
			"role":    "user",
			"content": prompt,
		},
	}
	if content != "" {
		messages[0]["content"] = fmt.Sprintf("%s\n\n%s", prompt, content)
	}

	if config.SystemPrompt != "" {
		messages = append([]map[string]interface{}{
			{
				"role":    "system",
				"content": config.SystemPrompt,
			},
		}, messages...)
	}

	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   true,
		"stream_options": map[string]interface{}{
			"include_usage": true,
		},
	}

	if val, ok := providerConfig["reasoning"]; ok {
		if enabled, ok := val.(bool); ok && enabled {
			reasoningConfig := map[string]interface{}{
				"enabled": true,
			}
			if effort, ok := providerConfig["reasoning_effort"].(string); ok && effort != "" {
				reasoningConfig["effort"] = effort
			}
			requestBody["reasoning"] = reasoningConfig
		} else if reasoningMap, ok := val.(map[string]interface{}); ok {
			requestBody["reasoning"] = reasoningMap
		}
	}

	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
	}

	if val, ok := providerConfig["frequencyPenalty"]; ok {
		if fp, ok := val.(float64); ok {
			requestBody["frequency_penalty"] = fp
		}
	}
	if val, ok := providerConfig["presencePenalty"]; ok {
		if pp, ok := val.(float64); ok {
			requestBody["presence_penalty"] = pp
		}
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))
	req.Header.Set("HTTP-Referer", "https://github.com/yaolight-workshop")
	req.Header.Set("X-Title", "YaoLight Workshop")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	reader := bufio.NewReader(resp.Body)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			select {
			case <-ctx.Done():
				callback("", true, ctx.Err(), nil)
				return ctx.Err()
			default:
				return fmt.Errorf("failed to read stream: %w", err)
			}
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				callback("", true, nil, nil)
				return nil
			}

			var streamResponse struct {
				Choices []struct {
					Delta struct {
						Content          string      `json:"content"`
						ReasoningDetails interface{} `json:"reasoning_details,omitempty"`
						Reasoning        interface{} `json:"reasoning,omitempty"`
						ReasoningContent string      `json:"reasoning_content,omitempty"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
				Usage *struct {
					PromptTokens        int `json:"prompt_tokens"`
					CompletionTokens    int `json:"completion_tokens"`
					TotalTokens         int `json:"total_tokens"`
					PromptTokensDetails struct {
						CachedTokens int `json:"cached_tokens"`
					} `json:"prompt_tokens_details"`
				} `json:"usage"`
			}

			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				continue
			}

			// 如果有Token使用信息，传递给回调
			if streamResponse.Usage != nil {
				usage := &providers.TokenUsage{
					PromptTokens:     streamResponse.Usage.PromptTokens,
					CompletionTokens: streamResponse.Usage.CompletionTokens,
					TotalTokens:      streamResponse.Usage.TotalTokens,
				}
				if streamResponse.Usage.PromptTokensDetails.CachedTokens > 0 {
					cached := streamResponse.Usage.PromptTokensDetails.CachedTokens
					usage.CacheReadTokens = &cached
				}
				callback("", true, nil, usage)
				return nil
			}

			if len(streamResponse.Choices) > 0 {
				delta := streamResponse.Choices[0].Delta

				if delta.Reasoning != nil {
					if rStr, ok := delta.Reasoning.(string); ok && rStr != "" {
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
					}
				} else if delta.ReasoningDetails != nil {
					if rStr, ok := delta.ReasoningDetails.(string); ok && rStr != "" {
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
					}
				} else if delta.ReasoningContent != "" {
					callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil, nil)
				}

				if delta.Content != "" {
					callback("[CONTENT_DELTA]"+delta.Content, false, nil, nil)
				}
			}
		}
	}

	return nil
}

func (p *GPTProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	chatResp, err := p.Chat(config, prompt, "", nil)
	if err != nil {
		return nil, err
	}
	return &providers.CompleteResponse{
		Text:       chatResp.Content,
		TokensUsed: chatResp.TokensUsed,
	}, nil
}

func (p *GPTProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	return nil, fmt.Errorf("GPT via OpenRouter does not support embedding API directly yet")
}
