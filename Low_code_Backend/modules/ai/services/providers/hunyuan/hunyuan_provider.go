package hunyuan

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

type HunyuanProvider struct {
	client *http.Client
}

func NewHunyuanProvider() providers.AIProvider {
	return &HunyuanProvider{
		client: &http.Client{},
	}
}

func normalizeBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	baseURL = strings.TrimRight(baseURL, "/")
	return baseURL
}

func buildMessages(config *providers.AIModelConfig, prompt string, content string) []map[string]interface{} {
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

	return messages
}

func applyEnableEnhancement(requestBody map[string]interface{}, providerConfig map[string]interface{}) {
	if providerConfig == nil {
		return
	}
	if v, ok := providerConfig["enable_enhancement"].(bool); ok {
		requestBody["enable_enhancement"] = v
		return
	}
	if v, ok := providerConfig["enableEnhancement"].(bool); ok {
		requestBody["enable_enhancement"] = v
	}
}

func (p *HunyuanProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.hunyuan.cloud.tencent.com/v1"
	}
	baseURL = normalizeBaseURL(baseURL)
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": buildMessages(config, prompt, content),
		"stream":   false,
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
	if config.FrequencyPenalty != nil {
		requestBody["frequency_penalty"] = *config.FrequencyPenalty
	}
	if config.PresencePenalty != nil {
		requestBody["presence_penalty"] = *config.PresencePenalty
	}
	if len(config.StopSequences) > 0 {
		requestBody["stop"] = config.StopSequences
	}

	applyEnableEnhancement(requestBody, providerConfig)

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
				Content          string `json:"content"`
				ReasoningContent string `json:"reasoning_content,omitempty"`
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

	var reasoning interface{}
	if response.Choices[0].Message.ReasoningContent != "" {
		reasoning = response.Choices[0].Message.ReasoningContent
	}

	return &providers.ChatResponse{
		Content:          response.Choices[0].Message.Content,
		TokensUsed:       response.Usage.TotalTokens,
		Model:            config.ModelName,
		ReasoningDetails: reasoning,
	}, nil
}

// fetchUsageFromNonStreamRequest 通过非流式请求获取usage信息
func fetchHunyuanUsageFromNonStreamRequest(ctx context.Context, client *http.Client, url string, apiKey string, modelName string, messages []map[string]interface{}) *providers.TokenUsage {
	// 发送一个非流式请求来获取usage（只请求1个token，最小化消耗）
	usageRequest := map[string]interface{}{
		"model":      modelName,
		"messages":   messages,
		"stream":     false,
		"max_tokens": 1, // 只请求1个token，最小化消耗
	}

	usageJsonData, err := json.Marshal(usageRequest)
	if err != nil {
		return nil
	}

	usageReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(usageJsonData))
	if err != nil {
		return nil
	}

	usageReq.Header.Set("Content-Type", "application/json")
	usageReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	usageResp, err := client.Do(usageReq)
	if err != nil {
		return nil
	}
	defer usageResp.Body.Close()

	if usageResp.StatusCode != http.StatusOK {
		return nil
	}

	body, err := io.ReadAll(usageResp.Body)
	if err != nil {
		return nil
	}

	var usageResponse struct {
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &usageResponse); err != nil {
		return nil
	}

	if usageResponse.Usage.TotalTokens > 0 {
		return &providers.TokenUsage{
			PromptTokens:     usageResponse.Usage.PromptTokens,
			CompletionTokens: usageResponse.Usage.CompletionTokens,
			TotalTokens:      usageResponse.Usage.TotalTokens,
		}
	}
	return nil
}

func (p *HunyuanProvider) ChatWithTools(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}) (*providers.ChatResponseWithTools, error) {
	return nil, fmt.Errorf("tool calling not implemented for Hunyuan provider")
}

func (p *HunyuanProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.hunyuan.cloud.tencent.com/v1"
	}
	baseURL = normalizeBaseURL(baseURL)
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息列表（用于后续获取usage）
	messages := buildMessages(config, prompt, content)

	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   true,
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
	if config.FrequencyPenalty != nil {
		requestBody["frequency_penalty"] = *config.FrequencyPenalty
	}
	if config.PresencePenalty != nil {
		requestBody["presence_penalty"] = *config.PresencePenalty
	}
	if len(config.StopSequences) > 0 {
		requestBody["stop"] = config.StopSequences
	}

	applyEnableEnhancement(requestBody, providerConfig)

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
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	reader := bufio.NewReader(resp.Body)
	var lastUsage *providers.TokenUsage // 保存最后一次的usage信息
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

		if strings.HasPrefix(line, "data:") {
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if data == "" {
				continue
			}
			if data == "[DONE]" {
				// 构造最终内容
				finalContent := ""
				if fullReasoningContent.Len() > 0 {
					finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
				}
				if fullContent.Len() > 0 {
					finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
				}

				// **关键修复**：如果流结束时还没有收到usage，使用非流式请求获取usage
				if lastUsage == nil {
					lastUsage = fetchHunyuanUsageFromNonStreamRequest(ctx, p.client, url, config.APIKey, config.ModelName, messages)
				}

				callback(finalContent, true, nil, lastUsage)
				return nil
			}

			var streamResponse struct {
				Choices []struct {
					Delta struct {
						Content          string `json:"content"`
						ReasoningContent string `json:"reasoning_content,omitempty"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
				Usage *providers.TokenUsage `json:"usage"`
			}

			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				continue
			}

			// **关键修复**：保存usage信息，但不立即返回，继续处理内容
			if streamResponse.Usage != nil {
				lastUsage = streamResponse.Usage
				// 立即回调usage，确保计费逻辑能及时处理
				callback("", false, nil, streamResponse.Usage)
			}

			if len(streamResponse.Choices) > 0 {
				delta := streamResponse.Choices[0].Delta
				if delta.ReasoningContent != "" {
					fullReasoningContent.WriteString(delta.ReasoningContent)
					callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil, nil)
				}
				if delta.Content != "" {
					fullContent.WriteString(delta.Content)
					callback("[CONTENT_DELTA]"+delta.Content, false, nil, nil)
				}

				// 检查是否有完成标志
				if streamResponse.Choices[0].FinishReason != "" {
					// 构造最终内容
					finalContent := ""
					if fullReasoningContent.Len() > 0 {
						finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
					}
					if fullContent.Len() > 0 {
						finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
					}

					// **关键修复**：如果流结束时还没有收到usage，使用非流式请求获取usage
					if lastUsage == nil {
						lastUsage = fetchHunyuanUsageFromNonStreamRequest(ctx, p.client, url, config.APIKey, config.ModelName, messages)
					}

					callback(finalContent, true, nil, lastUsage)
					return nil
				}
			}
		}
	}

	// 最终回调（如果流正常结束但没有收到[DONE]）
	finalContent := ""
	if fullReasoningContent.Len() > 0 {
		finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
	}
	if fullContent.Len() > 0 {
		finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
	}

	// **关键修复**：如果流结束时还没有收到usage，使用非流式请求获取usage
	if lastUsage == nil {
		lastUsage = fetchHunyuanUsageFromNonStreamRequest(ctx, p.client, url, config.APIKey, config.ModelName, messages)
	}

	callback(finalContent, true, nil, lastUsage)
	return nil
}

func (p *HunyuanProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	chatResp, err := p.Chat(config, prompt, "", nil)
	if err != nil {
		return nil, err
	}
	return &providers.CompleteResponse{
		Text:       chatResp.Content,
		TokensUsed: chatResp.TokensUsed,
	}, nil
}

func (p *HunyuanProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.hunyuan.cloud.tencent.com/v1"
	}
	baseURL = normalizeBaseURL(baseURL)
	url := fmt.Sprintf("%s/embeddings", baseURL)

	requestBody := map[string]interface{}{
		"model": "hunyuan-embedding",
		"input": text,
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
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
		Usage struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Data) == 0 {
		return nil, fmt.Errorf("no embedding in response")
	}

	return &providers.EmbedResponse{
		Embedding:  response.Data[0].Embedding,
		TokensUsed: response.Usage.TotalTokens,
	}, nil
}
