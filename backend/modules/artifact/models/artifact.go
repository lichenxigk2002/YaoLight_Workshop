package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// Artifact 表示一次执行生成的制品（文件/文本/图片等）的持久化记录
// 设计目标：
// - 输出节点生成结果后，统一落为 artifact
// - 站内预览/下载、站内通知、邮件投递、对外导出 API 都围绕 artifact 做
type Artifact struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 归属与关联
	UserID     uint   `gorm:"not null;index" json:"userId"`
	WorkflowID *uint  `gorm:"index" json:"workflowId,omitempty"`
	TaskID     *uint  `gorm:"index" json:"taskId,omitempty"`
	NodeID     string `gorm:"type:varchar(100);index" json:"nodeId"`

	// 展示信息
	Name        string  `gorm:"type:varchar(255);not null" json:"name"`
	Description *string `gorm:"type:text" json:"description,omitempty"`

	// 类型信息
	Kind     string `gorm:"type:varchar(50);not null;index" json:"kind"` // e.g. json/markdown/text/pdf/docx/png/svg
	MimeType string `gorm:"type:varchar(100);not null" json:"mimeType"`
	Size     int64  `gorm:"not null;default:0" json:"size"`

	// 存储信息（先实现 local；后续可扩展 cos/s3 等）
	Storage string `gorm:"type:varchar(20);not null;default:'local'" json:"storage"` // local/cos/s3...
	Path    string `gorm:"type:varchar(500);not null" json:"path"`                   // 相对路径（相对于 ArtifactStorageRoot）

	// 可选元信息
	Metadata *shared.JSONB `gorm:"type:jsonb" json:"metadata,omitempty"`

	CreatedAt time.Time      `gorm:"index" json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Artifact) TableName() string { return "artifacts" }
