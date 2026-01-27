package gpt

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
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

	// 处理 providerConfig 中的参数
	// 注意：根据官方示例，如果不启用推理，不应该添加reasoning参数
	// 只有当明确启用时才添加，不添加默认的 {"enabled": false}
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
			// 如果前端传递的是对象，直接使用
			requestBody["reasoning"] = reasoningMap
		}
		// 注意：如果 reasoning=false，不添加reasoning参数（根据官方示例）
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
		// 注意：如果 thinking=false，不添加reasoning参数（根据官方示例）
	}
	// 注意：如果既没有reasoning也没有thinking参数，不添加reasoning参数
	// 这样可以让模型使用默认行为

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

	// 处理 providerConfig 中的参数
	log.Printf("[流式调试-GPT] ChatStream 开始执行")
	log.Printf("[流式调试-GPT] providerConfig=%+v", providerConfig)
	// 注意：根据官方示例，如果不启用推理，不应该添加reasoning参数
	// 只有当明确启用时才添加，不添加默认的 {"enabled": false}
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
			// 如果前端传递的是对象，直接使用
			requestBody["reasoning"] = reasoningMap
		}
		// 注意：如果 reasoning=false，不添加reasoning参数（根据官方示例）
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
		// 注意：如果 thinking=false，不添加reasoning参数（根据官方示例）
	}
	// 注意：如果既没有reasoning也没有thinking参数，不添加reasoning参数
	// 这样可以让模型使用默认行为

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
	log.Printf("[流式调试-GPT] 请求体JSON: %s", string(jsonData))

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

		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				// 构造最终内容：如果有思考内容，格式为 [REASONING]...[/REASONING][CONTENT]...[/CONTENT]
				finalContent := ""
				if fullReasoningContent.Len() > 0 {
					finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
				}
				if fullContent.Len() > 0 {
					finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
				}
				if finalContent != "" {
					callback(finalContent, true, nil, nil)
				} else {
					callback("", true, nil, nil)
				}
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
				log.Printf("[流式调试-GPT] JSON解析失败: %v, data: %s", err, data)
				continue
			}

			// 调试：打印完整的响应结构（仅前几个chunk）
			if len(streamResponse.Choices) > 0 {
				delta := streamResponse.Choices[0].Delta
				if delta.Reasoning != nil || delta.ReasoningDetails != nil || delta.ReasoningContent != "" || delta.Content != "" {
					log.Printf("[流式调试-GPT] 收到delta: reasoning=%v, reasoning_details=%v, reasoning_content=%q, content=%q",
						delta.Reasoning, delta.ReasoningDetails, delta.ReasoningContent, delta.Content)
				}
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

				// 尝试提取推理内容（按优先级检查不同的字段名）
				// OpenRouter/GPT 可能使用不同的字段名
				hasReasoning := false
				if delta.Reasoning != nil {
					// 检查 reasoning 字段（可能是对象或字符串）
					if rStr, ok := delta.Reasoning.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
						hasReasoning = true
						log.Printf("[流式调试-GPT] 收到推理内容 (reasoning字段), 长度=%d", len(rStr))
					} else if rMap, ok := delta.Reasoning.(map[string]interface{}); ok {
						// 如果是对象，尝试提取内容
						if content, ok := rMap["content"].(string); ok && content != "" {
							fullReasoningContent.WriteString(content)
							callback("[REASONING_DELTA]"+content, false, nil, nil)
							hasReasoning = true
							log.Printf("[流式调试-GPT] 收到推理内容 (reasoning.content), 长度=%d", len(content))
						} else {
							// 打印对象结构以便调试
							log.Printf("[流式调试-GPT] reasoning是对象但无content字段: %+v", rMap)
						}
					} else {
						log.Printf("[流式调试-GPT] reasoning字段类型未知: %T, 值=%v", delta.Reasoning, delta.Reasoning)
					}
				}
				if !hasReasoning && delta.ReasoningDetails != nil {
					// 检查 reasoning_details 字段
					if rStr, ok := delta.ReasoningDetails.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
						hasReasoning = true
						log.Printf("[流式调试-GPT] 收到推理内容 (reasoning_details字段), 长度=%d", len(rStr))
					} else if rMap, ok := delta.ReasoningDetails.(map[string]interface{}); ok {
						// 如果是对象，尝试提取内容
						if content, ok := rMap["content"].(string); ok && content != "" {
							fullReasoningContent.WriteString(content)
							callback("[REASONING_DELTA]"+content, false, nil, nil)
							hasReasoning = true
							log.Printf("[流式调试-GPT] 收到推理内容 (reasoning_details.content), 长度=%d", len(content))
						} else {
							// 打印对象结构以便调试
							log.Printf("[流式调试-GPT] reasoning_details是对象但无content字段: %+v", rMap)
						}
					} else {
						log.Printf("[流式调试-GPT] reasoning_details字段类型未知: %T, 值=%v", delta.ReasoningDetails, delta.ReasoningDetails)
					}
				}
				if !hasReasoning && delta.ReasoningContent != "" {
					// 检查 reasoning_content 字段
					fullReasoningContent.WriteString(delta.ReasoningContent)
					callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil, nil)
					hasReasoning = true
					log.Printf("[流式调试-GPT] 收到推理内容 (reasoning_content字段), 长度=%d", len(delta.ReasoningContent))
				}

				// 处理正常内容
				if delta.Content != "" {
					fullContent.WriteString(delta.Content)
					callback("[CONTENT_DELTA]"+delta.Content, false, nil, nil)
				}
			}
		}
	}

	// 最终回调（如果流正常结束）
	finalContent := ""
	if fullReasoningContent.Len() > 0 {
		finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
	}
	if fullContent.Len() > 0 {
		finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
	}
	if finalContent != "" {
		callback(finalContent, true, nil, nil)
	} else {
		callback("", true, nil, nil)
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
