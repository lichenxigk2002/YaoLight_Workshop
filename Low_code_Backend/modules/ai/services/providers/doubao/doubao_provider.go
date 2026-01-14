package doubao

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
	thinking := false
	if v, ok := providerConfig["thinking"].(bool); ok {
		thinking = v
	}
	if thinking {
		req.Thinking = &responses.ResponsesThinking{
			Type: responses.ThinkingType_enabled.Enum(),
		}
	} else {
		req.Thinking = &responses.ResponsesThinking{
			Type: responses.ThinkingType_disabled.Enum(),
		}
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

// ChatStream 流式聊天对话
// 注意：豆包 SDK 可能不支持流式输出，这里使用 HTTP 直接调用
func (p *DoubaoProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	// 构建BaseURL
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	url := fmt.Sprintf("%s/responses", baseURL)

	// 构建输入内容
	userInput := prompt
	if content != "" {
		userInput = fmt.Sprintf("%s\n\n%s", prompt, content)
	}

	// 处理深度思考参数
	thinking := false
	if v, ok := providerConfig["thinking"].(bool); ok {
		thinking = v
	}

	// 构建请求体（豆包的 Responses API 格式）
	requestBody := map[string]interface{}{
		"model": config.ModelName,
		"input": map[string]interface{}{
			"string_value": userInput,
		},
		"stream": true, // 启用流式输出
	}

	// 深度思考参数
	if thinking {
		requestBody["thinking"] = map[string]interface{}{
			"type": "enabled",
		}
	} else {
		requestBody["thinking"] = map[string]interface{}{
			"type": "disabled",
		}
	}

	// 处理多模态输入（图片等）
	if images, ok := providerConfig["images"].([]string); ok && len(images) > 0 {
		// 构建多模态消息
		contentItems := []map[string]interface{}{
			{
				"type": "input_text",
				"text": userInput,
			},
		}

		// 添加图片
		for _, imageURL := range images {
			contentItems = append(contentItems, map[string]interface{}{
				"type":      "input_image",
				"image_url": imageURL,
			})
		}

		requestBody["input"] = map[string]interface{}{
			"list_value": []map[string]interface{}{
				{
					"input_message": map[string]interface{}{
						"role":    "user",
						"content": contentItems,
					},
				},
			},
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

	// 设置请求头
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
	scanner := bufio.NewScanner(resp.Body)
	var fullContent strings.Builder
	var fullReasoningContent strings.Builder

	for scanner.Scan() {
		// 检查 context 是否已取消
		select {
		case <-ctx.Done():
			log.Printf("豆包流式: 收到取消信号，停止读取")
			callback("", true, ctx.Err())
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
				// 构造最终内容
				finalContent := ""
				if fullReasoningContent.Len() > 0 {
					finalContent = "[REASONING]" + fullReasoningContent.String() + "[/REASONING]"
				}
				if fullContent.Len() > 0 {
					finalContent += "[CONTENT]" + fullContent.String() + "[/CONTENT]"
				}
				callback(finalContent, true, nil)
				return nil
			}

			// 解析响应（需要根据豆包实际响应格式调整）
			var streamResponse map[string]interface{}
			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				continue
			}

			// TODO: 根据豆包实际流式响应格式解析
			// 这里需要根据实际API文档调整
			// 假设格式类似：
			// {
			//   "output": {
			//     "list_value": [{
			//       "output_message": {
			//         "content": [{
			//           "text": {"text": "..."},
			//           "thinking": {"text": "..."}
			//         }]
			//       }
			//     }]
			//   }
			// }

			// 临时实现：尝试解析常见的字段
			if output, ok := streamResponse["output"].(map[string]interface{}); ok {
				if listValue, ok := output["list_value"].([]interface{}); ok && len(listValue) > 0 {
					if firstItem, ok := listValue[0].(map[string]interface{}); ok {
						if outputMsg, ok := firstItem["output_message"].(map[string]interface{}); ok {
							if content, ok := outputMsg["content"].([]interface{}); ok {
								for _, item := range content {
									if contentItem, ok := item.(map[string]interface{}); ok {
										// 检查文本内容
										if text, ok := contentItem["text"].(map[string]interface{}); ok {
											if textStr, ok := text["text"].(string); ok && textStr != "" {
												fullContent.WriteString(textStr)
												callback("[CONTENT_DELTA]"+textStr, false, nil)
											}
										}
										// 检查思考内容
										if thinking, ok := contentItem["thinking"].(map[string]interface{}); ok {
											if thinkingStr, ok := thinking["text"].(string); ok && thinkingStr != "" {
												fullReasoningContent.WriteString(thinkingStr)
												callback("[REASONING_DELTA]"+thinkingStr, false, nil)
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
	callback(finalContent, true, nil)
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
