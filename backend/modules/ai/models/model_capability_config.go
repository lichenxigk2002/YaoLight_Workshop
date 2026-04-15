package models

import (
	"gorm.io/gorm"
	"time"
	"yaolight-workshop/backend/infrastructure/shared"
)

// ModelCapabilityConfig 模型能力配置表
// 按 provider + model_name 存储每个模型支持的能力（0/1），与 model_pricing_configs 维度一致
type ModelCapabilityConfig struct {
	ID                      uint           `gorm:"primaryKey" json:"id"`
	Provider                string         `gorm:"type:varchar(50);not null;uniqueIndex:idx_provider_model_cap" json:"provider"`
	ModelName               string         `gorm:"type:varchar(100);not null;uniqueIndex:idx_provider_model_cap" json:"model_name"`
	SupportTemperature      bool           `gorm:"default:true" json:"support_temperature"`
	SupportMaxTokens        bool           `gorm:"default:true" json:"support_max_tokens"`
	SupportTopP             bool           `gorm:"default:true" json:"support_top_p"`
	SupportStream           bool           `gorm:"default:false" json:"support_stream"`
	SupportThinking         bool           `gorm:"default:false" json:"support_thinking"`
	SupportThinkingLevel    bool           `gorm:"default:false" json:"support_thinking_level"`
	SupportEnableThinking   bool           `gorm:"default:false" json:"support_enable_thinking"`
	SupportFrequencyPenalty bool           `gorm:"default:false" json:"support_frequency_penalty"`
	SupportPresencePenalty  bool           `gorm:"default:false" json:"support_presence_penalty"`
	SupportStopSequences    bool           `gorm:"default:false" json:"support_stop_sequences"`
	SupportVision           bool           `gorm:"default:false" json:"support_vision"`
	SupportImageGeneration  bool           `gorm:"default:false" json:"support_image_generation"`
	MaxTokensLimit          int            `gorm:"default:32768" json:"max_tokens_limit"`
	CapabilityOptions       *shared.JSONB  `gorm:"type:jsonb" json:"capability_options,omitempty"` // 子配置，如图片生成分辨率等
	DisplayName             string         `gorm:"type:varchar(200)" json:"display_name"`
	SortOrder               int            `gorm:"default:0" json:"sort_order"`
	IsActive                bool           `gorm:"default:true;index" json:"is_active"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (ModelCapabilityConfig) TableName() string {
	return "model_capability_configs"
}
