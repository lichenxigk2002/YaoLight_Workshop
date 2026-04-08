package entity

import "time"

// Workflow 工作流领域实体
type Workflow struct {
	ID          uint
	UserID      uint
	ProjectID   *uint
	TemplateID  *uint
	Name        string
	Description *string
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// IsDraft 检查工作流是否为草稿
func (w *Workflow) IsDraft() bool {
	return w.Status == "draft"
}

// IsPublished 检查工作流是否已发布
func (w *Workflow) IsPublished() bool {
	return w.Status == "published"
}
