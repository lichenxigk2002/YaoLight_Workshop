package models

import (
	"time"

	"gorm.io/gorm"
)

type NotificationDelivery struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	SendJobID        uint           `gorm:"not null;index" json:"send_job_id"`
	NotificationID   *uint          `gorm:"index" json:"notification_id"`
	TemplateID       *uint          `gorm:"index" json:"template_id"`
	UserID           uint           `gorm:"not null;index" json:"user_id"`
	UsernameSnapshot *string        `gorm:"type:varchar(100)" json:"username_snapshot"`
	EmailSnapshot    *string        `gorm:"type:varchar(100)" json:"email_snapshot"`
	Status           string         `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	FailureReason    *string        `gorm:"type:text" json:"failure_reason"`
	SentAt           *time.Time     `json:"sent_at"`
	CreatedAt        time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (NotificationDelivery) TableName() string {
	return "notification_deliveries"
}
