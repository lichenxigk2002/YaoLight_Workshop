package models

import (
	"time"

	"gorm.io/gorm"
)

type NotificationTemplate struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Name              string         `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"`
	Description       *string        `gorm:"type:text" json:"description"`
	Type              string         `gorm:"type:varchar(50);not null;index" json:"type"`
	Category          *string        `gorm:"type:varchar(50);index" json:"category"`
	TitleTemplate     string         `gorm:"type:varchar(200);not null" json:"title_template"`
	ContentTemplate   *string        `gorm:"type:text" json:"content_template"`
	ActionURLTemplate *string        `gorm:"type:varchar(500)" json:"action_url_template"`
	IsActive          bool           `gorm:"default:true;index" json:"is_active"`
	CreatedBy         uint           `gorm:"not null;index" json:"created_by"`
	UpdatedBy         *uint          `gorm:"index" json:"updated_by"`
	CreatedAt         time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (NotificationTemplate) TableName() string {
	return "notification_templates"
}
