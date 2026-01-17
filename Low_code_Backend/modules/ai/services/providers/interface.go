package providers

import "context"

// ChatResponse 聊天响应
type ChatResponse struct {
	Content          string      `json:"content"`
	TokensUsed       int         `json:"tokens_used"`
	Model            string      `json:"model"`
	ReasoningDetails interface{} `json:"reasoning_details,omitempty"` // 用于存储推理模型的详细推理过程
}

// CompleteResponse 文本补全响应
type CompleteResponse struct {
	Text       string `json:"text"`
	TokensUsed int    `json:"tokens_used"`
}

// EmbedResponse 文本嵌入响应
type EmbedResponse struct {
	Embedding  []float64 `json:"embedding"`
	TokensUsed int       `json:"tokens_used"`
}

// AIModelConfig 统一的模型配置结构
type AIModelConfig struct {
	Provider         string
	ModelName        string
	APIKey           string // 已解密
	BaseURL          string
	Endpoint         string
	Temperature      *float64
	MaxTokens        *int
	TopP             *float64
	FrequencyPenalty *float64
	PresencePenalty  *float64
	SystemPrompt     string
	StopSequences    []string
}

// StreamCallback 流式输出回调函数
// content: 当前接收到的内容片段
// done: 是否完成
// err: 错误信息（如果有）
type StreamCallback func(content string, done bool, err error)

// AIProvider AI提供商接口
type AIProvider interface {
	// Chat 聊天对话
	// providerConfig: 提供商特定的配置参数（可选），例如DeepSeek的stream和thinking
	Chat(config *AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*ChatResponse, error)

	// ChatStream 流式聊天对话
	// ctx: 上下文，用于支持取消操作
	// 如果providerConfig中stream为true，则使用流式输出
	ChatStream(ctx context.Context, config *AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback StreamCallback) error

	// Complete 文本补全
	Complete(config *AIModelConfig, prompt string) (*CompleteResponse, error)

	// Embed 文本嵌入
	Embed(config *AIModelConfig, text string) (*EmbedResponse, error)
}
