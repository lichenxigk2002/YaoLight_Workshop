package repository

import (
	"yaolight-workshop/backend/domain/entity"
)

// WorkflowRepository 工作流仓储接口
type WorkflowRepository interface {
	Create(workflow *entity.Workflow) error
	FindByID(id uint) (*entity.Workflow, error)
	FindByProjectID(projectID uint, offset, limit int) ([]*entity.Workflow, int64, error)
	FindByUserID(userID uint, offset, limit int) ([]*entity.Workflow, int64, error)
	Update(workflow *entity.Workflow) error
	UpdateTemplateReference(id uint, templateID *uint) error
	Delete(id uint) error
}
