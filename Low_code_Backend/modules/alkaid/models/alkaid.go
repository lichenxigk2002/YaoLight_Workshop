package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// 注：Agentic 相关字段 CurrentPhase/ToolStepsJSON/PendingWorkflowJSON/PendingPatchJSON 需迁移 010 增加列

// AlkaidSession 瑶光星对话会话
type AlkaidSession struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	UserID     uint   `gorm:"not null;index" json:"userId"`
	WorkflowID *uint  `gorm:"index" json:"workflowId"` // 可关联特定工作流
	Title      string `gorm:"type:varchar(200);not null" json:"title"`
	Status     string `gorm:"type:varchar(20);default:'active'" json:"status"`

	// Agentic 增强：当前阶段、工具步、待确认工作流/补丁（仅新流使用，旧流为空）
	CurrentPhase        string       `gorm:"type:varchar(32);default:''" json:"currentPhase,omitempty"`
	ToolStepsJSON       shared.JSONB `gorm:"type:jsonb" json:"toolSteps,omitempty"`       // []AgentToolStep，最近 N 条
	PendingWorkflowJSON shared.JSONB `gorm:"type:jsonb" json:"pendingWorkflow,omitempty"` // WorkflowExportData
	PendingPatchJSON    shared.JSONB `gorm:"type:jsonb" json:"pendingPatch,omitempty"`    // []PatchItem

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (AlkaidSession) TableName() string {
	return "alkaid_sessions"
}

// AlkaidMessage 瑶光星对话消息
type AlkaidMessage struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	SessionID uint           `gorm:"not null;index" json:"sessionId"`
	Role      string         `gorm:"type:varchar(20);not null" json:"role"` // user, assistant, system
	Content   string         `gorm:"type:text;not null" json:"content"`
	RawData   shared.JSONB   `gorm:"type:jsonb" json:"rawData"`                   // 存储 AI 返回的原始结构化数据（如 Patch）
	Type      string         `gorm:"type:varchar(50);default:'text'" json:"type"` // text, patch, suggestion
	CreatedAt time.Time      `json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (AlkaidMessage) TableName() string {
	return "alkaid_messages"
}
