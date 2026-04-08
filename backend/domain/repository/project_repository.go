package repository

import (
	"yaolight-workshop/backend/domain/entity"
)

// ProjectRepository 项目仓储接口
type ProjectRepository interface {
	// Create 创建项目
	Create(project *entity.Project) error

	// FindByID 根据ID查找项目
	FindByID(id uint) (*entity.Project, error)

	// FindByUserID 根据用户ID查找项目列表
	FindByUserID(userID uint, offset, limit int) ([]*entity.Project, int64, error)

	// Update 更新项目
	Update(project *entity.Project) error

	// Delete 删除项目（软删除）
	Delete(id uint) error
}
