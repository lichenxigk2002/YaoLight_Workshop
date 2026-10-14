package repositories

import (
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/modules/notification/models"
	userModels "yaolight-workshop/backend/modules/user/models"
)

type AdminNotificationQuery struct {
	Page     int
	PageSize int
	Keyword  string
	Type     string
	Category string
	UserID   *uint
	IsRead   *bool
}

type AdminNotificationRecord struct {
	models.Notification
	UserUsername string `json:"user_username"`
	UserEmail    string `json:"user_email"`
	UserNo       int64  `json:"user_no"`
}

type AdminNotificationSummary struct {
	Total         int64 `json:"total"`
	Read          int64 `json:"read"`
	Unread        int64 `json:"unread"`
	ExpiringSoon  int64 `json:"expiring_soon"`
	DistinctUsers int64 `json:"distinct_users"`
}

type NotificationRepository interface {
	Create(n *models.Notification) error
	ListByUserID(userID uint, page, pageSize int) ([]models.Notification, int64, error)
	GetByID(id, userID uint) (*models.Notification, error)
	MarkRead(id, userID uint) error
	MarkAllRead(userID uint) error
	Delete(id, userID uint) error
	CountUnread(userID uint) (int64, error)
	ListUsersByIDs(ids []uint) ([]userModels.User, error)
	AdminList(query AdminNotificationQuery) ([]AdminNotificationRecord, int64, error)
	AdminSummary(expiryLeadDays int) (*AdminNotificationSummary, error)
}

type notificationRepository struct {
	db *gorm.DB
}

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
		Offset(offset).
		Limit(pageSize).
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

func (r *notificationRepository) Delete(id, userID uint) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Notification{}).Error
}

func (r *notificationRepository) CountUnread(userID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}

func (r *notificationRepository) ListUsersByIDs(ids []uint) ([]userModels.User, error) {
	if len(ids) == 0 {
		return []userModels.User{}, nil
	}

	var users []userModels.User
	err := r.db.Model(&userModels.User{}).
		Select("id", "user_no", "username", "email", "status").
		Where("id IN ?", ids).
		Find(&users).Error
	return users, err
}

func (r *notificationRepository) AdminList(query AdminNotificationQuery) ([]AdminNotificationRecord, int64, error) {
	var (
		list  []AdminNotificationRecord
		total int64
	)

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	base := r.db.Table("notifications").
		Joins("LEFT JOIN users ON users.id = notifications.user_id")
	base = applyAdminNotificationFilters(base, query)

	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := base.Select(
		"notifications.*, users.username AS user_username, users.email AS user_email, users.user_no AS user_no",
	).
		Order("notifications.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&list).Error
	if err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *notificationRepository) AdminSummary(expiryLeadDays int) (*AdminNotificationSummary, error) {
	summary := &AdminNotificationSummary{}

	if err := r.db.Model(&models.Notification{}).Count(&summary.Total).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&models.Notification{}).Where("is_read = ?", true).Count(&summary.Read).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&models.Notification{}).Where("is_read = ?", false).Count(&summary.Unread).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&models.Notification{}).Distinct("user_id").Count(&summary.DistinctUsers).Error; err != nil {
		return nil, err
	}

	if expiryLeadDays > 0 {
		now := time.Now()
		deadline := now.AddDate(0, 0, expiryLeadDays)
		if err := r.db.Model(&models.Notification{}).
			Where("expires_at IS NOT NULL").
			Where("expires_at > ? AND expires_at <= ?", now, deadline).
			Count(&summary.ExpiringSoon).Error; err != nil {
			return nil, err
		}
	}

	return summary, nil
}

func applyAdminNotificationFilters(db *gorm.DB, query AdminNotificationQuery) *gorm.DB {
	if query.Keyword != "" {
		keyword := "%" + query.Keyword + "%"
		db = db.Where(
			"notifications.title ILIKE ? OR notifications.content ILIKE ? OR users.username ILIKE ? OR users.email ILIKE ?",
			keyword,
			keyword,
			keyword,
			keyword,
		)
	}

	if query.Type != "" {
		db = db.Where("notifications.type = ?", query.Type)
	}
	if query.Category != "" {
		db = db.Where("notifications.category = ?", query.Category)
	}
	if query.UserID != nil {
		db = db.Where("notifications.user_id = ?", *query.UserID)
	}
	if query.IsRead != nil {
		db = db.Where("notifications.is_read = ?", *query.IsRead)
	}

	return db
}
