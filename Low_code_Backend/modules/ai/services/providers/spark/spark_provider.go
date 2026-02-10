package spark

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

type SparkProvider struct {
	client *http.Client
}

func NewSparkProvider() providers.AIProvider {
	return &SparkProvider{
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

func applyThinking(requestBody map[string]interface{}, providerConfig map[string]interface{}) {
	if providerConfig == nil {
		log.Printf("[流式调试-讯飞星火] providerConfig 为 nil，不添加 thinking 参数")
		return
	}

	log.Printf("[流式调试-讯飞星火] providerConfig=%+v", providerConfig)

	// 优先使用 thinkingType 参数
	if v, ok := providerConfig["thinkingType"]; ok {
		if s, ok := v.(string); ok && s != "" {
			requestBody["thinking"] = map[string]interface{}{
				"type": s,
			}
			log.Printf("[流式调试-讯飞星火] 使用 thinkingType=%s", s)
			return
		}
	}

	// 兼容 thinking 布尔参数
	if v, ok := providerConfig["thinking"]; ok {
		if b, ok := v.(bool); ok {
			t := "disabled"
			if b {
				t = "enabled"
			}
			requestBody["thinking"] = map[string]interface{}{
				"type": t,
			}
			log.Printf("[流式调试-讯飞星火] 使用 thinking=%v，转换为 type=%s", b, t)
			return
		}
	}

	log.Printf("[流式调试-讯飞星火] 未找到 thinkingType 或 thinking 参数，不添加 thinking 参数")
}

func applyUser(requestBody map[string]interface{}, providerConfig map[string]interface{}) {
	if providerConfig == nil {
		return
	}
	if v, ok := providerConfig["user"]; ok {
		if s, ok := v.(string); ok && s != "" {
			requestBody["user"] = s
		}
	}
}

func (p *SparkProvider) Chat(config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*providers.ChatResponse, error) {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://spark-api-open.xf-yun.com/v2"
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

	applyThinking(requestBody, providerConfig)
	applyUser(requestBody, providerConfig)

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
		Code    int    `json:"code"`
		Message string `json:"message"`
		Choices []struct {
			Message struct {
				Role             string `json:"role"`
				Content          string `json:"content"`
				ReasoningContent string `json:"reasoning_content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if response.Code != 0 {
		return nil, fmt.Errorf("Spark API error %d: %s", response.Code, response.Message)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	msg := response.Choices[0].Message
	var reasoning interface{}
	if msg.ReasoningContent != "" {
		reasoning = msg.ReasoningContent
	}

	return &providers.ChatResponse{
		Content:          msg.Content,
		TokensUsed:       response.Usage.TotalTokens,
		Model:            config.ModelName,
		ReasoningDetails: reasoning,
	}, nil
}

func (p *SparkProvider) ChatWithTools(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}) (*providers.ChatResponseWithTools, error) {
	return nil, fmt.Errorf("tool calling not implemented for Spark provider")
}

func (p *SparkProvider) ChatStream(ctx context.Context, config *providers.AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback providers.StreamCallback) error {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "https://spark-api-open.xf-yun.com/v2"
	}
	baseURL = normalizeBaseURL(baseURL)
	url := fmt.Sprintf("%s/chat/completions", baseURL)

	requestBody := map[string]interface{}{
		"model":    config.ModelName,
		"messages": buildMessages(config, prompt, content),
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

	applyThinking(requestBody, providerConfig)
	applyUser(requestBody, providerConfig)

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

		payload := line
		if strings.HasPrefix(payload, "data:") {
			payload = strings.TrimSpace(strings.TrimPrefix(payload, "data:"))
		}

		if payload == "" {
			continue
		}

		if payload == "[DONE]" {
			callback("", true, nil, nil)
			return nil
		}

		if !strings.HasPrefix(payload, "{") {
			continue
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
			} `json:"choices"`
			Usage *providers.TokenUsage `json:"usage"`
		}

		if err := json.Unmarshal([]byte(payload), &streamResponse); err != nil {
			continue
		}

		if streamResponse.Code != 0 {
			callback("", true, fmt.Errorf("Spark API error %d: %s", streamResponse.Code, streamResponse.Message), nil)
			return fmt.Errorf("Spark API error %d: %s", streamResponse.Code, streamResponse.Message)
		}

		if streamResponse.Usage != nil {
			callback("", false, nil, streamResponse.Usage)
		}

		if len(streamResponse.Choices) == 0 {
			continue
		}

		delta := streamResponse.Choices[0].Delta
		if delta.ReasoningContent != "" {
			callback("[REASONING_DELTA]"+delta.ReasoningContent, false, nil, nil)
		}
		if delta.Content != "" {
			callback("[CONTENT_DELTA]"+delta.Content, false, nil, nil)
		}
	}

	callback("", true, nil, nil)
	return nil
}

func (p *SparkProvider) Complete(config *providers.AIModelConfig, prompt string) (*providers.CompleteResponse, error) {
	chatResp, err := p.Chat(config, prompt, "", nil)
	if err != nil {
		return nil, err
	}
	return &providers.CompleteResponse{
		Text:       chatResp.Content,
		TokensUsed: chatResp.TokensUsed,
	}, nil
}

func (p *SparkProvider) Embed(config *providers.AIModelConfig, text string) (*providers.EmbedResponse, error) {
	return nil, fmt.Errorf("Spark does not support embedding API in this integration")
}
