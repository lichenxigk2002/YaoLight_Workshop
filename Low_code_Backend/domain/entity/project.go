package entity

import "time"

// Project 项目领域实体（纯业务对象，不依赖 GORM）
type Project struct {
	ID          uint
	UserID      uint
	Name        string
	Description *string
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// IsActive 检查项目是否激活
func (p *Project) IsActive() bool {
	return p.Status == "active"
}

// IsArchived 检查项目是否已归档
func (p *Project) IsArchived() bool {
	return p.Status == "archived"
}
