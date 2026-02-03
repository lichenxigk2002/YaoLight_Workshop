package repositories

import (
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/modules/user/models"

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
		ID:            m.ID,
		UserNo:        m.UserNo,
		Username:      m.Username,
		Email:         m.Email,
		Password:      m.Password,
		Phone:         m.Phone,
		RealName:      m.RealName,
		AvatarURL:     m.AvatarURL,
		Role:          m.Role,
		Status:        m.Status,
		LastLoginAt:   m.LastLoginAt,
		LastLoginIP:   m.LastLoginIP,
		LoginCount:    m.LoginCount,
		TokenBalance:  m.TokenBalance,
		OAuthProvider: m.OAuthProvider,
		OAuthID:       m.OAuthID,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}

// toPersistenceEntity 将领域实体转换为持久化实体
func toPersistenceEntity(e *entity.User) *models.User {
	return &models.User{
		ID:            e.ID,
		UserNo:        e.UserNo,
		Username:      e.Username,
		Email:         e.Email,
		Password:      e.Password,
		Phone:         e.Phone,
		RealName:      e.RealName,
		AvatarURL:     e.AvatarURL,
		Role:          e.Role,
		Status:        e.Status,
		LastLoginAt:   e.LastLoginAt,
		LastLoginIP:   e.LastLoginIP,
		LoginCount:    e.LoginCount,
		TokenBalance:  e.TokenBalance,
		OAuthProvider: e.OAuthProvider,
		OAuthID:       e.OAuthID,
		CreatedAt:     e.CreatedAt,
		UpdatedAt:     e.UpdatedAt,
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

// FindByUserNo 根据用户编号查找用户（用于随机 ID 唯一性校验）
func (r *userRepository) FindByUserNo(userNo int64) (*entity.User, error) {
	var model models.User
	if err := r.db.Where("user_no = ?", userNo).First(&model).Error; err != nil {
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

// EmailTakenByOther 邮箱是否已被其他用户使用（排除 excludeUserID）
func (r *userRepository) EmailTakenByOther(email string, excludeUserID uint) (bool, error) {
	var count int64
	if err := r.db.Model(&models.User{}).Where("email = ? AND id != ?", email, excludeUserID).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// FindByUsernameOrEmail 根据用户名或邮箱查找用户
func (r *userRepository) FindByUsernameOrEmail(username, email string) (*entity.User, error) {
	var model models.User
	if err := r.db.Where("username = ? OR email = ?", username, email).First(&model).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

// FindByOAuth 根据第三方 provider + oauth_id 查找用户
func (r *userRepository) FindByOAuth(provider, oauthID string) (*entity.User, error) {
	var model models.User
	if err := r.db.Where("oauth_provider = ? AND oauth_id = ?", provider, oauthID).First(&model).Error; err != nil {
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

// DeductTokens 扣除用户Token
func (r *userRepository) DeductTokens(userID uint, amount int64) error {
	return r.db.Model(&models.User{}).Where("id = ?", userID).Update("token_balance", gorm.Expr("token_balance - ?", amount)).Error
}
