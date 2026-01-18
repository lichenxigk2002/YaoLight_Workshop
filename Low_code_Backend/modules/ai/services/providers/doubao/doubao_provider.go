package doubao

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"yaolight-workshop/backend/modules/ai/services/providers"

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model/responses"
	"github.com/volcengine/volcengine-go-sdk/volcengine"
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

// ChatStream 流式聊天对话
// 使用 Chat Completion API（类似 OpenAI 格式），支持流式输出
func (p *DoubaoProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	// 构建BaseURL
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}

	// 创建客户端
	client := arkruntime.NewClientWithApiKey(
		config.APIKey,
		arkruntime.WithBaseUrl(baseURL),
	)

	// 构建输入内容
	userInput := prompt
	if content != "" {
		userInput = fmt.Sprintf("%s\n\n%s", prompt, content)
	}

	// 处理深度思考参数
	// 豆包使用 thinkingLevel（minimal/low/medium/high），而不是 thinking 布尔值
	// 注意：目前 SDK 的 Thinking 结构可能不支持 level 字段
	// 暂时读取 thinkingLevel 参数（用于后续扩展），但当前不使用
	// TODO: 当 SDK 支持 level 字段时，使用 thinkingLevel 设置思考长度
	if _, ok := providerConfig["thinkingLevel"].(string); ok {
		// thinkingLevel 已读取，后续扩展时使用
	}

	// 构建消息列表
	messages := []*model.ChatCompletionMessage{
		{
			Role: model.ChatMessageRoleUser,
			Content: &model.ChatCompletionMessageContent{
				StringValue: volcengine.String(userInput),
			},
		},
	}

	// 如果有系统提示词，添加到消息列表开头
	if config.SystemPrompt != "" {
		messages = append([]*model.ChatCompletionMessage{
			{
				Role: model.ChatMessageRoleSystem,
				Content: &model.ChatCompletionMessageContent{
					StringValue: volcengine.String(config.SystemPrompt),
				},
			},
		}, messages...)
	}

	// 构建请求
	req := model.CreateChatCompletionRequest{
		Model:    config.ModelName,
		Messages: messages,
		Stream:   volcengine.Bool(true),
	}

	// 深度思考参数：豆包默认开启思考，通过 level 控制思考长度
	// 注意：需要根据实际 SDK 的 Thinking 结构来设置 level
	// 如果 SDK 支持，可以设置 Thinking.Level 字段

	// 添加可选参数（注意类型转换）
	if config.Temperature != nil {
		temp := float32(*config.Temperature)
		req.Temperature = &temp
	}
	if config.MaxTokens != nil {
		req.MaxTokens = volcengine.Int(*config.MaxTokens)
	}
	if config.TopP != nil {
		topP := float32(*config.TopP)
		req.TopP = &topP
	}

	// 调用流式 API
	resp, err := client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		// 检查是否是 429 错误（账户限制）
		if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "SetLimitExceeded") || strings.Contains(err.Error(), "TooManyRequests") {
			return fmt.Errorf("豆包 API 调用失败: 账户已达到推理限制，请访问豆包控制台的 'Model Activation' 页面，关闭 'Safe Experience Mode'（安全体验模式）以继续使用模型。错误详情: %w", err)
		}
		return fmt.Errorf("豆包流式 API 调用失败: %w", err)
	}
	defer resp.Close()

	var fullContent strings.Builder
	var fullReasoningContent strings.Builder

	// 读取流式响应
	for {
		chunk, err := resp.Recv()
		if err != nil {
			if err == io.EOF {
				// 流结束
				break
			}
			// 检查 context 是否已取消
			select {
			case <-ctx.Done():
				callback("", true, ctx.Err())
				return ctx.Err()
			default:
				return fmt.Errorf("读取流式响应失败: %w", err)
			}
		}

		if len(chunk.Choices) == 0 {
			continue
		}

		choice := chunk.Choices[0]

		// 处理思考内容（如果有）
		// 注意：ReasoningContent 是 *string 类型，需要先检查 nil
		if choice.Delta.ReasoningContent != nil && *choice.Delta.ReasoningContent != "" {
			reasoningContent := *choice.Delta.ReasoningContent
			fullReasoningContent.WriteString(reasoningContent)
			// 发送带标记的思考内容（与 DeepSeek 格式一致）
			callback("[REASONING_DELTA]"+reasoningContent, false, nil)
		}

		// 处理正式内容
		// 注意：Content 是 string 类型
		if choice.Delta.Content != "" {
			content := choice.Delta.Content
			fullContent.WriteString(content)
			// 发送带标记的正式内容（与 DeepSeek 格式一致）
			callback("[CONTENT_DELTA]"+content, false, nil)
		}

		// 检查是否有完成标志（类似 DeepSeek 的 FinishReason 处理）
		// 注意：豆包 SDK 可能使用不同的字段名，这里先检查常见的字段
		// 如果流结束，会在 EOF 时处理
	}

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
