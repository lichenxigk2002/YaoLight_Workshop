package doubao

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

// DoubaoProvider 豆包提供商实现（纯 HTTP 实现）
type DoubaoProvider struct {
	client *http.Client
}

// NewDoubaoProvider 创建豆包提供商实例
func NewDoubaoProvider() providers.AIProvider {
	return &DoubaoProvider{
		client: &http.Client{},
	}
}

// Chat 聊天对话（非流式）
func (p *DoubaoProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息
	messages := []map[string]interface{}{}
	if config.SystemPrompt != "" {
		messages = append(messages, map[string]interface{}{
			"role":    "system",
			"content": config.SystemPrompt,
		})
	}

	userContent := prompt
	if content != "" {
		userContent = fmt.Sprintf("%s\n\n%s", prompt, content)
	}
	messages = append(messages, map[string]interface{}{
		"role":    "user",
		"content": userContent,
	})

	// 构建请求体
	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   false,
	}

	// 添加可选参数
	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建请求
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

	// 发送请求
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
		return nil, fmt.Errorf("豆包 API 错误 (状态码 %d): %s", resp.StatusCode, string(body))
	}

	// 解析响应
	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
		Model string `json:"model"`
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

	return &providers.ChatResponse{
		Content:    response.Choices[0].Message.Content,
		TokensUsed: usage.TotalTokens,
		Usage:      usage,
		Model:      response.Model,
	}, nil
}

// ChatStream 流式聊天对话
func (p *DoubaoProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	messages := []map[string]interface{}{}
	if config.SystemPrompt != "" {
		messages = append(messages, map[string]interface{}{
			"role":    "system",
			"content": config.SystemPrompt,
		})
	}

	userContent := prompt
	if content != "" {
		userContent = fmt.Sprintf("%s\n\n%s", prompt, content)
	}
	messages = append(messages, map[string]interface{}{
		"role":    "user",
		"content": userContent,
	})

	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   true,
		"stream_options": map[string]interface{}{
			"include_usage": true,
		},
	}

	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
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

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("豆包 API 错误 (状态码 %d): %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				callback("", true, nil, nil)
				return nil
			}

			var streamResp struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
				Usage *struct {
					PromptTokens     int `json:"prompt_tokens"`
					CompletionTokens int `json:"completion_tokens"`
					TotalTokens      int `json:"total_tokens"`
				} `json:"usage"`
			}

			if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
				continue
			}

			if streamResp.Usage != nil {
				usage := &providers.TokenUsage{
					PromptTokens:     streamResp.Usage.PromptTokens,
					CompletionTokens: streamResp.Usage.CompletionTokens,
					TotalTokens:      streamResp.Usage.TotalTokens,
				}
				callback("", false, nil, usage)
			}

			if len(streamResp.Choices) > 0 {
				content := streamResp.Choices[0].Delta.Content
				if content != "" {
					callback("[CONTENT_DELTA]"+content, false, nil, nil)
				}
				if streamResp.Choices[0].FinishReason != "" {
					// 流结束，如果不包含 usage，可能在下一个 chunk
				}
			}
		}
	}

	return nil
}

// Complete 文本补全
func (p *DoubaoProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
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
func (p *DoubaoProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	return nil, fmt.Errorf("豆包暂不支持文本嵌入")
}
