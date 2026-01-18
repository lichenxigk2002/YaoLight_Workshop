package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// ProviderTemplate AI供应商模板持久化实体
type ProviderTemplate struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	Provider        string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"provider"`
	Name            string         `gorm:"type:varchar(100);not null" json:"name"`
	Description     *string        `gorm:"type:text" json:"description"`
	Icon            *string        `gorm:"type:varchar(100)" json:"icon"`
	DefaultBaseURL  *string        `gorm:"type:varchar(500)" json:"default_base_url"`
	DefaultEndpoint *string        `gorm:"type:varchar(500)" json:"default_endpoint"`
	SupportedModels shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"supported_models"`
	ConfigSchema    shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"config_schema"`
	DefaultConfig   shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"default_config"`
	IsActive        bool           `gorm:"default:true;index" json:"is_active"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (ProviderTemplate) TableName() string {
	return "ai_provider_templates"
}
