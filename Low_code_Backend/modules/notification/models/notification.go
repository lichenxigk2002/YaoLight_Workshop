package models

import (
	"time"

	"gorm.io/gorm"
	"workflow-management-system/backend/infrastructure/shared"
)

// Notification 通知持久化实体
type Notification struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	UserID              uint           `gorm:"not null;index" json:"user_id"`
	Type                string         `gorm:"type:varchar(50);not null;index" json:"type"`
	Category            *string        `gorm:"type:varchar(50)" json:"category"`
	Title               string         `gorm:"type:varchar(200);not null" json:"title"`
	Content             *string        `gorm:"type:text" json:"content"`
	IsRead              bool           `gorm:"default:false;index" json:"is_read"`
	ReadAt              *time.Time     `json:"read_at"`
	ActionURL           *string        `gorm:"type:varchar(500)" json:"action_url"`
	RelatedResourceType *string        `gorm:"type:varchar(50)" json:"related_resource_type"`
	RelatedResourceID   *uint          `json:"related_resource_id"`
	Metadata            *shared.JSONB  `gorm:"type:jsonb" json:"metadata"`
	ExpiresAt           *time.Time     `json:"expires_at"`
	CreatedAt           time.Time      `gorm:"index" json:"created_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Notification) TableName() string {
	return "notifications"
}
