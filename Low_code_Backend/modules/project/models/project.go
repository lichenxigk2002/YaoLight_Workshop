package models

import (
	"time"

	"gorm.io/gorm"
)

// Project 项目持久化实体
type Project struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"not null;index" json:"user_id"`
	Name        string         `gorm:"type:varchar(200);not null" json:"name"`
	Description *string        `gorm:"type:text" json:"description"`
	Status      string         `gorm:"type:varchar(20);default:'active';check:status IN ('active','archived')" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Project) TableName() string {
	return "projects"
}
