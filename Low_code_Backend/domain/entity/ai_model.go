package entity

import (
	"time"
	"yaolight-workshop/backend/infrastructure/shared"
)

// AIModel AI模型领域实体
type AIModel struct {
	ID               uint
	Name             string
	Provider         string
	ModelName        string
	APIKeyEncrypted  string
	Endpoint         *string
	BaseURL          *string
	Params           shared.JSONB
	Status           string
	MaxTokens        *int
	Temperature      *float64
	TopP             *float64
	FrequencyPenalty *float64
	PresencePenalty  *float64
	StopSequences    *shared.JSONB
	SystemPrompt     *string
	PromptTemplate   *string
	RateLimit        *shared.JSONB
	CostPerToken     *float64
	UsageCount       int
	TotalTokens      int64
	TotalCost        *float64
	LastUsedAt       *time.Time
	ErrorCount       int
	AvgResponseTime  *int
	CreatedBy        *uint
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// IsActive 检查模型是否激活
func (m *AIModel) IsActive() bool {
	return m.Status == "active"
}

// CanUse 检查模型是否可以使用
func (m *AIModel) CanUse() bool {
	return m.IsActive() && m.APIKeyEncrypted != ""
}
