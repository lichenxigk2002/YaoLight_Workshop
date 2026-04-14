package models

import (
	"time"

	"gorm.io/gorm"
)

// ManagedAIModel 系统级 AI 模型主数据。
// 这是 admin 管理域的模型主表，不复用用户侧 ai_models。
type ManagedAIModel struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Provider    string         `gorm:"type:varchar(50);not null;uniqueIndex:idx_managed_provider_model" json:"provider"`
	ModelName   string         `gorm:"type:varchar(150);not null;uniqueIndex:idx_managed_provider_model" json:"model_name"`
	DisplayName string         `gorm:"type:varchar(200);not null" json:"display_name"`
	Description *string        `gorm:"type:text" json:"description"`
	Status      string         `gorm:"type:varchar(20);not null;default:'active';check:status IN ('active','testing','disabled')" json:"status"`
	IsActive    bool           `gorm:"default:true;index" json:"is_active"`
	SortOrder   int            `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ManagedAIModel) TableName() string {
	return "managed_ai_models"
}
