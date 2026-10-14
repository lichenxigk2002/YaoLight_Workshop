package services

import (
	"fmt"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	notification "yaolight-workshop/backend/modules/notification"
	notificationModels "yaolight-workshop/backend/modules/notification/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

const (
	workflowTemplateConsentStatusNotRequired  = "not_required"
	workflowTemplateConsentStatusNotRequested = "not_requested"
	workflowTemplateConsentStatusPending      = "pending"
	workflowTemplateConsentStatusAgreed       = "agreed"
	workflowTemplateConsentStatusRejected     = "rejected"

	workflowTemplateConsentRequestType         = "workflow_template_consent_request"
	workflowTemplateConsentRelatedResourceType = "workflow_template"
)

func buildWorkflowTemplateConsentStatus(hasSource bool, consent *workflowModels.WorkflowTemplateConsent) string {
	if !hasSource {
		return workflowTemplateConsentStatusNotRequired
	}
	if consent == nil {
		return workflowTemplateConsentStatusNotRequested
	}
	return consent.Status
}

func (s *AdminWorkflowTemplateService) loadConsentMapForPairs(db *gorm.DB, templateSourcePairs map[uint]uint) (map[uint]*workflowModels.WorkflowTemplateConsent, error) {
	result := make(map[uint]*workflowModels.WorkflowTemplateConsent)
	if len(templateSourcePairs) == 0 {
		return result, nil
	}

	templateIDs := make([]uint, 0, len(templateSourcePairs))
	for templateID := range templateSourcePairs {
		templateIDs = append(templateIDs, templateID)
	}

	var consents []workflowModels.WorkflowTemplateConsent
	if err := db.
		Where("template_id IN ?", templateIDs).
		Order("template_id ASC").
		Order("updated_at DESC").
		Order("created_at DESC").
		Find(&consents).Error; err != nil {
		return nil, err
	}

	for i := range consents {
		consent := consents[i]
		sourceWorkflowID, exists := templateSourcePairs[consent.TemplateID]
		if !exists || consent.SourceWorkflowID != sourceWorkflowID {
			continue
		}
		if _, exists := result[consent.TemplateID]; exists {
			continue
		}
		result[consent.TemplateID] = &consent
	}

	return result, nil
}

func (s *AdminWorkflowTemplateService) findTemplateConsent(db *gorm.DB, templateID uint, sourceWorkflowID uint) (*workflowModels.WorkflowTemplateConsent, error) {
	var consent workflowModels.WorkflowTemplateConsent
	if err := db.
		Where("template_id = ? AND source_workflow_id = ?", templateID, sourceWorkflowID).
		First(&consent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &consent, nil
}

func (s *AdminWorkflowTemplateService) applyPublishConsent(tx *gorm.DB, workflow *workflowModels.Workflow, source *workflowModels.Workflow) (*notificationModels.Notification, error) {
	consent, err := s.findTemplateConsent(tx, workflow.ID, source.ID)
	if err != nil {
		return nil, err
	}

	if consent != nil {
		switch consent.Status {
		case workflowTemplateConsentStatusAgreed:
			workflow.Status = "published"
			return nil, nil
		case workflowTemplateConsentStatusPending:
			return nil, nil
		}
	}

	return s.createOrRefreshConsentRequest(tx, workflow, source, consent)
}

func (s *AdminWorkflowTemplateService) createOrRefreshConsentRequest(
	tx *gorm.DB,
	workflow *workflowModels.Workflow,
	source *workflowModels.Workflow,
	consent *workflowModels.WorkflowTemplateConsent,
) (*notificationModels.Notification, error) {
	title := fmt.Sprintf("工作流模板发布确认：%s", workflow.Name)
	content := fmt.Sprintf("平台希望将您的工作流《%s》作为公开模板《%s》发布。请确认是否同意。", source.Name, workflow.Name)
	metadata := &shared.JSONB{
		Data: map[string]interface{}{
			"template_id":          workflow.ID,
			"template_name":        workflow.Name,
			"source_workflow_id":   source.ID,
			"source_workflow_name": source.Name,
			"consent_status":       workflowTemplateConsentStatusPending,
		},
	}
	relatedResourceType := workflowTemplateConsentRelatedResourceType
	relatedResourceID := workflow.ID

	notificationRow := &notificationModels.Notification{
		UserID:              source.UserID,
		Type:                workflowTemplateConsentRequestType,
		Title:               title,
		Content:             &content,
		RelatedResourceType: &relatedResourceType,
		RelatedResourceID:   &relatedResourceID,
		Metadata:            metadata,
	}
	if err := tx.Create(notificationRow).Error; err != nil {
		return nil, err
	}

	if consent == nil {
		consent = &workflowModels.WorkflowTemplateConsent{
			TemplateID:        workflow.ID,
			SourceWorkflowID:  source.ID,
			SourceOwnerUserID: source.UserID,
		}
	}

	consent.SourceOwnerUserID = source.UserID
	consent.Status = workflowTemplateConsentStatusPending
	consent.NotificationID = &notificationRow.ID
	consent.RespondedAt = nil

	if consent.ID == 0 {
		if err := tx.Create(consent).Error; err != nil {
			return nil, err
		}
	} else if err := tx.Save(consent).Error; err != nil {
		return nil, err
	}

	return notificationRow, nil
}

func (s *AdminWorkflowTemplateService) pushNotification(notificationRow *notificationModels.Notification) {
	if notificationRow == nil || notification.DefaultService == nil {
		return
	}
	notification.DefaultService.PushNotification(notificationRow)
}

func cloneJSONBMap(value *shared.JSONB) map[string]interface{} {
	if value == nil || value.Data == nil {
		return make(map[string]interface{})
	}
	if data, ok := value.Data.(map[string]interface{}); ok {
		cloned := make(map[string]interface{}, len(data))
		for key, item := range data {
			cloned[key] = item
		}
		return cloned
	}
	return make(map[string]interface{})
}

func updateConsentMetadataStatus(value *shared.JSONB, status string) *shared.JSONB {
	metadata := cloneJSONBMap(value)
	metadata["consent_status"] = status
	return &shared.JSONB{Data: metadata}
}
