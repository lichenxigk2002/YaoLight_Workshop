package providers

import "context"

// ChatResponse 聊天响应
type ChatResponse struct {
	Content          string      `json:"content"`
	TokensUsed       int         `json:"tokens_used"`
	Usage            *TokenUsage `json:"usage,omitempty"`
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
	Provider              string
	ModelName             string
	APIKey                string // 已解密
	BaseURL               string
	Endpoint              string
	Temperature           *float64
	MaxTokens             *int
	TopP                  *float64
	FrequencyPenalty      *float64
	PresencePenalty       *float64
	SystemPrompt          string
	StopSequences         []string
	RequestTimeoutSeconds int
}

// TokenUsage Token使用统计
type TokenUsage struct {
	PromptTokens     int  `json:"prompt_tokens"`
	CompletionTokens int  `json:"completion_tokens"`
	TotalTokens      int  `json:"total_tokens"`
	CacheReadTokens  *int `json:"cache_read_tokens,omitempty"`  // 缓存读取token数
	CacheWriteTokens *int `json:"cache_write_tokens,omitempty"` // 缓存写入token数
	AudioTokens      *int `json:"audio_tokens,omitempty"`       // 音频token数
}

// StreamCallback 流式输出回调函数
// content: 当前接收到的内容片段
// done: 是否完成
// err: 错误信息（如果有）
// usage: Token使用统计（通常在done=true时返回）
type StreamCallback func(content string, done bool, err error, usage *TokenUsage)

// ToolDef 工具定义（OpenAI 兼容，用于 function calling）
type ToolDef struct {
	Type     string       `json:"type"` // "function"
	Function *ToolDefFunc `json:"function"`
}

// ToolDefFunc 工具函数定义
type ToolDefFunc struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters"` // JSON Schema object
}

// ToolCall 模型返回的工具调用
type ToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"` // "function"
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// ChatMessage 单条对话消息（支持 tool_calls / tool role）
type ChatMessage struct {
	Role       string      `json:"role"` // system, user, assistant, tool
	Content    string      `json:"content,omitempty"`
	ToolCallID string      `json:"tool_call_id,omitempty"` // role=tool 时必填
	ToolCalls  []*ToolCall `json:"tool_calls,omitempty"`   // role=assistant 且需调用工具时
}

// ChatResponseWithTools 带工具调用的聊天响应
type ChatResponseWithTools struct {
	Content    string      `json:"content"`
	ToolCalls  []*ToolCall `json:"tool_calls,omitempty"`
	TokensUsed int         `json:"tokens_used"`
	Usage      *TokenUsage `json:"usage,omitempty"`
	Model      string      `json:"model"`
}

// AIProvider AI提供商接口
type AIProvider interface {
	// Chat 聊天对话
	// providerConfig: 提供商特定的配置参数（可选），例如DeepSeek的stream和thinking
	Chat(config *AIModelConfig, prompt string, content string, providerConfig map[string]interface{}) (*ChatResponse, error)

	// ChatStream 流式聊天对话
	// ctx: 上下文，用于支持取消操作
	// 如果providerConfig中stream为true，则使用流式输出
	ChatStream(ctx context.Context, config *AIModelConfig, prompt string, content string, providerConfig map[string]interface{}, callback StreamCallback) error

	// ChatWithTools 带工具调用的聊天（用于 Agent/ReAct 循环）
	// messages: 对话消息列表（可含 assistant 的 tool_calls 与 role=tool 的 tool 结果）
	// tools: 工具定义列表（OpenAI 格式）
	// 返回助手消息：若含 tool_calls 则需调用方执行工具后再次调用本方法
	ChatWithTools(ctx context.Context, config *AIModelConfig, systemPrompt string, messages []ChatMessage, tools []ToolDef, providerConfig map[string]interface{}) (*ChatResponseWithTools, error)

	// Complete 文本补全
	Complete(config *AIModelConfig, prompt string) (*CompleteResponse, error)

	// Embed 文本嵌入
	Embed(config *AIModelConfig, text string) (*EmbedResponse, error)
}
