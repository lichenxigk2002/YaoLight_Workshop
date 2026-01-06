package repository

import (
	"yaolight-workshop/backend/domain/entity"
)

// WorkflowRepository 工作流仓储接口
type WorkflowRepository interface {
	// Create 创建工作流
	Create(workflow *entity.Workflow) error

	// FindByID 根据ID查找工作流
	FindByID(id uint) (*entity.Workflow, error)

	// FindByProjectID 根据项目ID查找工作流列表
	FindByProjectID(projectID uint, offset, limit int) ([]*entity.Workflow, int64, error)

	// FindByUserID 根据用户ID查找工作流列表
	FindByUserID(userID uint, offset, limit int) ([]*entity.Workflow, int64, error)

	// Update 更新工作流
	Update(workflow *entity.Workflow) error

	// Delete 删除工作流（软删除）
	Delete(id uint) error
}
