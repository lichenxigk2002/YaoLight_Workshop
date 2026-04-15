package services

import (
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/notification/hub"
	"yaolight-workshop/backend/modules/notification/models"
	"yaolight-workshop/backend/modules/notification/repositories"
)

// NotificationService creates notifications and pushes them to connected users.
type NotificationService struct {
	repo repositories.NotificationRepository
	h    *hub.Hub
	db   *gorm.DB
}

func NewNotificationService(repo repositories.NotificationRepository, h *hub.Hub, db *gorm.DB) *NotificationService {
	return &NotificationService{repo: repo, h: h, db: db}
}

type CreateAndNotifyInput struct {
	UserID              uint
	Type                string
	Category            *string
	Title               string
	Content             *string
	ActionURL           *string
	RelatedResourceType *string
	RelatedResourceID   *uint
	Metadata            *shared.JSONB
	ExpiresAt           *time.Time
}

func (s *NotificationService) CreateAndNotify(in CreateAndNotifyInput) (*models.Notification, error) {
	n := &models.Notification{
		UserID:              in.UserID,
		Type:                in.Type,
		Category:            in.Category,
		Title:               in.Title,
		Content:             in.Content,
		ActionURL:           in.ActionURL,
		RelatedResourceType: in.RelatedResourceType,
		RelatedResourceID:   in.RelatedResourceID,
		Metadata:            in.Metadata,
		ExpiresAt:           in.ExpiresAt,
	}
	if err := s.repo.Create(n); err != nil {
		return nil, err
	}

	s.PushNotification(n)
	return n, nil
}

func (s *NotificationService) PushNotification(notification *models.Notification) {
	if s == nil || s.h == nil || notification == nil {
		return
	}

	s.h.SendToUser(notification.UserID, map[string]interface{}{
		"event": "notification",
		"data":  notification,
	})
}

func (s *NotificationService) List(userID uint, page, pageSize int) ([]models.Notification, int64, error) {
	return s.repo.ListByUserID(userID, page, pageSize)
}

func (s *NotificationService) MarkRead(id, userID uint) error {
	return s.repo.MarkRead(id, userID)
}

func (s *NotificationService) MarkAllRead(userID uint) error {
	return s.repo.MarkAllRead(userID)
}

func (s *NotificationService) UnreadCount(userID uint) (int64, error) {
	return s.repo.CountUnread(userID)
}
