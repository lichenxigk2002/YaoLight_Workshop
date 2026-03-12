package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

type NotificationSendJob struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Name           *string        `gorm:"type:varchar(100);index" json:"name"`
	Channel        string         `gorm:"type:varchar(20);not null;default:'in_app';index" json:"channel"`
	Type           string         `gorm:"type:varchar(50);not null;index" json:"type"`
	Category       *string        `gorm:"type:varchar(50);index" json:"category"`
	Status         string         `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	TemplateID     *uint          `gorm:"index" json:"template_id"`
	RequestedBy    uint           `gorm:"not null;index" json:"requested_by"`
	RecipientCount int            `gorm:"not null;default:0" json:"recipient_count"`
	SuccessCount   int            `gorm:"not null;default:0" json:"success_count"`
	FailedCount    int            `gorm:"not null;default:0" json:"failed_count"`
	Title          string         `gorm:"type:varchar(200);not null" json:"title"`
	Content        *string        `gorm:"type:text" json:"content"`
	ActionURL      *string        `gorm:"type:varchar(500)" json:"action_url"`
	ExpiresAt      *time.Time     `json:"expires_at"`
	StartedAt      *time.Time     `json:"started_at"`
	FinishedAt     *time.Time     `json:"finished_at"`
	Metadata       *shared.JSONB  `gorm:"type:jsonb" json:"metadata"`
	CreatedAt      time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (NotificationSendJob) TableName() string {
	return "notification_send_jobs"
}
