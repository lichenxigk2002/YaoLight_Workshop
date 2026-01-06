package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// Workflow 工作流持久化实体
type Workflow struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	UserID           uint           `gorm:"not null;index" json:"userId"`
	ProjectID        *uint          `gorm:"index" json:"projectId"`
	Name             string         `gorm:"type:varchar(200);not null" json:"name"`
	Description      *string        `gorm:"type:text" json:"description"`
	Version          string         `gorm:"type:varchar(20);default:'1.0.0'" json:"version"`
	Status           string         `gorm:"type:varchar(20);default:'draft';check:status IN ('draft','published','archived','disabled')" json:"status"`
	Category         *string        `gorm:"type:varchar(50);index" json:"category"`
	Tags             shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"tags"`
	Config           shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"config"`
	Variables        shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"variables"`
	Settings         shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"settings"`
	IsTemplate       bool           `gorm:"default:false;index" json:"isTemplate"`
	IsPublic         bool           `gorm:"default:false;index" json:"isPublic"`
	TemplateID       *uint          `gorm:"index" json:"templateId"`
	ParentID         *uint          `gorm:"index" json:"parentId"`
	ExecutionCount   int            `gorm:"default:0" json:"executionCount"`
	SuccessCount     int            `gorm:"default:0" json:"successCount"`
	FailureCount     int            `gorm:"default:0" json:"failureCount"`
	LastExecutedAt   *time.Time     `json:"lastExecutedAt"`
	LastSuccessAt    *time.Time     `json:"lastSuccessAt"`
	LastFailureAt    *time.Time     `json:"lastFailureAt"`
	AvgExecutionTime *int           `json:"avgExecutionTime"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Workflow) TableName() string {
	return "workflows"
}

// WorkflowNode 工作流节点持久化实体
type WorkflowNode struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	WorkflowID    uint           `gorm:"not null;index" json:"workflowId"`
	NodeID        string         `gorm:"type:varchar(100);not null" json:"nodeId"`
	NodeType      string         `gorm:"type:varchar(50);not null;index" json:"nodeType"`
	Label         *string        `gorm:"type:varchar(200)" json:"label"`
	Position      shared.JSONB   `gorm:"type:jsonb;default:'{\"x\":0,\"y\":0}'" json:"position"`
	Config        shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"config"`
	Connections   shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"connections"`
	Conditions    *shared.JSONB  `gorm:"type:jsonb" json:"conditions"`
	SortOrder     int            `gorm:"default:0" json:"sortOrder"`
	IsEnabled     bool           `gorm:"default:true;index" json:"isEnabled"`
	ErrorHandling *shared.JSONB  `gorm:"type:jsonb" json:"errorHandling"`
	Timeout       *int           `json:"timeout"`
	RetryConfig   *shared.JSONB  `gorm:"type:jsonb" json:"retryConfig"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (WorkflowNode) TableName() string {
	return "workflow_nodes"
}

// WorkflowVersion 工作流版本历史持久化实体
type WorkflowVersion struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	WorkflowID  uint           `gorm:"not null;index" json:"workflow_id"`
	Version     string         `gorm:"type:varchar(20);not null" json:"version"`
	Config      shared.JSONB   `gorm:"type:jsonb;not null" json:"config"`
	Description *string        `gorm:"type:text" json:"description"`
	ChangeLog   *string        `gorm:"type:text" json:"change_log"`
	CreatedBy   *uint          `gorm:"index" json:"created_by"`
	CreatedAt   time.Time      `gorm:"index" json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (WorkflowVersion) TableName() string {
	return "workflow_versions"
}
