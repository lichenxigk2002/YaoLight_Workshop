package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// AIModel AI模型配置持久化实体
type AIModel struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	Name             string         `gorm:"type:varchar(100);not null;index:idx_name_user,unique" json:"name"`
	Provider         string         `gorm:"type:varchar(50);not null;index" json:"provider"`
	ModelName        string         `gorm:"type:varchar(100);not null" json:"model_name"`
	APIKeyEncrypted  string         `gorm:"type:text;not null" json:"-"`
	Endpoint         *string        `gorm:"type:varchar(500)" json:"endpoint"`
	BaseURL          *string        `gorm:"type:varchar(500)" json:"base_url"`
	Params           shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"params"`
	Status           string         `gorm:"type:varchar(20);default:'active';index;check:status IN ('active','inactive','error','testing')" json:"status"`
	MaxTokens        *int           `gorm:"default:2000" json:"max_tokens"`
	Temperature      *float64       `gorm:"type:decimal(3,2);default:0.7" json:"temperature"`
	TopP             *float64       `gorm:"type:decimal(3,2)" json:"top_p"`
	FrequencyPenalty *float64       `gorm:"type:decimal(3,2)" json:"frequency_penalty"`
	PresencePenalty  *float64       `gorm:"type:decimal(3,2)" json:"presence_penalty"`
	StopSequences    *shared.JSONB  `gorm:"type:jsonb" json:"stop_sequences"`
	SystemPrompt     *string        `gorm:"type:text" json:"system_prompt"`
	PromptTemplate   *string        `gorm:"type:text" json:"prompt_template"`
	RateLimit        *shared.JSONB  `gorm:"type:jsonb" json:"rate_limit"`
	CostPerToken     *float64       `gorm:"type:decimal(10,6)" json:"cost_per_token"`
	UsageCount       int            `gorm:"default:0" json:"usage_count"`
	TotalTokens      int64          `gorm:"default:0" json:"total_tokens"`
	TotalCost        *float64       `gorm:"type:decimal(10,2);default:0" json:"total_cost"`
	LastUsedAt       *time.Time     `json:"last_used_at"`
	ErrorCount       int            `gorm:"default:0" json:"error_count"`
	AvgResponseTime  *int           `json:"avg_response_time"`
	CreatedBy        *uint          `gorm:"index;index:idx_name_user,unique" json:"created_by"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (AIModel) TableName() string {
	return "ai_models"
}
