package repository

import (
	"workflow-management-system/backend/domain/entity"
)

// UserRepository 用户仓储接口
type UserRepository interface {
	// Create 创建用户
	Create(user *entity.User) error

	// FindByID 根据ID查找用户
	FindByID(id uint) (*entity.User, error)

	// FindByUsername 根据用户名查找用户
	FindByUsername(username string) (*entity.User, error)

	// FindByEmail 根据邮箱查找用户
	FindByEmail(email string) (*entity.User, error)

	// FindByUsernameOrEmail 根据用户名或邮箱查找用户
	FindByUsernameOrEmail(username, email string) (*entity.User, error)

	// Update 更新用户
	Update(user *entity.User) error

	// Delete 删除用户（软删除）
	Delete(id uint) error
}
