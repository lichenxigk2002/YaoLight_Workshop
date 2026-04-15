package repositories

import (
	"yaolight-workshop/backend/modules/user/models"

	"gorm.io/gorm"
)

// OAuthBindingRepository 用户第三方绑定仓储
type OAuthBindingRepository struct {
	db *gorm.DB
}

// NewOAuthBindingRepository 创建实例
func NewOAuthBindingRepository(db *gorm.DB) *OAuthBindingRepository {
	return &OAuthBindingRepository{db: db}
}

// Add 添加或更新绑定（同一 user_id + provider 仅一条）
func (r *OAuthBindingRepository) Add(userID uint, provider, oauthID string) error {
	var m models.UserOAuthBinding
	err := r.db.Where("user_id = ? AND provider = ?", userID, provider).First(&m).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.Create(&models.UserOAuthBinding{
			UserID:   userID,
			Provider: provider,
			OAuthID:  oauthID,
		}).Error
	}
	if err != nil {
		return err
	}
	return r.db.Model(&m).Update("oauth_id", oauthID).Error
}

// Remove 解除绑定
func (r *OAuthBindingRepository) Remove(userID uint, provider string) error {
	return r.db.Where("user_id = ? AND provider = ?", userID, provider).Delete(&models.UserOAuthBinding{}).Error
}

// GetByUser 返回该用户已绑定的 provider 列表，如 ["github","google"]
func (r *OAuthBindingRepository) GetByUser(userID uint) ([]string, error) {
	var list []models.UserOAuthBinding
	if err := r.db.Where("user_id = ?", userID).Find(&list).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(list))
	for _, b := range list {
		out = append(out, b.Provider)
	}
	return out, nil
}

// FindUserID 根据 provider + oauth_id 查 user_id，未找到返回 0, false
func (r *OAuthBindingRepository) FindUserID(provider, oauthID string) (uint, bool) {
	var m models.UserOAuthBinding
	if err := r.db.Where("provider = ? AND oauth_id = ?", provider, oauthID).First(&m).Error; err != nil {
		return 0, false
	}
	return m.UserID, true
}
