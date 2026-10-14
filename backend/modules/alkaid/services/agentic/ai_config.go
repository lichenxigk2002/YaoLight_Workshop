package agentic

import (
	"fmt"
	"strings"

	"yaolight-workshop/backend/infrastructure/config"
	aiServices "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

func buildAIConfig(userID uint) (*providers.AIModelConfig, error) {
	apiKey := strings.TrimSpace(config.DeepSeekAPIKey)
	if apiKey == "" {
		return nil, fmt.Errorf("未配置 DEEPSEEK_API_KEY")
	}
	modelName := strings.TrimSpace(config.DeepSeekChatModel)
	if modelName == "" {
		modelName = "deepseek-v4-pro"
	}
	maxTokens := config.OpenAIMaxOutputTokens
	if maxTokens <= 0 {
		maxTokens = 8192
	}
	return &providers.AIModelConfig{
		Provider:              "deepseek",
		ModelName:             modelName,
		APIKey:                apiKey,
		BaseURL:               "https://api.deepseek.com",
		Temperature:           floatPtr(0.7),
		MaxTokens:             intPtr(maxTokens),
		RequestTimeoutSeconds: config.AIRequestTimeoutSeconds,
	}, nil
}

func buildAIProvider() (providers.AIProvider, error) {
	return aiServices.NewProviderFactory().GetProvider("deepseek")
}

func floatPtr(f float64) *float64 { return &f }
func intPtr(i int) *int           { return &i }
