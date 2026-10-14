package services

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	notificationModels "yaolight-workshop/backend/modules/notification/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

const workflowTemplateConsentRequestType = "workflow_template_consent_request"

var (
	ErrNotificationNotFound              = errors.New("notification not found")
	ErrNotificationConsentActionInvalid  = errors.New("invalid consent action")
	ErrNotificationConsentUnsupported    = errors.New("notification does not support consent action")
	ErrNotificationConsentNotFound       = errors.New("consent request not found")
	ErrNotificationConsentAlreadyHandled = errors.New("consent request has already been handled")
)

type NotificationConsentResult struct {
	Notification  *notificationModels.Notification `json:"notification"`
	ConsentStatus string                           `json:"consent_status"`
}

func (s *NotificationService) RespondWorkflowTemplateConsent(notificationID, userID uint, action string) (*NotificationConsentResult, error) {
	action = strings.TrimSpace(action)
	if action != "agree" && action != "reject" {
		return nil, ErrNotificationConsentActionInvalid
	}
	if s == nil || s.db == nil {
		return nil, errors.New("notification database is not configured")
	}

	result := &NotificationConsentResult{}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var notificationRow notificationModels.Notification
		if err := tx.Where("id = ? AND user_id = ?", notificationID, userID).First(&notificationRow).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotificationNotFound
			}
			return err
		}
		if notificationRow.Type != workflowTemplateConsentRequestType {
			return ErrNotificationConsentUnsupported
		}

		var consent workflowModels.WorkflowTemplateConsent
		if err := tx.Where("notification_id = ?", notificationID).First(&consent).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotificationConsentNotFound
			}
			return err
		}
		if consent.Status != "pending" {
			return ErrNotificationConsentAlreadyHandled
		}

		status := "agreed"
		if action == "reject" {
			status = "rejected"
		}
		now := time.Now()
		consent.Status = status
		consent.RespondedAt = &now
		if err := tx.Save(&consent).Error; err != nil {
			return err
		}

		metadata := cloneNotificationMetadata(notificationRow.Metadata)
		metadata["consent_status"] = status
		notificationRow.Metadata = &shared.JSONB{Data: metadata}
		notificationRow.IsRead = true
		notificationRow.ReadAt = &now
		if err := tx.Save(&notificationRow).Error; err != nil {
			return err
		}

		result.Notification = &notificationRow
		result.ConsentStatus = status
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func cloneNotificationMetadata(value *shared.JSONB) map[string]interface{} {
	if value == nil || value.Data == nil {
		return make(map[string]interface{})
	}
	if metadata, ok := value.Data.(map[string]interface{}); ok {
		cloned := make(map[string]interface{}, len(metadata))
		for key, item := range metadata {
			cloned[key] = item
		}
		return cloned
	}
	return make(map[string]interface{})
}
