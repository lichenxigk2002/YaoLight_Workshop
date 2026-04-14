package agentic

import (
	"fmt"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

func buildAIConfig(userID uint) (*providers.AIModelConfig, error) {
	if config.DeepSeekAPIKey == "" {
		return nil, fmt.Errorf("未配置 DEEPSEEK_API_KEY")
	}
	return &providers.AIModelConfig{
		Provider:              "deepseek",
		ModelName:             "deepseek-chat",
		APIKey:                config.DeepSeekAPIKey,
		BaseURL:               "https://api.deepseek.com",
		Temperature:           floatPtr(0.7),
		MaxTokens:             intPtr(8192),
		RequestTimeoutSeconds: config.AIRequestTimeoutSeconds,
	}, nil
}

func floatPtr(f float64) *float64 { return &f }
func intPtr(i int) *int           { return &i }
