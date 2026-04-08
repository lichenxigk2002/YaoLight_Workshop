package models

import (
	"time"

	"gorm.io/gorm"
)

// AIModelProbeResult stores the latest probe result for a managed model.
type AIModelProbeResult struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	ManagedModelID      uint           `gorm:"not null;uniqueIndex" json:"managed_model_id"`
	Provider            string         `gorm:"type:varchar(50);not null;index" json:"provider"`
	ModelName           string         `gorm:"type:varchar(150);not null;index" json:"model_name"`
	ProbeStatus         string         `gorm:"type:varchar(30);not null;default:'unknown';index" json:"probe_status"`
	LastCheckedAt       *time.Time     `json:"last_checked_at"`
	LastSuccessAt       *time.Time     `json:"last_success_at"`
	LastLatencyMs       *int           `json:"last_latency_ms"`
	LastError           *string        `gorm:"type:text" json:"last_error"`
	LastResponsePreview *string        `gorm:"type:varchar(255)" json:"last_response_preview"`
	LastProbeMode       *string        `gorm:"type:varchar(20)" json:"last_probe_mode"`
	ConsecutiveFailures int            `gorm:"not null;default:0" json:"consecutive_failures"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AIModelProbeResult) TableName() string {
	return "ai_model_probe_results"
}
