package deepseek

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
			TotalTokens int `json:"total_tokens"`
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
		Model:      config.ModelName,
	}, nil
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
			log.Printf("DeepSeek流式: 收到取消信号，停止读取")
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
				// 构造最终内容：如果有思考内容，格式为 [REASONING]...[/REASONING][CONTENT]...[/CONTENT]
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

			var streamResponse struct {
				Choices []struct {
					Delta struct {
						Content          string `json:"content"`
						ReasoningContent string `json:"reasoning_content"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
				Usage struct {
					TotalTokens int `json:"total_tokens"`
				} `json:"usage"`
			}

			if err := json.Unmarshal([]byte(data), &streamResponse); err != nil {
				continue
			}

			if len(streamResponse.Choices) > 0 {
				// 处理思考内容
				deltaReasoningContent := streamResponse.Choices[0].Delta.ReasoningContent
				if deltaReasoningContent != "" {
					previewLen := len(deltaReasoningContent)
					if previewLen > 50 {
						previewLen = 50
					}
					log.Printf("DeepSeek流式: 收到思考内容，长度: %d, 预览: %s", len(deltaReasoningContent), deltaReasoningContent[:previewLen])
					fullReasoningContent.WriteString(deltaReasoningContent)
					// 发送带标记的思考内容
					callback("[REASONING_DELTA]"+deltaReasoningContent, false, nil)
				}

				// 处理正式内容
				deltaContent := streamResponse.Choices[0].Delta.Content
				if deltaContent != "" {
					previewLen := len(deltaContent)
					if previewLen > 50 {
						previewLen = 50
					}
					log.Printf("DeepSeek流式: 收到正式内容，长度: %d, 预览: %s", len(deltaContent), deltaContent[:previewLen])
					fullContent.WriteString(deltaContent)
					// 发送带标记的正式内容
					callback("[CONTENT_DELTA]"+deltaContent, false, nil)
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
					callback(finalContent, true, nil)
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
	callback(finalContent, true, nil)
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
