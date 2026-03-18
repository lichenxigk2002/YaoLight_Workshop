package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// AlkaidKnowledge stores system/user/project/workflow scoped knowledge.
type AlkaidKnowledge struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	UserID     *uint          `gorm:"index" json:"userId"`
	ProjectID  *uint          `gorm:"index" json:"projectId,omitempty"`
	WorkflowID *uint          `gorm:"index" json:"workflowId,omitempty"`
	SourceType string         `gorm:"type:varchar(20);default:'system';index" json:"sourceType"`
	Category   string         `gorm:"type:varchar(50);not null;index" json:"category"`
	Target     string         `gorm:"type:varchar(100);index" json:"target"`
	Title      string         `gorm:"type:varchar(200);not null" json:"title"`
	Content    string         `gorm:"type:text;not null" json:"content"`
	SourceName *string        `gorm:"type:varchar(255)" json:"sourceName,omitempty"`
	SourceMime *string        `gorm:"type:varchar(120)" json:"sourceMimeType,omitempty"`
	SourceSize *int64         `json:"sourceSize,omitempty"`
	Tags       shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"tags"`
	IsActive   bool           `gorm:"default:true;index" json:"isActive"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AlkaidKnowledge) TableName() string {
	return "alkaid_knowledge"
}

// AlkaidNodeSpec stores hard constraints/specs for node types.
type AlkaidNodeSpec struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	NodeTypeName string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"nodeTypeName"`
	InputSpec    shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"inputSpec"`
	OutputSpec   shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"outputSpec"`
	Constraints  shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"constraints"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AlkaidNodeSpec) TableName() string {
	return "alkaid_node_specs"
}
