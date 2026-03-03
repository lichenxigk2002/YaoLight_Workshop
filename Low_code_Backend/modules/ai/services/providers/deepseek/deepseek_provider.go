package deepseek

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

// DeepSeekProvider DeepSeek提供商实现
type DeepSeekProvider struct {
	client *http.Client
}

// NewDeepSeekProvider 创建DeepSeek提供商实例
func NewDeepSeekProvider() providers.AIProvider {
	return &DeepSeekProvider{
		client: &http.Client{},
	}
}

// Chat 聊天对话
func (p *DeepSeekProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	// DeepSeek API地址（与OpenAI兼容，可以使用 /v1 或不用）
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.deepseek.com"
	}
	// 构建URL（DeepSeek支持两种格式：https://api.deepseek.com 或 https://api.deepseek.com/v1）
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息（与OpenAI格式兼容）
	messages := []map[string]interface{}{}

	// 如果有系统提示词，添加到消息开头
	if config.SystemPrompt != "" {
		messages = append(messages, map[string]interface{}{
			"role":    "system",
			"content": config.SystemPrompt,
		})
	}

	// 添加用户消息
	userContent := prompt
	if content != "" {
		userContent = fmt.Sprintf("%s\n\n%s", prompt, content)
	}
	messages = append(messages, map[string]interface{}{
		"role":    "user",
		"content": userContent,
	})

	// 从providerConfig中读取DeepSeek特有的参数
	stream := false
	if v, ok := providerConfig["stream"].(bool); ok {
		stream = v
	}

	thinking := false
	if v, ok := providerConfig["thinking"].(bool); ok {
		thinking = v
	}

	// 如果启用流式输出，使用流式方法
	if stream {
		return nil, fmt.Errorf("流式输出请使用ChatStream方法")
	}

	// 构建请求体（与OpenAI兼容的格式）
	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   false,
	}

	// DeepSeek特有的thinking参数
	if thinking {
		// 如果启用深度思考，使用deepseek-reasoner模型，或者添加thinking参数
		if config.ModelName == "deepseek-chat" {
			// 对于deepseek-chat，可以通过thinking参数启用思考模式
			requestBody["thinking"] = map[string]interface{}{
				"type": "enabled",
			}
		} else if config.ModelName == "deepseek-reasoner" {
			// deepseek-reasoner本身就是思考模式
			// 不需要额外参数
		}
	} else {
		// 禁用思考模式
		requestBody["thinking"] = map[string]interface{}{
			"type": "disabled",
		}
	}

	// 添加可选参数
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

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建HTTP请求
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头（与OpenAI兼容）
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

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
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
			PromptCacheHit   int `json:"prompt_cache_hit_tokens"`
			PromptCacheMiss  int `json:"prompt_cache_miss_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	return &providers.ChatResponse{
		Content:    response.Choices[0].Message.Content,
		TokensUsed: response.Usage.TotalTokens,
		Usage: &providers.TokenUsage{
			PromptTokens:     response.Usage.PromptTokens,
			CompletionTokens: response.Usage.CompletionTokens,
			TotalTokens:      response.Usage.TotalTokens,
			CacheReadTokens:  &response.Usage.PromptCacheHit,
		},
		Model: config.ModelName,
	}, nil
}

// ChatWithTools 带工具调用的聊天（非流式，用于 Agent 循环）
func (p *DeepSeekProvider) ChatWithTools(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}) (*providers.ChatResponseWithTools, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.deepseek.com"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	apiMessages := make([]map[string]interface{}, 0, 1+len(messages))
	if systemPrompt != "" {
		apiMessages = append(apiMessages, map[string]interface{}{
			"role": "system", "content": systemPrompt,
		})
	}
	for _, m := range messages {
		msg := map[string]interface{}{"role": m.Role}
		if m.Content != "" {
			msg["content"] = m.Content
		}
		if m.Role == "tool" && m.ToolCallID != "" {
			msg["tool_call_id"] = m.ToolCallID
		}
		if len(m.ToolCalls) > 0 {
			tcList := make([]map[string]interface{}, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				tcList = append(tcList, map[string]interface{}{
					"id":   tc.ID,
					"type": "function",
					"function": map[string]interface{}{
						"name":      tc.Function.Name,
						"arguments": tc.Function.Arguments,
					},
				})
			}
			msg["tool_calls"] = tcList
		}
		apiMessages = append(apiMessages, msg)
	}

	toolsPayload := make([]map[string]interface{}, 0, len(tools))
	for _, t := range tools {
		item := map[string]interface{}{"type": "function"}
		if t.Function != nil {
			item["function"] = map[string]interface{}{
				"name":        t.Function.Name,
				"description": t.Function.Description,
				"parameters":  t.Function.Parameters,
			}
		}
		toolsPayload = append(toolsPayload, item)
	}

	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": apiMessages,
		"stream":   false,
	}
	if len(toolsPayload) > 0 {
		requestBody["tools"] = toolsPayload
	}
	requestBody["thinking"] = map[string]interface{}{"type": "disabled"}
	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API failed status %d: %s", resp.StatusCode, string(body))
	}

	var res struct {
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				ToolCalls []struct {
					ID       string `json:"id"`
					Type     string `json:"type"`
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	if len(res.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	out := &providers.ChatResponseWithTools{
		Content:    res.Choices[0].Message.Content,
		TokensUsed: res.Usage.TotalTokens,
		Usage: &providers.TokenUsage{
			PromptTokens:     res.Usage.PromptTokens,
			CompletionTokens: res.Usage.CompletionTokens,
			TotalTokens:      res.Usage.TotalTokens,
		},
		Model: config.ModelName,
	}
	for _, tc := range res.Choices[0].Message.ToolCalls {
		out.ToolCalls = append(out.ToolCalls, &providers.ToolCall{
			ID:   tc.ID,
			Type: tc.Type,
			Function: struct {
				Name      string `json:"name"`
				Arguments string `json:"arguments"`
			}{Name: tc.Function.Name, Arguments: tc.Function.Arguments},
		})
	}
	return out, nil
}

func (p *DeepSeekProvider) ChatWithToolsStream(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}, callback providers.StreamCallback) (*providers.ChatResponseWithTools, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.deepseek.com"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	apiMessages := make([]map[string]interface{}, 0, 1+len(messages))
	if systemPrompt != "" {
		apiMessages = append(apiMessages, map[string]interface{}{
			"role": "system", "content": systemPrompt,
		})
	}
	for _, m := range messages {
		msg := map[string]interface{}{"role": m.Role}
		if m.Content != "" {
			msg["content"] = m.Content
		}
		if m.Role == "tool" && m.ToolCallID != "" {
			msg["tool_call_id"] = m.ToolCallID
		}
		if len(m.ToolCalls) > 0 {
			tcList := make([]map[string]interface{}, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				tcList = append(tcList, map[string]interface{}{
					"id":   tc.ID,
					"type": "function",
					"function": map[string]interface{}{
						"name":      tc.Function.Name,
						"arguments": tc.Function.Arguments,
					},
				})
			}
			msg["tool_calls"] = tcList
		}
		apiMessages = append(apiMessages, msg)
	}

	toolsPayload := make([]map[string]interface{}, 0, len(tools))
	for _, t := range tools {
		item := map[string]interface{}{"type": "function"}
		if t.Function != nil {
			item["function"] = map[string]interface{}{
				"name":        t.Function.Name,
				"description": t.Function.Description,
				"parameters":  t.Function.Parameters,
			}
		}
		toolsPayload = append(toolsPayload, item)
	}

	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": apiMessages,
		"stream":   true,
	}
	if len(toolsPayload) > 0 {
		requestBody["tools"] = toolsPayload
	}
	requestBody["thinking"] = map[string]interface{}{"type": "disabled"}
	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API failed status %d: %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	var fullContent strings.Builder
	toolCallMap := map[int]*providers.ToolCall{}
	maxIndex := -1
	var usage *providers.TokenUsage

	type streamToolCall struct {
		Index    *int   `json:"index"`
		ID       string `json:"id"`
		Type     string `json:"type"`
		Function struct {
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
		} `json:"function"`
	}

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			callback("", true, ctx.Err(), nil)
			return nil, ctx.Err()
		default:
		}

		line := scanner.Text()
		if line == "" || !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var streamResponse struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Choices []struct {
				Delta struct {
					Role      string           `json:"role"`
					Content   string           `json:"content"`
					ToolCalls []streamToolCall `json:"tool_calls"`
				} `json:"delta"`
				FinishReason string `json:"finish_reason"`
			} `json:"choices"`
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
				TotalTokens      int `json:"total_tokens"`
				PromptCacheHit   int `json:"prompt_cache_hit_tokens"`
			} `json:"usage"`
		}

		if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
			continue
		}

		if streamResponse.Usage != nil {
			usage = &providers.TokenUsage{
				PromptTokens:     streamResponse.Usage.PromptTokens,
				CompletionTokens: streamResponse.Usage.CompletionTokens,
				TotalTokens:      streamResponse.Usage.TotalTokens,
				CacheReadTokens:  &streamResponse.Usage.PromptCacheHit,
			}
		}

		if len(streamResponse.Choices) > 0 {
			delta := streamResponse.Choices[0].Delta
			if delta.Content != "" {
				fullContent.WriteString(delta.Content)
				callback(delta.Content, false, nil, nil)
			}
			if len(delta.ToolCalls) > 0 {
				for _, tc := range delta.ToolCalls {
					index := 0
					if tc.Index != nil {
						index = *tc.Index
					} else if maxIndex >= 0 {
						index = maxIndex + 1
					}
					if index > maxIndex {
						maxIndex = index
					}
					existing, ok := toolCallMap[index]
					if !ok {
						existing = &providers.ToolCall{
							Type: "function",
							Function: struct {
								Name      string `json:"name"`
								Arguments string `json:"arguments"`
							}{},
						}
						toolCallMap[index] = existing
					}
					if tc.ID != "" {
						existing.ID = tc.ID
					}
					if tc.Type != "" {
						existing.Type = tc.Type
					}
					if tc.Function.Name != "" {
						existing.Function.Name = tc.Function.Name
					}
					if tc.Function.Arguments != "" {
						existing.Function.Arguments += tc.Function.Arguments
					}
				}
			}
			if streamResponse.Choices[0].FinishReason != "" {
				break
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read stream: %w", err)
	}

	toolCalls := make([]*providers.ToolCall, 0, len(toolCallMap))
	if len(toolCallMap) > 0 {
		indices := make([]int, 0, len(toolCallMap))
		for idx := range toolCallMap {
			indices = append(indices, idx)
		}
		sort.Ints(indices)
		for _, idx := range indices {
			if tc := toolCallMap[idx]; tc != nil {
				if tc.Type == "" {
					tc.Type = "function"
				}
				toolCalls = append(toolCalls, tc)
			}
		}
	}

	respOut := &providers.ChatResponseWithTools{
		Content:    fullContent.String(),
		ToolCalls:  toolCalls,
		TokensUsed: 0,
		Usage:      usage,
		Model:      config.ModelName,
	}
	if usage != nil {
		respOut.TokensUsed = usage.TotalTokens
	}
	callback("", true, nil, usage)
	return respOut, nil
}

// ChatStream 流式聊天对话
func (p *DeepSeekProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	// DeepSeek API地址
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://api.deepseek.com"
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

	// 从providerConfig中读取参数
	thinking := false
	if v, ok := providerConfig["thinking"].(bool); ok {
		thinking = v
	}

	// 构建请求体（启用流式输出）
	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   true,
	}

	// DeepSeek特有的thinking参数
	if thinking {
		if config.ModelName == "deepseek-chat" {
			requestBody["thinking"] = map[string]interface{}{
				"type": "enabled",
			}
		}
	} else {
		requestBody["thinking"] = map[string]interface{}{
			"type": "disabled",
		}
	}

	// 添加可选参数
	if config.Temperature != nil {
		requestBody["temperature"] = *config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody["max_tokens"] = *config.MaxTokens
	}
	if config.TopP != nil {
		requestBody["top_p"] = *config.TopP
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建HTTP请求（使用 context）
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

	// 发送请求
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
	scanner := bufio.NewScanner(resp.Body)
	var fullContent strings.Builder
	var fullReasoningContent strings.Builder

	for scanner.Scan() {
		// 检查 context 是否已取消
		select {
		case <-ctx.Done():
			callback("", true, ctx.Err(), nil)
			return ctx.Err()
		default:
			// 继续执行
		}

		line := scanner.Text()
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
				}
				if fullContent.Len() > 0 {
					finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
				}
				callback(finalContent, true, nil, nil)
				return nil
			}

			var streamResponse struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
				Choices []struct {
					Delta struct {
						Role             string `json:"role"`
						Content          string `json:"content"`
						ReasoningContent string `json:"reasoning_content"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
				Usage *struct {
					PromptTokens     int `json:"prompt_tokens"`
					CompletionTokens int `json:"completion_tokens"`
					TotalTokens      int `json:"total_tokens"`
					PromptCacheHit   int `json:"prompt_cache_hit_tokens"`
					PromptCacheMiss  int `json:"prompt_cache_miss_tokens"`
				} `json:"usage"`
			}

			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				continue
			}

			if streamResponse.Usage != nil {
				usage := &providers.TokenUsage{
					PromptTokens:     streamResponse.Usage.PromptTokens,
					CompletionTokens: streamResponse.Usage.CompletionTokens,
					TotalTokens:      streamResponse.Usage.TotalTokens,
					CacheReadTokens:  &streamResponse.Usage.PromptCacheHit,
				}
				callback("", false, nil, usage)
			}

			if len(streamResponse.Choices) > 0 {
				// 处理思考内容
				deltaReasoningContent := streamResponse.Choices[0].Delta.ReasoningContent
				if deltaReasoningContent != "" {
					fullReasoningContent.WriteString(deltaReasoningContent)
					// 发送带标记的思考内容
					callback("[REASONING_DELTA]"+deltaReasoningContent, false, nil, nil)
				}

				// 处理正式内容
				deltaContent := streamResponse.Choices[0].Delta.Content
				if deltaContent != "" {
					fullContent.WriteString(deltaContent)
					// 发送带标记的正式内容
					callback("[CONTENT_DELTA]"+deltaContent, false, nil, nil)
				}

				if streamResponse.Choices[0].FinishReason != "" {
					// 构造最终内容
					finalContent := ""
					if fullReasoningContent.Len() > 0 {
						finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
					}
					if fullContent.Len() > 0 {
						finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
					}
					callback(finalContent, true, nil, nil)
					return nil
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read stream: %w", err)
	}

	// 最终回调
	finalContent := ""
	if fullReasoningContent.Len() > 0 {
		finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
	}
	if fullContent.Len() > 0 {
		finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
	}
	callback(finalContent, true, nil, nil)
	return nil
}

// Complete 文本补全
func (p *DeepSeekProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	// DeepSeek使用chat接口
	chatResp, err := p.Chat(config, prompt, "", nil)
	if err != nil {
		return nil, err
	}

	return &providers.CompleteResponse{
		Text:       chatResp.Content,
		TokensUsed: chatResp.TokensUsed,
	}, nil
}

// Embed 文本嵌入（DeepSeek可能不支持，返回错误）
func (p *DeepSeekProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	return nil, fmt.Errorf("DeepSeek does not support embedding API")
}
