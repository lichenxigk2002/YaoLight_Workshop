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
	log "yaolight-workshop/backend/infrastructure/logx"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

// ClaudeProvider Claude提供商实现 (via OpenRouter)
type ClaudeProvider struct {
	client *http.Client
}

// NewClaudeProvider 创建Claude提供商实例
func NewClaudeProvider() providers.AIProvider {
	return &ClaudeProvider{
		client: providers.NewHTTPClientForProvider("claude"),
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

func (p *ClaudeProvider) ChatWithTools(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}) (*providers.ChatResponseWithTools, error) {
	return nil, fmt.Errorf("tool calling not implemented for Claude provider")
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
	log.Printf("[流式调试-Claude] ChatStream 开始执行")
	log.Printf("[流式调试-Claude] providerConfig=%+v", providerConfig)
	if val, ok := providerConfig["reasoning"]; ok {
		if enabled, ok := val.(bool); ok && enabled {
			reasoningConfig := map[string]interface{}{
				"enabled": true,
			}
			if effort, ok := providerConfig["reasoning_effort"].(string); ok && effort != "" {
				reasoningConfig["effort"] = effort
			}
			requestBody["reasoning"] = reasoningConfig
			log.Printf("[流式调试-Claude] 启用推理, reasoning=%+v", reasoningConfig)
		} else if reasoningMap, ok := val.(map[string]interface{}); ok {
			requestBody["reasoning"] = reasoningMap
			log.Printf("[流式调试-Claude] 使用推理配置对象, reasoning=%+v", reasoningMap)
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
			log.Printf("[流式调试-Claude] 通过thinking参数启用推理, reasoning=%+v", reasoningConfig)
		}
	} else {
		log.Printf("[流式调试-Claude] 未启用推理")
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
	log.Printf("[流式调试-Claude] 请求体JSON: %s", string(jsonData))

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
				// 构造最终内容：如果有思考内容，格式为 [REASONING]...[/REASONING][CONTENT]...[/CONTENT]
				finalContent := ""
				if fullReasoningContent.Len() > 0 {
					finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
					log.Printf("[流式调试-Claude] 流结束, 推理内容总长度=%d", fullReasoningContent.Len())
				}
				if fullContent.Len() > 0 {
					finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
					log.Printf("[流式调试-Claude] 流结束, 正式内容总长度=%d", fullContent.Len())
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
						AudioTokens  int `json:"audio_tokens"`
					} `json:"prompt_tokens_details"`
				} `json:"usage"`
			}

			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				log.Printf("[流式调试-Claude] JSON解析失败: %v, data: %s", err, data)
				continue
			}

			// 调试：打印完整的响应结构（仅前几个chunk）
			if len(streamResponse.Choices) > 0 {
				delta := streamResponse.Choices[0].Delta
				if delta.Reasoning != nil || delta.ReasoningDetails != nil || delta.ReasoningContent != "" || delta.Content != "" {
					log.Printf("[流式调试-Claude] 收到delta: reasoning=%v, reasoning_details=%v, reasoning_content=%q, content=%q",
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
				if streamResponse.Usage.PromptTokensDetails.AudioTokens > 0 {
					audio := streamResponse.Usage.PromptTokensDetails.AudioTokens
					usage.AudioTokens = &audio
				}
				callback("", true, nil, usage)
				return nil
			}

			if len(streamResponse.Choices) > 0 {
				delta := streamResponse.Choices[0].Delta

				// 尝试提取推理内容（按优先级检查不同的字段名）
				// OpenRouter/Claude 可能使用不同的字段名
				hasReasoning := false
				if delta.Reasoning != nil {
					// 检查 reasoning 字段（可能是对象或字符串）
					if rStr, ok := delta.Reasoning.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
						hasReasoning = true
						log.Printf("[流式调试-Claude] 收到推理内容 (reasoning字段), 长度=%d", len(rStr))
					} else if rMap, ok := delta.Reasoning.(map[string]interface{}); ok {
						// 如果是对象，尝试提取内容
						if content, ok := rMap["content"].(string); ok && content != "" {
							fullReasoningContent.WriteString(content)
							callback("[REASONING_DELTA]"+content, false, nil, nil)
							hasReasoning = true
							log.Printf("[流式调试-Claude] 收到推理内容 (reasoning.content), 长度=%d", len(content))
						}
					}
				}
				if !hasReasoning && delta.ReasoningDetails != nil {
					// 检查 reasoning_details 字段
					if rStr, ok := delta.ReasoningDetails.(string); ok && rStr != "" {
						fullReasoningContent.WriteString(rStr)
						callback("[REASONING_DELTA]"+rStr, false, nil, nil)
						hasReasoning = true
						log.Printf("[流式调试-Claude] 收到推理内容 (reasoning_details字段), 长度=%d", len(rStr))
					} else if rMap, ok := delta.ReasoningDetails.(map[string]interface{}); ok {
						// 如果是对象，尝试提取内容
						if content, ok := rMap["content"].(string); ok && content != "" {
							fullReasoningContent.WriteString(content)
							callback("[REASONING_DELTA]"+content, false, nil, nil)
							hasReasoning = true
							log.Printf("[流式调试-Claude] 收到推理内容 (reasoning_details.content), 长度=%d", len(content))
						}
					}
				}
				if !hasReasoning && delta.ReasoningContent != "" {
					// 检查 reasoning_content 字段
					fullReasoningContent.WriteString(delta.ReasoningContent)
					callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil, nil)
					hasReasoning = true
					log.Printf("[流式调试-Claude] 收到推理内容 (reasoning_content字段), 长度=%d", len(delta.ReasoningContent))
				}

				// 处理正常内容
				if delta.Content != "" {
					fullContent.WriteString(delta.Content)
					callback("[CONTENT_DELTA]"+delta.Content, false, nil, nil)
					log.Printf("[流式调试-Claude] 收到正式内容, 长度=%d", len(delta.Content))
				}
			}
		}
	}

	// 最终回调（如果流正常结束）
	finalContent := ""
	if fullReasoningContent.Len() > 0 {
		finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
		log.Printf("[流式调试-Claude] 流正常结束, 推理内容总长度=%d", fullReasoningContent.Len())
	}
	if fullContent.Len() > 0 {
		finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
		log.Printf("[流式调试-Claude] 流正常结束, 正式内容总长度=%d", fullContent.Len())
	}
	if finalContent != "" {
		callback(finalContent, true, nil, nil)
	} else {
		callback("", true, nil, nil)
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
