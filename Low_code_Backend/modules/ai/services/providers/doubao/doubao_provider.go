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

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model/responses"
)

// findTextInMap 递归查找 JSON map 中的文本内容
func findTextInMap(m map[string]interface{}) (string, bool) {
	for key, value := range m {
		if key == "text" || key == "content" {
			if str, ok := value.(string); ok && str != "" {
				return str, true
			}
		}
		if nestedMap, ok := value.(map[string]interface{}); ok {
			if text, found := findTextInMap(nestedMap); found {
				return text, true
			}
		}
		if nestedSlice, ok := value.([]interface{}); ok {
			for _, item := range nestedSlice {
				if itemMap, ok := item.(map[string]interface{}); ok {
					if text, found := findTextInMap(itemMap); found {
						return text, true
					}
				}
			}
		}
	}
	return "", false
}

// DoubaoProvider 豆包提供商实现
type DoubaoProvider struct {
	client *http.Client // HTTP客户端用于流式请求
}

// NewDoubaoProvider 创建豆包提供商实例
func NewDoubaoProvider() providers.AIProvider {
	return &DoubaoProvider{
		client: &http.Client{},
	}
}

// Chat 聊天对话（非流式）
func (p *DoubaoProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	// 创建客户端
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}

	client := arkruntime.NewClientWithApiKey(
		config.APIKey,
		arkruntime.WithBaseUrl(baseURL),
	)
	ctx := context.Background()

	// 构建输入内容
	userInput := prompt
	if content != "" {
		userInput = fmt.Sprintf("%s\n\n%s", prompt, content)
	}

	// 构建请求
	req := &responses.ResponsesRequest{
		Model: config.ModelName,
		Input: &responses.ResponsesInput{
			Union: &responses.ResponsesInput_StringValue{
				StringValue: userInput,
			},
		},
	}

	// 处理深度思考参数
	// 豆包使用 thinkingLevel（minimal/low/medium/high），而不是 thinking 布尔值
	// 注意：目前 SDK 的 Thinking 结构可能不支持 level 字段
	// 暂时读取 thinkingLevel 参数（用于后续扩展），但当前不使用
	// TODO: 当 SDK 支持 level 字段时，使用 thinkingLevel 设置思考长度
	if _, ok := providerConfig["thinkingLevel"].(string); ok {
		// thinkingLevel 已读取，后续扩展时使用
	}
	// 豆包默认开启思考
	req.Thinking = &responses.ResponsesThinking{
		Type: responses.ThinkingType_enabled.Enum(),
	}

	// 处理多模态输入（图片等）
	if images, ok := providerConfig["images"].([]string); ok && len(images) > 0 {
		// 构建多模态消息
		contentItems := []*responses.ContentItem{
			{
				Union: &responses.ContentItem_Text{
					Text: &responses.ContentItemText{
						Type: responses.ContentItemType_input_text,
						Text: userInput,
					},
				},
			},
		}

		// 添加图片
		for _, imageURL := range images {
			contentItems = append(contentItems, &responses.ContentItem{
				Union: &responses.ContentItem_Image{
					Image: &responses.ContentItemImage{
						Type:     responses.ContentItemType_input_image,
						ImageUrl: &imageURL,
					},
				},
			})
		}

		inputMessage := &responses.ItemInputMessage{
			Role:    responses.MessageRole_user,
			Content: contentItems,
		}

		req.Input = &responses.ResponsesInput{
			Union: &responses.ResponsesInput_ListValue{
				ListValue: &responses.InputItemList{
					ListValue: []*responses.InputItem{
						{
							Union: &responses.InputItem_InputMessage{
								InputMessage: inputMessage,
							},
						},
					},
				},
			},
		}
	}

	// 调用 API
	resp, err := client.CreateResponses(ctx, req)
	if err != nil {
		// 检查是否是 429 错误（账户限制）
		if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "SetLimitExceeded") || strings.Contains(err.Error(), "TooManyRequests") {
			return nil, fmt.Errorf("豆包 API 调用失败: 账户已达到推理限制，请访问豆包控制台的 'Model Activation' 页面，关闭 'Safe Experience Mode'（安全体验模式）以继续使用模型。错误详情: %w", err)
		}
		return nil, fmt.Errorf("豆包 API 调用失败: %w", err)
	}

	// 解析响应
	var responseContent strings.Builder
	var thinkingContent strings.Builder

	// 检查响应结构
	// resp.Output 是 []*responses.OutputItem 类型
	if resp.Output == nil || len(resp.Output) == 0 {
		return nil, fmt.Errorf("响应中没有输出内容")
	}

	// 遍历输出项
	for _, output := range resp.Output {
		if output.Union != nil {
			switch v := output.Union.(type) {
			case *responses.OutputItem_OutputMessage:
				msg := v.OutputMessage
				if msg != nil && msg.Content != nil {
					for _, contentItem := range msg.Content {
						if contentItem.Union != nil {
							// 使用 JSON 序列化/反序列化来提取内容（更安全的方法）
							// 这样可以避免类型断言的问题
							if jsonData, err := json.Marshal(contentItem); err == nil {
								var jsonMap map[string]interface{}
								if err := json.Unmarshal(jsonData, &jsonMap); err == nil {
									// 查找文本内容
									if text, ok := findTextInMap(jsonMap); ok {
										responseContent.WriteString(text)
									}
									// 查找思考内容（可能在 thinking 字段中）
									if thinkingMap, ok := jsonMap["thinking"].(map[string]interface{}); ok {
										if thinkingText, ok := thinkingMap["text"].(string); ok && thinkingText != "" {
											thinkingContent.WriteString(thinkingText)
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// 如果只有思考内容，使用思考内容作为最终内容
	finalContent := responseContent.String()
	if finalContent == "" && thinkingContent.Len() > 0 {
		finalContent = thinkingContent.String()
	}

	return &providers.ChatResponse{
		Content:    finalContent,
		TokensUsed: 0, // TODO: 从响应中获取 token 使用量
		Model:      config.ModelName,
	}, nil
}

// fetchUsageFromNonStreamRequest 通过非流式请求获取usage信息
func fetchUsageFromNonStreamRequest(ctx context.Context, client *http.Client, url string, apiKey string, modelName string, messages []map[string]interface{}) *providers.TokenUsage {
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

// ChatStream 流式聊天对话
// 使用 HTTP 流式请求（SSE格式），替代SDK实现，确保usage信息能正确返回用于计费
func (p *DoubaoProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	// 构建BaseURL和API端点
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	// 构建消息列表
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

	// 处理深度思考参数（豆包可能使用thinkingLevel）
	thinkingLevel := ""
	if v, ok := providerConfig["thinkingLevel"].(string); ok {
		thinkingLevel = v
	}

	// 构建请求体（启用流式输出）
	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": messages,
		"stream":   true,
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

	// 处理深度思考参数（如果支持）
	// 注意：豆包可能使用不同的参数格式，这里先尝试OpenAI兼容格式
	if thinkingLevel != "" {
		// 如果豆包支持thinking参数，可以在这里添加
		// 目前先保留，等待确认豆包的具体参数格式
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
		// 检查是否是 429 错误（账户限制）
		if resp.StatusCode == 429 || strings.Contains(string(body), "SetLimitExceeded") || strings.Contains(string(body), "TooManyRequests") {
			return fmt.Errorf("豆包 API 调用失败: 账户已达到推理限制，请访问豆包控制台的 'Model Activation' 页面，关闭 'Safe Experience Mode'（安全体验模式）以继续使用模型。错误详情: %s", string(body))
		}
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// 读取流式响应（SSE格式）
	scanner := bufio.NewScanner(resp.Body)
	var fullContent strings.Builder
	var fullReasoningContent strings.Builder
	var lastUsage *providers.TokenUsage // 保存最后一次的usage信息

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

				// **关键修复**：如果流结束时还没有收到usage，使用非流式请求获取usage
				if lastUsage == nil {
					lastUsage = fetchUsageFromNonStreamRequest(ctx, p.client, url, config.APIKey, config.ModelName, messages)
				}
				callback(finalContent, true, nil, lastUsage)
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
				// 尝试多种可能的usage字段名
				Usage *providers.TokenUsage `json:"usage"`
				// 有些API可能使用不同的字段名
				UsageInfo map[string]interface{} `json:"usage,omitempty"`
			}

			// 先解析为通用map，以便检查所有可能的usage字段
			var rawMap map[string]interface{}
			if err := json.Unmarshal([]byte(data), &rawMap); err != nil {
				continue
			}

			// **关键修复**：豆包的流式响应中，usage字段在每个chunk中都是null
			// 但是可能有一个最后的chunk只包含usage而没有choices，或者usage在流结束后的单独响应中
			// 先检查是否有choices，如果没有choices但有usage，说明这是usage专用chunk
			choicesRaw, hasChoices := rawMap["choices"]
			usageRaw, hasUsage := rawMap["usage"]

			// 如果这个chunk没有choices，只有usage（或usage不为null），说明这是usage专用chunk
			if (!hasChoices || choicesRaw == nil) && hasUsage && usageRaw != nil {
				if usageMap, ok := usageRaw.(map[string]interface{}); ok {
					parsedUsage := &providers.TokenUsage{}
					if promptTokens, ok := usageMap["prompt_tokens"].(float64); ok {
						parsedUsage.PromptTokens = int(promptTokens)
					}
					if completionTokens, ok := usageMap["completion_tokens"].(float64); ok {
						parsedUsage.CompletionTokens = int(completionTokens)
					}
					if totalTokens, ok := usageMap["total_tokens"].(float64); ok {
						parsedUsage.TotalTokens = int(totalTokens)
					}
					// 如果没有total_tokens，尝试计算
					if parsedUsage.TotalTokens == 0 {
						parsedUsage.TotalTokens = parsedUsage.PromptTokens + parsedUsage.CompletionTokens
					}
					if parsedUsage.TotalTokens > 0 {
						lastUsage = parsedUsage
						// 立即回调usage，确保计费逻辑能及时处理
						callback("", false, nil, parsedUsage)
						// 继续处理，等待流结束
						continue
					}
				}
			}

			// 解析为结构体
			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				continue
			}

			// 检查是否有usage信息（但usage不为null的情况）
			if streamResponse.Usage != nil {
				lastUsage = streamResponse.Usage
				// 立即回调usage，确保计费逻辑能及时处理
				callback("", false, nil, streamResponse.Usage)
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

					// **关键修复**：如果流结束时还没有收到usage，使用非流式请求获取usage
					if lastUsage == nil {
						lastUsage = fetchUsageFromNonStreamRequest(ctx, p.client, url, config.APIKey, config.ModelName, messages)
					}
					callback(finalContent, true, nil, lastUsage)
					return nil
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read stream: %w", err)
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
	// 豆包的流式API在流式响应中不返回usage信息，需要在流结束后通过非流式请求获取
	if lastUsage == nil {
		lastUsage = fetchUsageFromNonStreamRequest(ctx, p.client, url, config.APIKey, config.ModelName, messages)
	}
	callback(finalContent, true, nil, lastUsage)
	return nil
}

// Complete 文本补全
func (p *DoubaoProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	// 豆包可能不支持单独的补全接口，使用 Chat 方法
	chatResp, err := p.Chat(config, prompt, "", map[string]interface{}{})
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
	// 豆包可能不支持嵌入接口
	return nil, fmt.Errorf("豆包不支持文本嵌入功能")
}
