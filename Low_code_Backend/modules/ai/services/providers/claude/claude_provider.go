package claude

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

// ClaudeProvider Claude提供商实现 (via OpenRouter)
type ClaudeProvider struct {
	client *http.Client
}

// NewClaudeProvider 创建Claude提供商实例
func NewClaudeProvider() providers.AIProvider {
	return &ClaudeProvider{
		client: &http.Client{},
	}
}

// Chat 聊天对话
func (p *ClaudeProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	// 构建请求URL
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息
	var messages []map[string]interface{}

	// 尝试解析 prompt 是否为 JSON 数组（支持直接传递消息历史）
	var rawMessages []map[string]interface{}
	if strings.HasPrefix(strings.TrimSpace(prompt), "[") {
		if err := json.Unmarshal([]byte(prompt), &rawMessages); err == nil {
			messages = rawMessages
		}
	}

	// 如果没有解析出消息列表，则构建标准消息
	if messages == nil {
		// Claude支持multimodal content（文本和图片）
		// 如果content包含图片URL，需要构建content数组
		messageContent := prompt
		if content != "" {
			messageContent = fmt.Sprintf("%s\n\n%s", prompt, content)
		}

		// 检查是否包含图片URL（简单检测，实际使用中可能需要更复杂的解析）
		// 这里先使用简单的文本格式，如果需要支持图片，可以在providerConfig中传递
		messages = []map[string]interface{}{
			{
				"role":    "user",
				"content": messageContent,
			},
		}

		// 如果providerConfig中指定了multimodal content，使用它
		if multimodalContent, ok := providerConfig["multimodalContent"]; ok {
			if contentArray, ok := multimodalContent.([]interface{}); ok {
				messages[0]["content"] = contentArray
			}
		}
	}

	// 如果有系统提示词，添加到消息开头
	if config.SystemPrompt != "" {
		messages = append([]map[string]interface{}{
			{
				"role":    "system",
				"content": config.SystemPrompt,
			},
		}, messages...)
	}

	// 构建请求体
	requestBody := map[string]interface{}{
		"model":       config.ModelName,
		"messages":    messages,
		"temperature": 0.7,
		"max_tokens":  2000,
	}

	// 处理 providerConfig 中的参数
	// Claude通过OpenRouter支持reasoning参数
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
	} else if val, ok := providerConfig["thinking"]; ok {
		// 兼容 thinking 参数
		if enabled, ok := val.(bool); ok && enabled {
			reasoningConfig := map[string]interface{}{
				"enabled": true,
			}
			if effort, ok := providerConfig["reasoning_effort"].(string); ok && effort != "" {
				reasoningConfig["effort"] = effort
			}
			requestBody["reasoning"] = reasoningConfig
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
	// 处理 frequency_penalty 和 presence_penalty
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
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建HTTP请求
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))
	// OpenRouter specific headers
	req.Header.Set("HTTP-Referer", "https://github.com/yaolight-workshop")
	req.Header.Set("X-Title", "YaoLight Workshop")

	// 发送请求
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// 解析响应
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
				AudioTokens  int `json:"audio_tokens"`
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
	if response.Usage.PromptTokensDetails.AudioTokens > 0 {
		audio := response.Usage.PromptTokensDetails.AudioTokens
		usage.AudioTokens = &audio
	}

	return &providers.ChatResponse{
		Content:          response.Choices[0].Message.Content,
		TokensUsed:       response.Usage.TotalTokens,
		Usage:            usage,
		Model:            config.ModelName,
		ReasoningDetails: response.Choices[0].Message.ReasoningDetails,
	}, nil
}

// ChatStream 流式聊天对话
func (p *ClaudeProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	// 构建请求URL
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息
	messages := []map[string]interface{}{
		{
			"role":    "user",
			"content": prompt,
		},
	}
	if content != "" {
		messages[0]["content"] = fmt.Sprintf("%s\n\n%s", prompt, content)
	}

	// 如果providerConfig中指定了multimodal content，使用它
	if multimodalContent, ok := providerConfig["multimodalContent"]; ok {
		if contentArray, ok := multimodalContent.([]interface{}); ok {
			messages[0]["content"] = contentArray
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

	// 构建请求体
	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   true,
		"stream_options": map[string]interface{}{
			"include_usage": true,
		},
	}

	// 处理 providerConfig 中的参数
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
	} else if val, ok := providerConfig["thinking"]; ok {
		if enabled, ok := val.(bool); ok && enabled {
			reasoningConfig := map[string]interface{}{
				"enabled": true,
			}
			if effort, ok := providerConfig["reasoning_effort"].(string); ok && effort != "" {
				reasoningConfig["effort"] = effort
			}
			requestBody["reasoning"] = reasoningConfig
		}
	}

	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
	}

	// 处理 frequency_penalty 和 presence_penalty
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

	// 读取流式响应
	reader := bufio.NewReader(resp.Body)
	var fullContent strings.Builder
	var fullReasoningContent strings.Builder

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

		// SSE格式: data: {...}
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
						AudioTokens  int `json:"audio_tokens"`
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
				if streamResponse.Usage.PromptTokensDetails.AudioTokens > 0 {
					audio := streamResponse.Usage.PromptTokensDetails.AudioTokens
					usage.AudioTokens = &audio
				}
				callback("", true, nil, usage)
				return nil
			}

			if len(streamResponse.Choices) > 0 {
				delta := streamResponse.Choices[0].Delta

				// 尝试提取推理内容
				if delta.Reasoning != nil {
					if rStr, ok := delta.Reasoning.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
					}
				} else if delta.ReasoningDetails != nil {
					if rStr, ok := delta.ReasoningDetails.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
					}
				} else if delta.ReasoningContent != "" {
					fullReasoningContent.WriteString(delta.ReasoningContent)
					callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil, nil)
				}

				// 处理正常内容
				if delta.Content != "" {
					fullContent.WriteString(delta.Content)
					callback("[CONTENT_DELTA]"+delta.Content, false, nil, nil)
				}
			}
		}
	}

	return nil
}

// Complete 文本补全
func (p *ClaudeProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	chatResp, err := p.Chat(config, prompt, "", nil)
	if err != nil {
		return nil, err
	}
	return &providers.CompleteResponse{
		Text:       chatResp.Content,
		TokensUsed: chatResp.TokensUsed,
	}, nil
}

// Embed 文本嵌入
func (p *ClaudeProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	return nil, fmt.Errorf("Claude via OpenRouter does not support embedding API directly yet")
}
