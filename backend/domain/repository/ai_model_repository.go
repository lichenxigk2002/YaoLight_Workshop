package repository

import (
	"yaolight-workshop/backend/domain/entity"
)

// AIModelRepository AI模型仓储接口
type AIModelRepository interface {
	// Create 创建AI模型配置
	Create(model *entity.AIModel) error

	// FindByID 根据ID查找模型
	FindByID(id uint) (*entity.AIModel, error)

	// FindByIDAndUser 根据ID和用户ID查找模型（验证归属）
	FindByIDAndUser(id uint, userID uint) (*entity.AIModel, error)

	// FindByUserID 根据用户ID查找模型列表
	FindByUserID(userID uint, offset, limit int) ([]*entity.AIModel, int64, error)

	// Update 更新模型配置
	Update(model *entity.AIModel) error

	// Delete 删除模型配置（软删除）
	Delete(id uint) error

	// UpdateUsage 更新模型使用统计
	UpdateUsage(id uint, tokens int64, cost float64) error
}
