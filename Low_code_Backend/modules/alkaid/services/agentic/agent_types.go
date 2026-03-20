package agentic

import (
	"context"

	"yaolight-workshop/backend/modules/ai/services/providers"
)

type RunStreamRequest struct {
	SessionID uint
	UserID    uint
	Message   string
	Interrupt bool
	Context   map[string]interface{}
}

type toolStreamingProvider interface {
	ChatWithToolsStream(ctx context.Context, config *providers.AIModelConfig, systemPrompt string, messages []providers.ChatMessage, tools []providers.ToolDef, providerConfig map[string]interface{}, callback providers.StreamCallback) (*providers.ChatResponseWithTools, error)
}
