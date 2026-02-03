package repositories

import (
	"yaolight-workshop/backend/modules/user/models"

	"gorm.io/gorm"
)

// AvatarHistoryRepository 头像历史仓储
type AvatarHistoryRepository struct {
	db *gorm.DB
}

// NewAvatarHistoryRepository 创建实例
func NewAvatarHistoryRepository(db *gorm.DB) *AvatarHistoryRepository {
	return &AvatarHistoryRepository{db: db}
}

// Create 添加一条历史
func (r *AvatarHistoryRepository) Create(m *models.UserAvatarHistory) error {
	return r.db.Create(m).Error
}

// ListByUserID 按用户 ID 列表，按创建时间倒序
func (r *AvatarHistoryRepository) ListByUserID(userID uint) ([]models.UserAvatarHistory, error) {
	var list []models.UserAvatarHistory
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&list).Error
	return list, err
}

// GetByID 按主键查询（并校验 user_id）
func (r *AvatarHistoryRepository) GetByID(id uint, userID uint) (*models.UserAvatarHistory, error) {
	var m models.UserAvatarHistory
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// Delete 软删除
func (r *AvatarHistoryRepository) Delete(id uint, userID uint) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.UserAvatarHistory{}).Error
}
