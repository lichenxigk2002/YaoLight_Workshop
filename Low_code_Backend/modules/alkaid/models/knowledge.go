package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// AlkaidKnowledge 瑶光星知识库（RAG/软知识）
// 用于存储最佳实践、排错手册、场景范式等非结构化知识
type AlkaidKnowledge struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    *uint          `gorm:"index" json:"userId"`                             // 为空表示系统公共知识，不为空表示用户个人知识库
	Category  string         `gorm:"type:varchar(50);not null;index" json:"category"` // node_usage, error_repair, best_practice, scene_template
	Target    string         `gorm:"type:varchar(100);index" json:"target"`           // 关联的目标（如 node_type 名, 错误码等）
	Title     string         `gorm:"type:varchar(200);not null" json:"title"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	Tags      shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"tags"`
	IsActive  bool           `gorm:"default:true;index" json:"isActive"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (AlkaidKnowledge) TableName() string {
	return "alkaid_knowledge"
}

// AlkaidNodeSpec 节点规格知识（硬约束）
// 专门用于辅助 AI 理解节点的输入输出变量和高级约束
type AlkaidNodeSpec struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	NodeTypeName string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"nodeTypeName"`
	InputSpec    shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"inputSpec"`   // 期望的输入变量结构
	OutputSpec   shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"outputSpec"`  // 产生的输出变量结构
	Constraints  shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"constraints"` // 节点的硬性约束（如：必须在循环内使用）
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (AlkaidNodeSpec) TableName() string {
	return "alkaid_node_specs"
}
