package agentic

import (
	"fmt"
	"strings"

	"yaolight-workshop/backend/infrastructure/config"
	aiServices "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

func buildAIConfig(userID uint) (*providers.AIModelConfig, error) {
	apiKey := strings.TrimSpace(config.OpenRouterAPIKey)
	if apiKey == "" {
		apiKey = strings.TrimSpace(config.OpenAIAPIKey)
	}
	if apiKey == "" {
		return nil, fmt.Errorf("未配置 OPENROUTER_API_KEY")
	}
	baseURL := strings.TrimSpace(config.OpenAIBaseURL)
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	modelName := strings.TrimSpace(config.OpenAIChatModel)
	if modelName == "" {
		modelName = "openai/gpt-5.4"
	}
	maxTokens := config.OpenAIMaxOutputTokens
	if maxTokens <= 0 {
		maxTokens = 8192
	}
	return &providers.AIModelConfig{
		Provider:              "gpt",
		ModelName:             modelName,
		APIKey:                apiKey,
		BaseURL:               baseURL,
		Temperature:           floatPtr(0.7),
		MaxTokens:             intPtr(maxTokens),
		RequestTimeoutSeconds: config.AIRequestTimeoutSeconds,
	}, nil
}

func buildAIProvider() (providers.AIProvider, error) {
	return aiServices.NewProviderFactory().GetProvider("gpt")
}

func floatPtr(f float64) *float64 { return &f }
func intPtr(i int) *int           { return &i }
