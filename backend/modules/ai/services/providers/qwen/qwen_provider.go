package qwen

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
	"time"
	log "yaolight-workshop/backend/infrastructure/logx"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

// QwenProvider 通义千问提供商实现
type QwenProvider struct {
	client *http.Client
}

// NewQwenProvider 创建通义千问提供商实例
func NewQwenProvider() providers.AIProvider {
	return &QwenProvider{
		client: providers.NewHTTPClient(),
	}
}

// Message 消息结构（OpenAI兼容格式）
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

// StreamOptions 流式输出配置
type StreamOptions struct {
	IncludeUsage bool `json:"include_usage,omitempty"`
}

// RequestBody 请求体结构（OpenAI兼容格式）
type RequestBody struct {
	Model            string         `json:"model"`
	Messages         []Message      `json:"messages"`
	Stream           bool           `json:"stream,omitempty"`
	Temperature      *float64       `json:"temperature,omitempty"`
	MaxTokens        *int           `json:"max_tokens,omitempty"`
	TopP             *float64       `json:"top_p,omitempty"`
	FrequencyPenalty *float64       `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64       `json:"presence_penalty,omitempty"`
	Stop             []string       `json:"stop,omitempty"`
	StreamOptions    *StreamOptions `json:"stream_options,omitempty"`
	EnableThinking   *bool          `json:"enable_thinking,omitempty"` // 通义千问深度思考参数（非OpenAI标准）
}

// ResponseBody 响应体结构（OpenAI兼容格式）
type ResponseBody struct {
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
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

// StreamResponseBody 流式响应体结构（OpenAI兼容格式）
type StreamResponseBody struct {
	Choices []struct {
		Delta struct {
			Role             string `json:"role"`
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content,omitempty"` // 通义千问深度思考内容
			ToolCalls        []struct {
				Index    *int   `json:"index"`
				ID       string `json:"id"`
				Type     string `json:"type"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls,omitempty"`
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

func withRequestTimeout(ctx context.Context, seconds int) (context.Context, context.CancelFunc) {
	if seconds <= 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, time.Duration(seconds)*time.Second)
}

// Chat 聊天对话（非流式）
func (p *QwenProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	// 通义千问API地址（使用OpenAI兼容模式）
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息列表
	messages := []Message{}

	// 如果有系统提示词，添加到消息开头
	if config.SystemPrompt != "" {
		messages = append(messages, Message{
			Role:    "system",
			Content: config.SystemPrompt,
		})
	}

	// 添加用户消息
	userContent := prompt
	if content != "" {
		userContent = fmt.Sprintf("%s\n\n%s", prompt, content)
	}
	messages = append(messages, Message{
		Role:    "user",
		Content: userContent,
	})

	// 构建请求体（OpenAI兼容格式）
	requestBody := RequestBody{
		Model:    config.ModelName,
		Messages: messages,
		Stream:   false,
	}

	// 添加可选参数
	if config.Temperature != nil {
		requestBody.Temperature = config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody.MaxTokens = config.MaxTokens
	}
	if config.TopP != nil {
		requestBody.TopP = config.TopP
	}
	if config.FrequencyPenalty != nil {
		requestBody.FrequencyPenalty = config.FrequencyPenalty
	}
	if config.PresencePenalty != nil {
		requestBody.PresencePenalty = config.PresencePenalty
	}
	if len(config.StopSequences) > 0 {
		requestBody.Stop = config.StopSequences
	}

	// 处理通义千问深度思考参数（enable_thinking）
	if enableThinking, ok := providerConfig["enable_thinking"].(bool); ok {
		requestBody.EnableThinking = &enableThinking
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

	// 设置请求头（使用DASHSCOPE_API_KEY格式）
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

	// 解析响应（OpenAI兼容格式）
	var response ResponseBody
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	modelName := response.Model
	if modelName == "" {
		modelName = config.ModelName
	}

	return &providers.ChatResponse{
		Content:    response.Choices[0].Message.Content,
		TokensUsed: response.Usage.TotalTokens,
		Usage: &providers.TokenUsage{
			PromptTokens:     response.Usage.PromptTokens,
			CompletionTokens: response.Usage.CompletionTokens,
			TotalTokens:      response.Usage.TotalTokens,
		},
		Model: modelName,
	}, nil
}

func (p *QwenProvider) ChatWithTools(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}) (*providers.ChatResponseWithTools, error) {
	reqCtx, cancel := withRequestTimeout(ctx, config.RequestTimeoutSeconds)
	defer cancel()

	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	apiMessages := make([]map[string]interface{}, 0, 1+len(messages))
	if systemPrompt != "" {
		apiMessages = append(apiMessages, map[string]interface{}{
			"role":    "system",
			"content": systemPrompt,
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
	enableThinking := false
	requestBody["enable_thinking"] = enableThinking
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
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(reqCtx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
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
		Model string `json:"model"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	if len(res.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	out := &providers.ChatResponseWithTools{
		Content:    strings.TrimSpace(res.Choices[0].Message.Content),
		TokensUsed: res.Usage.TotalTokens,
		Usage: &providers.TokenUsage{
			PromptTokens:     res.Usage.PromptTokens,
			CompletionTokens: res.Usage.CompletionTokens,
			TotalTokens:      res.Usage.TotalTokens,
		},
		Model: config.ModelName,
	}
	if res.Model != "" {
		out.Model = res.Model
	}
	for _, tc := range res.Choices[0].Message.ToolCalls {
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

func (p *QwenProvider) ChatWithToolsStream(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}, callback providers.StreamCallback) (*providers.ChatResponseWithTools, error) {
	reqCtx, cancel := withRequestTimeout(ctx, config.RequestTimeoutSeconds)
	defer cancel()

	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	apiMessages := make([]map[string]interface{}, 0, 1+len(messages))
	if systemPrompt != "" {
		apiMessages = append(apiMessages, map[string]interface{}{
			"role":    "system",
			"content": systemPrompt,
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
		"stream_options": map[string]interface{}{
			"include_usage": true,
		},
		"enable_thinking": false,
	}
	if len(toolsPayload) > 0 {
		requestBody["tools"] = toolsPayload
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

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(reqCtx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	var fullContent strings.Builder
	toolCallMap := map[int]*providers.ToolCall{}
	maxIndex := -1
	var usage *providers.TokenUsage
	streamUserContent := len(tools) == 0
	seenToolCallDelta := false

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

		var streamResponse StreamResponseBody
		if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
			continue
		}

		if streamResponse.Usage != nil {
			usage = &providers.TokenUsage{
				PromptTokens:     streamResponse.Usage.PromptTokens,
				CompletionTokens: streamResponse.Usage.CompletionTokens,
				TotalTokens:      streamResponse.Usage.TotalTokens,
			}
		}

		if len(streamResponse.Choices) == 0 {
			continue
		}
		delta := streamResponse.Choices[0].Delta
		if delta.Content != "" {
			fullContent.WriteString(delta.Content)
			if streamUserContent && !seenToolCallDelta {
				callback(delta.Content, false, nil, nil)
			}
		}
		if len(delta.ToolCalls) > 0 {
			seenToolCallDelta = true
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
		Content:    strings.TrimSpace(fullContent.String()),
		ToolCalls:  toolCalls,
		TokensUsed: 0,
		Usage:      usage,
		Model:      config.ModelName,
	}
	if usage != nil {
		respOut.TokensUsed = usage.TotalTokens
	}
	if len(respOut.ToolCalls) == 0 && respOut.Content != "" && (!streamUserContent || seenToolCallDelta) {
		callback(respOut.Content, false, nil, nil)
	}
	callback("", true, nil, usage)
	return respOut, nil
}

// ChatStream 流式聊天对话
func (p *QwenProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	// 通义千问API地址（使用OpenAI兼容模式）
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息列表
	messages := []Message{}

	if config.SystemPrompt != "" {
		messages = append(messages, Message{
			Role:    "system",
			Content: config.SystemPrompt,
		})
	}

	userContent := prompt
	if content != "" {
		userContent = fmt.Sprintf("%s\n\n%s", prompt, content)
	}
	messages = append(messages, Message{
		Role:    "user",
		Content: userContent,
	})

	// 构建请求体（OpenAI兼容格式，启用流式输出）
	requestBody := RequestBody{
		Model:    config.ModelName,
		Messages: messages,
		Stream:   true,
		StreamOptions: &StreamOptions{
			IncludeUsage: true, // 在最后一个数据块包含Token消耗信息
		},
	}

	// 添加可选参数
	if config.Temperature != nil {
		requestBody.Temperature = config.Temperature
	}
	if config.MaxTokens != nil {
		requestBody.MaxTokens = config.MaxTokens
	}
	if config.TopP != nil {
		requestBody.TopP = config.TopP
	}
	if config.FrequencyPenalty != nil {
		requestBody.FrequencyPenalty = config.FrequencyPenalty
	}
	if config.PresencePenalty != nil {
		requestBody.PresencePenalty = config.PresencePenalty
	}
	if len(config.StopSequences) > 0 {
		requestBody.Stop = config.StopSequences
	}

	// 处理通义千问深度思考参数（enable_thinking）
	if enableThinking, ok := providerConfig["enable_thinking"].(bool); ok {
		requestBody.EnableThinking = &enableThinking
		log.Printf("[流式调试-千问] ChatStream enable_thinking=%v", enableThinking)
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

	// 读取流式响应（SSE格式）
	// 使用Scanner更方便按行读取
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

			var streamResponse StreamResponseBody
			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				// 忽略解析错误，继续处理下一行
				continue
			}

			if streamResponse.Usage != nil {
				usage := &providers.TokenUsage{
					PromptTokens:     streamResponse.Usage.PromptTokens,
					CompletionTokens: streamResponse.Usage.CompletionTokens,
					TotalTokens:      streamResponse.Usage.TotalTokens,
				}
				callback("", false, nil, usage)
			}

			if len(streamResponse.Choices) > 0 {
				// 处理思考内容（reasoning_content）
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

				// 检查是否完成
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

	// 最终回调（如果流正常结束）
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
func (p *QwenProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	// 通义千问使用chat接口
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
func (p *QwenProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	// 通义千问可能不支持嵌入接口，返回错误
	return nil, fmt.Errorf("通义千问暂不支持文本嵌入功能")
}
