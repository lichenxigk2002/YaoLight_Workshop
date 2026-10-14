package models

import (
	"time"

	"gorm.io/gorm"
)

type WorkflowTemplateConsent struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	TemplateID        uint           `gorm:"not null;index:idx_workflow_template_consents_template_source,unique" json:"template_id"`
	SourceWorkflowID  uint           `gorm:"not null;index:idx_workflow_template_consents_template_source,unique" json:"source_workflow_id"`
	SourceOwnerUserID uint           `gorm:"not null;index" json:"source_owner_user_id"`
	Status            string         `gorm:"type:varchar(20);not null;default:'pending';index;check:status IN ('pending','agreed','rejected')" json:"status"`
	NotificationID    *uint          `gorm:"index" json:"notification_id"`
	RespondedAt       *time.Time     `json:"responded_at"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WorkflowTemplateConsent) TableName() string {
	return "workflow_template_consents"
}
