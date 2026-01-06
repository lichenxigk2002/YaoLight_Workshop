package repositories

import (
	"workflow-management-system/backend/domain/entity"
	"workflow-management-system/backend/domain/repository"
	"workflow-management-system/backend/modules/user/models"

	"gorm.io/gorm"
)

// userRepository 用户仓储实现
type userRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓储实例
func NewUserRepository(db *gorm.DB) repository.UserRepository {
	return &userRepository{db: db}
}

// toDomainEntity 将持久化实体转换为领域实体
func toDomainEntity(m *models.User) *entity.User {
	return &entity.User{
		ID:          m.ID,
		Username:    m.Username,
		Email:       m.Email,
		Password:    m.Password,
		Phone:       m.Phone,
		RealName:    m.RealName,
		AvatarURL:   m.AvatarURL,
		Role:        m.Role,
		Status:      m.Status,
		LastLoginAt: m.LastLoginAt,
		LastLoginIP: m.LastLoginIP,
		LoginCount:  m.LoginCount,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

// toPersistenceEntity 将领域实体转换为持久化实体
func toPersistenceEntity(e *entity.User) *models.User {
	return &models.User{
		ID:          e.ID,
		Username:    e.Username,
		Email:       e.Email,
		Password:    e.Password,
		Phone:       e.Phone,
		RealName:    e.RealName,
		AvatarURL:   e.AvatarURL,
		Role:        e.Role,
		Status:      e.Status,
		LastLoginAt: e.LastLoginAt,
		LastLoginIP: e.LastLoginIP,
		LoginCount:  e.LoginCount,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

// Create 创建用户
func (r *userRepository) Create(user *entity.User) error {
	model := toPersistenceEntity(user)
	if err := r.db.Create(model).Error; err != nil {
		return err
	}
	// 更新领域实体的ID和时间戳
	user.ID = model.ID
	user.CreatedAt = model.CreatedAt
	user.UpdatedAt = model.UpdatedAt
	return nil
}

// FindByID 根据ID查找用户
func (r *userRepository) FindByID(id uint) (*entity.User, error) {
	var model models.User
	if err := r.db.First(&model, id).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

// FindByUsername 根据用户名查找用户
func (r *userRepository) FindByUsername(username string) (*entity.User, error) {
	var model models.User
	if err := r.db.Where("username = ?", username).First(&model).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

// FindByEmail 根据邮箱查找用户
func (r *userRepository) FindByEmail(email string) (*entity.User, error) {
	var model models.User
	if err := r.db.Where("email = ?", email).First(&model).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

// FindByUsernameOrEmail 根据用户名或邮箱查找用户
func (r *userRepository) FindByUsernameOrEmail(username, email string) (*entity.User, error) {
	var model models.User
	if err := r.db.Where("username = ? OR email = ?", username, email).First(&model).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

// Update 更新用户
func (r *userRepository) Update(user *entity.User) error {
	model := toPersistenceEntity(user)
	return r.db.Save(model).Error
}

// Delete 删除用户（软删除）
func (r *userRepository) Delete(id uint) error {
	return r.db.Delete(&models.User{}, id).Error
}
