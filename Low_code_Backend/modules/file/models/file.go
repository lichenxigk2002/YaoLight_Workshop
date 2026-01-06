package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// File 文件存储持久化实体
type File struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	Name          string         `gorm:"type:varchar(255);not null" json:"name"`
	OriginalName  string         `gorm:"type:varchar(255);not null" json:"original_name"`
	Path          string         `gorm:"type:varchar(500);not null" json:"path"`
	URL           *string        `gorm:"type:varchar(500)" json:"url"`
	Size          int64          `gorm:"not null" json:"size"`
	MimeType      *string        `gorm:"type:varchar(100)" json:"mime_type"`
	Extension     *string        `gorm:"type:varchar(20)" json:"extension"`
	StorageType   string         `gorm:"type:varchar(20);default:'local';check:storage_type IN ('local','s3','oss','cos','azure')" json:"storage_type"`
	StorageConfig *shared.JSONB  `gorm:"type:jsonb" json:"storage_config"`
	TaskID        *uint          `gorm:"index" json:"task_id"`
	WorkflowID    *uint          `gorm:"index" json:"workflow_id"`
	UserID        *uint          `gorm:"index" json:"user_id"`
	IsPublic      bool           `gorm:"default:false" json:"is_public"`
	ExpiresAt     *time.Time     `json:"expires_at"`
	DownloadCount int            `gorm:"default:0" json:"download_count"`
	Checksum      *string        `gorm:"type:varchar(64)" json:"checksum"`
	CreatedAt     time.Time      `json:"created_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (File) TableName() string {
	return "files"
}
