package models

import (
	"time"

	"gorm.io/gorm"
	"workflow-management-system/backend/infrastructure/shared"
)

// NodeType 节点类型持久化实体
type NodeType struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	Name          string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	Category      string         `gorm:"type:varchar(50);not null;index;check:category IN ('crawler','ai','output','condition','transform','start','end','custom')" json:"category"`
	Icon          *string        `gorm:"type:varchar(100)" json:"icon"`
	Color         *string        `gorm:"type:varchar(20)" json:"color"`
	ConfigSchema  shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"config_schema"`
	DefaultConfig shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"default_config"`
	Description   *string        `gorm:"type:text" json:"description"`
	Documentation *string        `gorm:"type:text" json:"documentation"`
	Examples      *shared.JSONB  `gorm:"type:jsonb" json:"examples"`
	IsSystem      bool           `gorm:"default:false;index" json:"is_system"`
	IsActive      bool           `gorm:"default:true;index" json:"is_active"`
	Version       string         `gorm:"type:varchar(20);default:'1.0.0'" json:"version"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (NodeType) TableName() string {
	return "node_types"
}
