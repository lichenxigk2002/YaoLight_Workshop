package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

type WebsiteSource struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	UserID            uint           `gorm:"not null;index" json:"userId"`
	ProjectID         uint           `gorm:"not null;index" json:"projectId"`
	Name              string         `gorm:"type:varchar(200);not null" json:"name"`
	BaseURL           string         `gorm:"type:varchar(500);not null" json:"baseUrl"`
	EntryURL          *string        `gorm:"type:varchar(500)" json:"entryUrl,omitempty"`
	ListURLExamples   shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"listUrlExamples"`
	DetailURLExamples shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"detailUrlExamples"`
	AllowedPatterns   shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"allowedPatterns"`
	BlockedPatterns   shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"blockedPatterns"`
	CrawlTips         *string        `gorm:"type:text" json:"crawlTips,omitempty"`
	AuthHint          *string        `gorm:"type:text" json:"authHint,omitempty"`
	ContentHint       *string        `gorm:"type:text" json:"contentHint,omitempty"`
	Tags              shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"tags"`
	Status            string         `gorm:"type:varchar(20);default:'active';index" json:"status"`
	LastCheckedAt     *time.Time     `json:"lastCheckedAt,omitempty"`
	LastCheckStatus   *string        `gorm:"type:varchar(20)" json:"lastCheckStatus,omitempty"`
	LastCheckMessage  *string        `gorm:"type:text" json:"lastCheckMessage,omitempty"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WebsiteSource) TableName() string {
	return "project_website_sources"
}
