package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

type MCPToken struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"not null;index" json:"user_id"`
	Name        string         `gorm:"type:varchar(120);not null" json:"name"`
	TokenHash   string         `gorm:"type:varchar(64);not null;uniqueIndex" json:"-"`
	TokenPrefix string         `gorm:"type:varchar(40);not null;index" json:"token_prefix"`
	Scopes      shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"scopes"`
	ExpiresAt   *time.Time     `gorm:"index" json:"expires_at"`
	LastUsedAt  *time.Time     `json:"last_used_at"`
	LastUsedIP  *string        `gorm:"type:varchar(45)" json:"last_used_ip"`
	RevokedAt   *time.Time     `gorm:"index" json:"revoked_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (MCPToken) TableName() string {
	return "mcp_tokens"
}

type MCPCallLog struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	UserID         uint           `gorm:"not null;index" json:"user_id"`
	TokenID        *uint          `gorm:"index" json:"token_id"`
	ToolName       string         `gorm:"type:varchar(120);not null;index" json:"tool_name"`
	RequestSummary *string        `gorm:"type:text" json:"request_summary"`
	ResourceType   *string        `gorm:"type:varchar(80);index" json:"resource_type"`
	ResourceID     *string        `gorm:"type:varchar(120);index" json:"resource_id"`
	Status         string         `gorm:"type:varchar(20);not null;index" json:"status"`
	ErrorMessage   *string        `gorm:"type:text" json:"error_message"`
	LatencyMS      int64          `gorm:"not null;default:0" json:"latency_ms"`
	IP             *string        `gorm:"type:varchar(45)" json:"ip"`
	UserAgent      *string        `gorm:"type:text" json:"user_agent"`
	CreatedAt      time.Time      `gorm:"index" json:"created_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (MCPCallLog) TableName() string {
	return "mcp_call_logs"
}
