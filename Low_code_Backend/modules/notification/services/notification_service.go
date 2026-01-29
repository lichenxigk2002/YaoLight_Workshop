package services

import (
	"yaolight-workshop/backend/modules/notification/hub"
	"yaolight-workshop/backend/modules/notification/models"
	"yaolight-workshop/backend/modules/notification/repositories"
)

// NotificationService 通知服务：供其他业务调用，创建通知并实时推送
type NotificationService struct {
	repo repositories.NotificationRepository
	h    *hub.Hub
}

// NewNotificationService 创建通知服务（需传入已创建的 Hub 单例）
func NewNotificationService(repo repositories.NotificationRepository, h *hub.Hub) *NotificationService {
	return &NotificationService{repo: repo, h: h}
}

// CreateAndNotifyInput 创建并推送通知的入参
type CreateAndNotifyInput struct {
	UserID    uint
	Type      string  // 业务类型，如 task_completed, payment_success
	Title     string
	Content   *string
	ActionURL *string // 可选，点击跳转的页面路径，如 /projects/1/workflows/2/edit
}

// CreateAndNotify 创建一条通知并写入数据库，同时通过 WebSocket 推送给对应用户
// 其他模块（如任务完成、支付成功）只需调用此方法即可完成站内通知
func (s *NotificationService) CreateAndNotify(in CreateAndNotifyInput) (*models.Notification, error) {
	n := &models.Notification{
		UserID:    in.UserID,
		Type:      in.Type,
		Title:     in.Title,
		Content:   in.Content,
		ActionURL: in.ActionURL,
	}
	if err := s.repo.Create(n); err != nil {
		return nil, err
	}
	// 实时推送给该用户的所有在线连接
	s.h.SendToUser(in.UserID, map[string]interface{}{
		"event": "notification",
		"data":  n,
	})
	return n, nil
}

// List 分页查询当前用户的通知列表
func (s *NotificationService) List(userID uint, page, pageSize int) ([]models.Notification, int64, error) {
	return s.repo.ListByUserID(userID, page, pageSize)
}

// MarkRead 标记单条已读
func (s *NotificationService) MarkRead(id, userID uint) error {
	return s.repo.MarkRead(id, userID)
}

// MarkAllRead 全部标为已读
func (s *NotificationService) MarkAllRead(userID uint) error {
	return s.repo.MarkAllRead(userID)
}

// UnreadCount 未读数量
func (s *NotificationService) UnreadCount(userID uint) (int64, error) {
	return s.repo.CountUnread(userID)
}
