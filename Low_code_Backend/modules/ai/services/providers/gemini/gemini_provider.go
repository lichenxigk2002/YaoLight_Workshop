package gemini

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

// GeminiProvider Gemini提供商实现 (via OpenRouter)
type GeminiProvider struct {
	client *http.Client
}

// NewGeminiProvider 创建Gemini提供商实例
func NewGeminiProvider() providers.AIProvider {
	return &GeminiProvider{
		client: &http.Client{},
	}
}

// Chat 聊天对话
func (p *GeminiProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
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
	// 检查是否启用 reasoning
	if val, ok := providerConfig["reasoning"]; ok {
		if enabled, ok := val.(bool); ok && enabled {
			// 如果指定了 effort，则包含它
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

	if len(config.StopSequences) > 0 {
		requestBody["stop"] = config.StopSequences
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
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	return &providers.ChatResponse{
		Content:          response.Choices[0].Message.Content,
		TokensUsed:       response.Usage.TotalTokens,
		Model:            config.ModelName,
		ReasoningDetails: response.Choices[0].Message.ReasoningDetails,
	}, nil
}

// ChatStream 流式聊天对话
func (p *GeminiProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
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
	}

	// 处理 providerConfig 中的参数
	if val, ok := providerConfig["reasoning"]; ok {
		if enabled, ok := val.(bool); ok && enabled {
			// 如果指定了 effort，则包含它
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
	// 使用 bufio.Reader 而不是 Scanner，以更好地处理可能包含长行的SSE
	reader := bufio.NewReader(resp.Body)
	var fullContent strings.Builder
	var fullReasoningContent strings.Builder

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			// 检查 context 是否已取消
			select {
			case <-ctx.Done():
				callback("", true, ctx.Err())
				return ctx.Err()
			default:
				// 如果是其他错误，返回错误
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
				// 流式完成时，不需要发送完整内容（已经在增量中发送了）
				// 只发送完成信号
				callback("", true, nil)
				return nil
			}

			var streamResponse struct {
				Choices []struct {
					Delta struct {
						Content          string      `json:"content"`
						ReasoningDetails interface{} `json:"reasoning_details,omitempty"`
						Reasoning        interface{} `json:"reasoning,omitempty"`         // Possible field name
						ReasoningContent string      `json:"reasoning_content,omitempty"` // DeepSeek style
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				continue
			}

			if len(streamResponse.Choices) > 0 {
				delta := streamResponse.Choices[0].Delta

				// 尝试提取推理内容（按优先级检查不同的字段名）
				// 1. Check reasoning_details (OpenRouter/Gemini 官方字段名)
				// 注意：OpenRouter 文档指出 Reasoning Tokens 可能出现在 reasoning 字段中
				// 且可能是 output tokens 的一部分

				// 检查 reasoning 字段 (OpenRouter 标准)
				if delta.Reasoning != nil {
					if rStr, ok := delta.Reasoning.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil)
					}
				} else if delta.ReasoningDetails != nil {
					// 2. Check reasoning_details (Gemini 原生或其他)
					if rStr, ok := delta.ReasoningDetails.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil)
					}
				} else if delta.ReasoningContent != "" {
					// 3. Check reasoning_content (DeepSeek R1 style)
					fullReasoningContent.WriteString(delta.ReasoningContent)
					callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil)
				}

				// 处理正常内容
				if delta.Content != "" {
					fullContent.WriteString(delta.Content)
					callback("[CONTENT_DELTA]"+delta.Content, false, nil)
				}
			}
		}
	}

	return nil
}

// Complete 文本补全
func (p *GeminiProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
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
func (p *GeminiProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	return nil, fmt.Errorf("Gemini via OpenRouter does not support embedding API directly yet")
}
