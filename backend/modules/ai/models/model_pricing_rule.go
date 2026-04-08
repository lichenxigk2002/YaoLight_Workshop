package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// ModelPricingRule 模型计费规则历史表。
// admin 域维护版本历史；运行时仍使用 model_pricing_configs 作为当前生效快照。
type ModelPricingRule struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	ManagedModelID uint           `gorm:"not null;index;uniqueIndex:idx_model_version" json:"managed_model_id"`
	Provider       string         `gorm:"type:varchar(50);not null;index:idx_pricing_rule_provider_model" json:"provider"`
	ModelName      string         `gorm:"type:varchar(150);not null;index:idx_pricing_rule_provider_model" json:"model_name"`
	PricingType    string         `gorm:"type:varchar(50);not null" json:"pricing_type"`
	Currency       string         `gorm:"type:varchar(10);default:'USD'" json:"currency"`
	IsActive       bool           `gorm:"default:true;index" json:"is_active"`
	Version        int            `gorm:"not null;default:1;uniqueIndex:idx_model_version" json:"version"`
	EffectiveAt    time.Time      `gorm:"not null" json:"effective_at"`
	ExpiredAt      *time.Time     `json:"expired_at"`
	Description    *string        `gorm:"type:text" json:"description"`
	PricingData    shared.JSONB   `gorm:"type:jsonb;not null;default:'{}'" json:"pricing_data"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ModelPricingRule) TableName() string {
	return "model_pricing_rules"
}
