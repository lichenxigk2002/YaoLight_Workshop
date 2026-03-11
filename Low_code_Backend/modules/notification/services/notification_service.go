package services

import (
	"time"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/notification/hub"
	"yaolight-workshop/backend/modules/notification/models"
	"yaolight-workshop/backend/modules/notification/repositories"
)

// NotificationService creates notifications and pushes them to connected users.
type NotificationService struct {
	repo repositories.NotificationRepository
	h    *hub.Hub
}

func NewNotificationService(repo repositories.NotificationRepository, h *hub.Hub) *NotificationService {
	return &NotificationService{repo: repo, h: h}
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

	s.h.SendToUser(in.UserID, map[string]interface{}{
		"event": "notification",
		"data":  n,
	})
	return n, nil
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
