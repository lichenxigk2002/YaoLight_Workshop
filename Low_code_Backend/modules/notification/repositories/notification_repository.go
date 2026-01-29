package repositories

import (
	"time"

	"yaolight-workshop/backend/modules/notification/models"

	"gorm.io/gorm"
)

// NotificationRepository 通知仓储接口
type NotificationRepository interface {
	Create(n *models.Notification) error
	ListByUserID(userID uint, page, pageSize int) ([]models.Notification, int64, error)
	GetByID(id, userID uint) (*models.Notification, error)
	MarkRead(id, userID uint) error
	MarkAllRead(userID uint) error
	CountUnread(userID uint) (int64, error)
}

type notificationRepository struct {
	db *gorm.DB
}

// NewNotificationRepository 创建通知仓储实例
func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) Create(n *models.Notification) error {
	return r.db.Create(n).Error
}

func (r *notificationRepository) ListByUserID(userID uint, page, pageSize int) ([]models.Notification, int64, error) {
	var list []models.Notification
	var total int64
	q := r.db.Model(&models.Notification{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := r.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *notificationRepository) GetByID(id, userID uint) (*models.Notification, error) {
	var n models.Notification
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&n).Error
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *notificationRepository) MarkRead(id, userID uint) error {
	now := time.Now()
	return r.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}

func (r *notificationRepository) MarkAllRead(userID uint) error {
	now := time.Now()
	return r.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}

func (r *notificationRepository) CountUnread(userID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}
