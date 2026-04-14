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
	log "yaolight-workshop/backend/infrastructure/logx"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

// DoubaoProvider 豆包提供商实现（纯 HTTP 实现）
type DoubaoProvider struct {
	client *http.Client
}

// NewDoubaoProvider 创建豆包提供商实例
func NewDoubaoProvider() providers.AIProvider {
	return &DoubaoProvider{
		client: providers.NewHTTPClient(),
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

	// 处理豆包的思考模式参数（thinkingLevel）
	if providerConfig != nil {
		if thinkingLevel, ok := providerConfig["thinkingLevel"].(string); ok && thinkingLevel != "" {
			requestBody["thinking_level"] = thinkingLevel
		} else {
			// 如果没有指定，使用默认值 medium
			requestBody["thinking_level"] = "medium"
		}
	} else {
		// 如果没有 providerConfig，使用默认值
		requestBody["thinking_level"] = "medium"
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

func (p *DoubaoProvider) ChatWithTools(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}) (*providers.ChatResponseWithTools, error) {
	return nil, fmt.Errorf("tool calling not implemented for Doubao provider")
}

// ChatStream 流式聊天对话
func (p *DoubaoProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	log.Printf("[流式调试-豆包] ChatStream 开始执行")
	log.Printf("[流式调试-豆包] providerConfig=%+v", providerConfig)
	log.Printf("[流式调试-豆包] modelName=%s, baseURL=%s", config.ModelName, config.BaseURL)

	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)
	log.Printf("[流式调试-豆包] 请求URL: %s", url)

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
	log.Printf("[流式调试-豆包] 请求体 stream=true (固定值)")

	// 处理豆包的思考模式参数（thinkingLevel）
	if thinkingLevel, ok := providerConfig["thinkingLevel"].(string); ok && thinkingLevel != "" {
		requestBody["thinking_level"] = thinkingLevel
		log.Printf("[流式调试-豆包] 添加 thinking_level=%s 到请求体", thinkingLevel)
	} else {
		// 如果没有指定，使用默认值 medium
		requestBody["thinking_level"] = "medium"
		log.Printf("[流式调试-豆包] 使用默认 thinking_level=medium")
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
	log.Printf("[流式调试-豆包] 请求体JSON: %s", string(jsonData))

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

	resp, err := p.client.Do(req)
	if err != nil {
		log.Printf("[流式调试-豆包] 请求失败: %v", err)
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("[流式调试-豆包] 响应状态码: %d", resp.StatusCode)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[流式调试-豆包] API错误响应: %s", string(body))
		return fmt.Errorf("豆包 API 错误 (状态码 %d): %s", resp.StatusCode, string(body))
	}

	log.Printf("[流式调试-豆包] 开始读取流式响应")
	scanner := bufio.NewScanner(resp.Body)
	chunkCount := 0
	var fullContent strings.Builder
	var fullReasoningContent strings.Builder
	for scanner.Scan() {
		chunkCount++
		line := scanner.Text()
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
				callback(finalContent, true, nil, nil)
				return nil
			}

			var streamResp struct {
				Choices []struct {
					Delta struct {
						Content          string `json:"content"`
						ReasoningContent string `json:"reasoning_content,omitempty"` // 豆包思考内容
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
				log.Printf("[流式调试-豆包] JSON解析失败: %v, data: %s", err, data)
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
				// 处理思考内容（reasoning_content）
				reasoningContent := streamResp.Choices[0].Delta.ReasoningContent
				if reasoningContent != "" {
					fullReasoningContent.WriteString(reasoningContent)
					log.Printf("[流式调试-豆包] 收到思考内容块 #%d, 长度=%d, 累计长度=%d", chunkCount, len(reasoningContent), fullReasoningContent.Len())
					callback("[REASONING_DELTA]"+reasoningContent, false, nil, nil)
				}

				// 处理正式内容
				content := streamResp.Choices[0].Delta.Content
				if content != "" {
					fullContent.WriteString(content)
					log.Printf("[流式调试-豆包] 收到内容块 #%d, 长度=%d, 累计长度=%d", chunkCount, len(content), fullContent.Len())
					callback("[CONTENT_DELTA]"+content, false, nil, nil)
				}
				if streamResp.Choices[0].FinishReason != "" {
					log.Printf("[流式调试-豆包] 流结束, finish_reason=%s", streamResp.Choices[0].FinishReason)
					// 流结束，构造最终内容
					finalContent := ""
					if fullReasoningContent.Len() > 0 {
						finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
					}
					if fullContent.Len() > 0 {
						finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
					}
					if finalContent != "" {
						callback(finalContent, true, nil, nil)
					}
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("[流式调试-豆包] 读取流式响应出错: %v", err)
		return fmt.Errorf("读取流式响应失败: %w", err)
	}

	log.Printf("[流式调试-豆包] 流式响应读取完成, 共收到 %d 个chunk", chunkCount)
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
