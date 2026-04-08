package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	notificationModels "yaolight-workshop/backend/modules/notification/models"
	"yaolight-workshop/backend/modules/notification/repositories"
	userModels "yaolight-workshop/backend/modules/user/models"
)

var (
	ErrAdminNotificationNoRecipients        = errors.New("recipient_ids is required")
	ErrAdminNotificationTitleRequired       = errors.New("title is required")
	ErrAdminNotificationTitleTooLong        = errors.New("title is too long")
	ErrAdminNotificationTooManyTargets      = errors.New("too many recipients in one request")
	ErrAdminNotificationInvalidExpiry       = errors.New("expires_at must be in the future")
	ErrAdminNotificationTemplateNotFound    = errors.New("template not found")
	ErrAdminNotificationTemplateNameMissing = errors.New("template name is required")
	ErrAdminNotificationTemplateTitleMiss   = errors.New("title template is required")
	ErrAdminNotificationInvalidTemplateVars = errors.New("template_variables must be a valid object")
)

const (
	adminNotificationDefaultType     = "admin_message"
	adminNotificationDefaultCategory = "platform"
	adminNotificationMaxRecipients   = 200
	adminNotificationExpiryLeadDays  = 7
)

var templateTokenPattern = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}`)

type AdminNotificationListParams struct {
	Page     int
	PageSize int
	Keyword  string
	Type     string
	Category string
	UserID   *uint
	IsRead   *bool
}

type AdminNotificationSendInput struct {
	OperatorID        uint
	Name              *string
	RecipientIDs      []uint
	TemplateID        *uint
	TemplateVariables map[string]string
	Title             string
	Content           *string
	Type              string
	Category          *string
	ActionURL         *string
	ExpiresAt         *time.Time
}

type AdminNotificationSendResult struct {
	SendJobID    uint       `json:"send_job_id"`
	SentCount    int        `json:"sent_count"`
	FailedCount  int        `json:"failed_count"`
	RecipientIDs []uint     `json:"recipient_ids"`
	Type         string     `json:"type"`
	Category     *string    `json:"category,omitempty"`
	ActionURL    *string    `json:"action_url,omitempty"`
	TemplateID   *uint      `json:"template_id,omitempty"`
	TemplateName *string    `json:"template_name,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	RequestedAt  time.Time  `json:"requested_at"`
	HasFailures  bool       `json:"has_failures"`
	JobStatus    string     `json:"job_status"`
}

type AdminNotificationSummary struct {
	TotalNotifications  int64   `json:"total_notifications"`
	ReadNotifications   int64   `json:"read_notifications"`
	UnreadNotifications int64   `json:"unread_notifications"`
	ExpiringSoon        int64   `json:"expiring_soon"`
	DistinctUsers       int64   `json:"distinct_users"`
	TotalJobs           int64   `json:"total_jobs"`
	FailedDeliveries    int64   `json:"failed_deliveries"`
	ActiveTemplates     int64   `json:"active_templates"`
	ReadRate            float64 `json:"read_rate"`
}

type AdminNotificationJobListParams struct {
	Page       int
	PageSize   int
	Keyword    string
	Status     string
	TemplateID *uint
}

type AdminNotificationJobListItem struct {
	ID                  uint       `json:"id"`
	Name                *string    `json:"name"`
	Channel             string     `json:"channel"`
	Type                string     `json:"type"`
	Category            *string    `json:"category"`
	Status              string     `json:"status"`
	TemplateID          *uint      `json:"template_id"`
	TemplateName        *string    `json:"template_name"`
	RequestedBy         uint       `json:"requested_by"`
	RequestedByUsername *string    `json:"requested_by_username"`
	RecipientCount      int        `json:"recipient_count"`
	SuccessCount        int        `json:"success_count"`
	FailedCount         int        `json:"failed_count"`
	ReadCount           int64      `json:"read_count"`
	ReadRate            float64    `json:"read_rate"`
	Title               string     `json:"title"`
	CreatedAt           time.Time  `json:"created_at"`
	FinishedAt          *time.Time `json:"finished_at"`
}

type AdminNotificationDeliveryListParams struct {
	SendJobID uint
	Status    string
	Page      int
	PageSize  int
}

type AdminNotificationDeliveryItem struct {
	ID               uint       `json:"id"`
	SendJobID        uint       `json:"send_job_id"`
	NotificationID   *uint      `json:"notification_id"`
	UserID           uint       `json:"user_id"`
	UsernameSnapshot *string    `json:"username_snapshot"`
	EmailSnapshot    *string    `json:"email_snapshot"`
	Status           string     `json:"status"`
	FailureReason    *string    `json:"failure_reason"`
	SentAt           *time.Time `json:"sent_at"`
	ReadAt           *time.Time `json:"read_at"`
	CreatedAt        time.Time  `json:"created_at"`
}

type AdminNotificationTemplateListParams struct {
	Page     int
	PageSize int
	Keyword  string
	IsActive *bool
}

type AdminNotificationTemplateListItem struct {
	ID                uint      `json:"id"`
	Name              string    `json:"name"`
	Description       *string   `json:"description"`
	Type              string    `json:"type"`
	Category          *string   `json:"category"`
	TitleTemplate     string    `json:"title_template"`
	ContentTemplate   *string   `json:"content_template"`
	ActionURLTemplate *string   `json:"action_url_template"`
	IsActive          bool      `json:"is_active"`
	CreatedBy         uint      `json:"created_by"`
	CreatedByUsername *string   `json:"created_by_username"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type AdminNotificationTemplatePayload struct {
	Name              string  `json:"name"`
	Description       *string `json:"description"`
	Type              string  `json:"type"`
	Category          *string `json:"category"`
	TitleTemplate     string  `json:"title_template"`
	ContentTemplate   *string `json:"content_template"`
	ActionURLTemplate *string `json:"action_url_template"`
	IsActive          bool    `json:"is_active"`
}

type AdminNotificationAnalytics struct {
	Overview            AdminNotificationSummary                `json:"overview"`
	JobStatusBreakdown  []AdminNotificationStatusCount          `json:"job_status_breakdown"`
	TemplatePerformance []AdminNotificationTemplatePerformance  `json:"template_performance"`
	FailureReasons      []AdminNotificationFailureReasonSummary `json:"failure_reasons"`
}

type AdminNotificationStatusCount struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

type AdminNotificationTemplatePerformance struct {
	TemplateID    uint    `json:"template_id"`
	TemplateName  string  `json:"template_name"`
	JobCount      int64   `json:"job_count"`
	DeliveryCount int64   `json:"delivery_count"`
	FailedCount   int64   `json:"failed_count"`
	ReadCount     int64   `json:"read_count"`
	ReadRate      float64 `json:"read_rate"`
}

type AdminNotificationFailureReasonSummary struct {
	Reason string `json:"reason"`
	Count  int64  `json:"count"`
}

type AdminNotificationService struct {
	db     *gorm.DB
	repo   repositories.NotificationRepository
	sender *NotificationService
}

func NewAdminNotificationService(db *gorm.DB, repo repositories.NotificationRepository, sender *NotificationService) *AdminNotificationService {
	return &AdminNotificationService{db: db, repo: repo, sender: sender}
}

func (s *AdminNotificationService) GetSummary() (*AdminNotificationSummary, error) {
	summary := &AdminNotificationSummary{}

	if err := s.db.Model(&notificationModels.Notification{}).Count(&summary.TotalNotifications).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&notificationModels.Notification{}).Where("is_read = ?", true).Count(&summary.ReadNotifications).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&notificationModels.Notification{}).Where("is_read = ?", false).Count(&summary.UnreadNotifications).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&notificationModels.Notification{}).Distinct("user_id").Count(&summary.DistinctUsers).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&notificationModels.NotificationSendJob{}).Count(&summary.TotalJobs).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&notificationModels.NotificationDelivery{}).Where("status = ?", "failed").Count(&summary.FailedDeliveries).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&notificationModels.NotificationTemplate{}).Where("is_active = ?", true).Count(&summary.ActiveTemplates).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	deadline := now.AddDate(0, 0, adminNotificationExpiryLeadDays)
	if err := s.db.Model(&notificationModels.Notification{}).
		Where("expires_at IS NOT NULL").
		Where("expires_at > ? AND expires_at <= ?", now, deadline).
		Count(&summary.ExpiringSoon).Error; err != nil {
		return nil, err
	}

	var totalSent int64
	if err := s.db.Model(&notificationModels.NotificationDelivery{}).Where("status = ?", "sent").Count(&totalSent).Error; err != nil {
		return nil, err
	}
	if totalSent > 0 {
		var readCount int64
		if err := s.db.Table("notification_deliveries").
			Joins("LEFT JOIN notifications ON notifications.id = notification_deliveries.notification_id").
			Where("notification_deliveries.status = ?", "sent").
			Where("notifications.is_read = ?", true).
			Count(&readCount).Error; err != nil {
			return nil, err
		}
		summary.ReadRate = float64(readCount) * 100 / float64(totalSent)
	}

	return summary, nil
}

func (s *AdminNotificationService) List(params AdminNotificationListParams) ([]repositories.AdminNotificationRecord, int64, error) {
	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	return s.repo.AdminList(repositories.AdminNotificationQuery{
		Page:     page,
		PageSize: pageSize,
		Keyword:  strings.TrimSpace(params.Keyword),
		Type:     strings.TrimSpace(params.Type),
		Category: strings.TrimSpace(params.Category),
		UserID:   params.UserID,
		IsRead:   params.IsRead,
	})
}

func (s *AdminNotificationService) ListJobs(params AdminNotificationJobListParams) ([]AdminNotificationJobListItem, int64, error) {
	page, pageSize := normalizeAdminPage(params.Page, params.PageSize, 20)

	base := s.db.Model(&notificationModels.NotificationSendJob{})
	keyword := strings.TrimSpace(params.Keyword)
	if keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		base = base.Where("LOWER(title) LIKE ? OR LOWER(COALESCE(name, '')) LIKE ?", like, like)
	}
	if params.Status != "" {
		base = base.Where("status = ?", params.Status)
	}
	if params.TemplateID != nil {
		base = base.Where("template_id = ?", *params.TemplateID)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	type row struct {
		notificationModels.NotificationSendJob
		TemplateName        *string `json:"template_name"`
		RequestedByUsername *string `json:"requested_by_username"`
		ReadCount           int64   `json:"read_count"`
	}

	var rows []row
	statsSubquery := s.db.Table("notification_deliveries").
		Select("notification_deliveries.send_job_id, COUNT(*) FILTER (WHERE notifications.is_read = true) AS read_count").
		Joins("LEFT JOIN notifications ON notifications.id = notification_deliveries.notification_id").
		Where("notification_deliveries.deleted_at IS NULL").
		Group("notification_deliveries.send_job_id")

	err := base.Table("notification_send_jobs").
		Select("notification_send_jobs.*, notification_templates.name AS template_name, users.username AS requested_by_username, COALESCE(delivery_stats.read_count, 0) AS read_count").
		Joins("LEFT JOIN notification_templates ON notification_templates.id = notification_send_jobs.template_id").
		Joins("LEFT JOIN users ON users.id = notification_send_jobs.requested_by").
		Joins("LEFT JOIN (?) AS delivery_stats ON delivery_stats.send_job_id = notification_send_jobs.id", statsSubquery).
		Order("notification_send_jobs.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}

	items := make([]AdminNotificationJobListItem, 0, len(rows))
	for _, item := range rows {
		readRate := 0.0
		if item.SuccessCount > 0 {
			readRate = float64(item.ReadCount) * 100 / float64(item.SuccessCount)
		}
		items = append(items, AdminNotificationJobListItem{
			ID:                  item.ID,
			Name:                item.Name,
			Channel:             item.Channel,
			Type:                item.Type,
			Category:            item.Category,
			Status:              item.Status,
			TemplateID:          item.TemplateID,
			TemplateName:        item.TemplateName,
			RequestedBy:         item.RequestedBy,
			RequestedByUsername: item.RequestedByUsername,
			RecipientCount:      item.RecipientCount,
			SuccessCount:        item.SuccessCount,
			FailedCount:         item.FailedCount,
			ReadCount:           item.ReadCount,
			ReadRate:            readRate,
			Title:               item.Title,
			CreatedAt:           item.CreatedAt,
			FinishedAt:          item.FinishedAt,
		})
	}

	return items, total, nil
}

func (s *AdminNotificationService) ListDeliveries(params AdminNotificationDeliveryListParams) ([]AdminNotificationDeliveryItem, int64, error) {
	page, pageSize := normalizeAdminPage(params.Page, params.PageSize, 20)
	base := s.db.Model(&notificationModels.NotificationDelivery{}).Where("send_job_id = ?", params.SendJobID)
	if params.Status != "" {
		base = base.Where("status = ?", params.Status)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []AdminNotificationDeliveryItem
	err := base.Table("notification_deliveries").
		Select("notification_deliveries.*, notifications.read_at AS read_at").
		Joins("LEFT JOIN notifications ON notifications.id = notification_deliveries.notification_id").
		Order("notification_deliveries.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&items).Error
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (s *AdminNotificationService) ListTemplates(params AdminNotificationTemplateListParams) ([]AdminNotificationTemplateListItem, int64, error) {
	page, pageSize := normalizeAdminPage(params.Page, params.PageSize, 20)
	base := s.db.Model(&notificationModels.NotificationTemplate{})
	if params.Keyword != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(params.Keyword)) + "%"
		base = base.Where("LOWER(name) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?", like, like)
	}
	if params.IsActive != nil {
		base = base.Where("is_active = ?", *params.IsActive)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []AdminNotificationTemplateListItem
	err := base.Table("notification_templates").
		Select("notification_templates.*, users.username AS created_by_username").
		Joins("LEFT JOIN users ON users.id = notification_templates.created_by").
		Order("notification_templates.updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&items).Error
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (s *AdminNotificationService) CreateTemplate(operatorID uint, payload AdminNotificationTemplatePayload) (*notificationModels.NotificationTemplate, error) {
	if err := validateTemplatePayload(payload); err != nil {
		return nil, err
	}

	row := &notificationModels.NotificationTemplate{
		Name:              strings.TrimSpace(payload.Name),
		Description:       normalizeOptionalString(payload.Description),
		Type:              defaultType(payload.Type),
		Category:          normalizeCategory(payload.Category),
		TitleTemplate:     strings.TrimSpace(payload.TitleTemplate),
		ContentTemplate:   normalizeOptionalString(payload.ContentTemplate),
		ActionURLTemplate: normalizeOptionalString(payload.ActionURLTemplate),
		IsActive:          payload.IsActive,
		CreatedBy:         operatorID,
		UpdatedBy:         &operatorID,
	}
	if err := s.db.Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

func (s *AdminNotificationService) UpdateTemplate(operatorID, templateID uint, payload AdminNotificationTemplatePayload) (*notificationModels.NotificationTemplate, error) {
	if err := validateTemplatePayload(payload); err != nil {
		return nil, err
	}

	var row notificationModels.NotificationTemplate
	if err := s.db.First(&row, templateID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAdminNotificationTemplateNotFound
		}
		return nil, err
	}

	row.Name = strings.TrimSpace(payload.Name)
	row.Description = normalizeOptionalString(payload.Description)
	row.Type = defaultType(payload.Type)
	row.Category = normalizeCategory(payload.Category)
	row.TitleTemplate = strings.TrimSpace(payload.TitleTemplate)
	row.ContentTemplate = normalizeOptionalString(payload.ContentTemplate)
	row.ActionURLTemplate = normalizeOptionalString(payload.ActionURLTemplate)
	row.IsActive = payload.IsActive
	row.UpdatedBy = &operatorID

	if err := s.db.Save(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *AdminNotificationService) GetAnalytics() (*AdminNotificationAnalytics, error) {
	overview, err := s.GetSummary()
	if err != nil {
		return nil, err
	}

	analytics := &AdminNotificationAnalytics{Overview: *overview}

	if err := s.db.Model(&notificationModels.NotificationSendJob{}).
		Select("status, COUNT(*) AS count").
		Group("status").
		Order("count DESC").
		Scan(&analytics.JobStatusBreakdown).Error; err != nil {
		return nil, err
	}

	if err := s.db.Table("notification_templates").
		Select(`
			notification_templates.id AS template_id,
			notification_templates.name AS template_name,
			COUNT(DISTINCT notification_send_jobs.id) AS job_count,
			COUNT(notification_deliveries.id) AS delivery_count,
			COUNT(*) FILTER (WHERE notification_deliveries.status = 'failed') AS failed_count,
			COUNT(*) FILTER (WHERE notifications.is_read = true) AS read_count
		`).
		Joins("LEFT JOIN notification_send_jobs ON notification_send_jobs.template_id = notification_templates.id").
		Joins("LEFT JOIN notification_deliveries ON notification_deliveries.send_job_id = notification_send_jobs.id").
		Joins("LEFT JOIN notifications ON notifications.id = notification_deliveries.notification_id").
		Where("notification_templates.deleted_at IS NULL").
		Group("notification_templates.id, notification_templates.name").
		Order("delivery_count DESC, job_count DESC").
		Limit(10).
		Scan(&analytics.TemplatePerformance).Error; err != nil {
		return nil, err
	}
	for i := range analytics.TemplatePerformance {
		if analytics.TemplatePerformance[i].DeliveryCount > 0 {
			analytics.TemplatePerformance[i].ReadRate =
				float64(analytics.TemplatePerformance[i].ReadCount) * 100 / float64(analytics.TemplatePerformance[i].DeliveryCount)
		}
	}

	if err := s.db.Model(&notificationModels.NotificationDelivery{}).
		Select("COALESCE(failure_reason, 'unknown') AS reason, COUNT(*) AS count").
		Where("status = ?", "failed").
		Group("COALESCE(failure_reason, 'unknown')").
		Order("count DESC").
		Limit(10).
		Scan(&analytics.FailureReasons).Error; err != nil {
		return nil, err
	}

	return analytics, nil
}

func (s *AdminNotificationService) Send(input AdminNotificationSendInput) (*AdminNotificationSendResult, error) {
	if s.sender == nil {
		return nil, fmt.Errorf("notification sender is not configured")
	}

	recipientIDs := normalizeRecipientIDs(input.RecipientIDs)
	if len(recipientIDs) == 0 {
		return nil, ErrAdminNotificationNoRecipients
	}
	if len(recipientIDs) > adminNotificationMaxRecipients {
		return nil, ErrAdminNotificationTooManyTargets
	}
	if input.ExpiresAt != nil && !input.ExpiresAt.After(time.Now()) {
		return nil, ErrAdminNotificationInvalidExpiry
	}

	var (
		template     *notificationModels.NotificationTemplate
		templateName *string
	)
	if input.TemplateID != nil {
		var row notificationModels.NotificationTemplate
		if err := s.db.Where("id = ? AND is_active = ?", *input.TemplateID, true).First(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrAdminNotificationTemplateNotFound
			}
			return nil, err
		}
		template = &row
		templateName = &row.Name
	}

	resolvedType := defaultType(input.Type)
	resolvedCategory := normalizeCategory(input.Category)
	title := strings.TrimSpace(input.Title)
	content := normalizeOptionalString(input.Content)
	actionURL := normalizeOptionalString(input.ActionURL)

	if template != nil {
		resolvedType = defaultType(template.Type)
		if template.Category != nil {
			copyCategory := strings.TrimSpace(*template.Category)
			resolvedCategory = &copyCategory
		}
	}

	if template == nil {
		if title == "" {
			return nil, ErrAdminNotificationTitleRequired
		}
		if len([]rune(title)) > 200 {
			return nil, ErrAdminNotificationTitleTooLong
		}
	}

	recipients, err := s.repo.ListUsersByIDs(recipientIDs)
	if err != nil {
		return nil, err
	}
	recipientMap := make(map[uint]userModels.User, len(recipients))
	for _, recipient := range recipients {
		recipientMap[recipient.ID] = recipient
	}

	requestedAt := time.Now()
	metadata := &shared.JSONB{
		Data: map[string]interface{}{
			"source":             "admin_console",
			"operator_id":        input.OperatorID,
			"template_variables": input.TemplateVariables,
		},
	}

	jobStatus := "processing"
	job := &notificationModels.NotificationSendJob{
		Name:           normalizeOptionalString(input.Name),
		Channel:        "in_app",
		Type:           resolvedType,
		Category:       resolvedCategory,
		Status:         jobStatus,
		TemplateID:     input.TemplateID,
		RequestedBy:    input.OperatorID,
		RecipientCount: len(recipientIDs),
		Title:          fallbackString(title, "Template send"),
		Content:        content,
		ActionURL:      actionURL,
		ExpiresAt:      input.ExpiresAt,
		StartedAt:      &requestedAt,
		Metadata:       metadata,
	}
	if template != nil {
		job.Title = template.TitleTemplate
		job.Content = template.ContentTemplate
		job.ActionURL = template.ActionURLTemplate
	}
	if err := s.db.Create(job).Error; err != nil {
		return nil, err
	}

	successCount := 0
	failedCount := 0
	for _, requestedUserID := range recipientIDs {
		recipient, exists := recipientMap[requestedUserID]
		if !exists {
			failedCount++
			_, _ = s.createFailedDelivery(job.ID, input.TemplateID, requestedUserID, nil, nil, "user not found")
			continue
		}
		if recipient.Status != "active" {
			failedCount++
			_, _ = s.createFailedDelivery(job.ID, input.TemplateID, recipient.ID, &recipient.Username, &recipient.Email, fmt.Sprintf("user status is %s", recipient.Status))
			continue
		}

		renderedTitle := title
		renderedContent := content
		renderedActionURL := actionURL
		if template != nil {
			values := buildTemplateValues(recipient, input.TemplateVariables)
			renderedTitle = renderTemplate(template.TitleTemplate, values)
			if len([]rune(renderedTitle)) > 200 {
				renderedTitle = string([]rune(renderedTitle)[:200])
			}
			renderedContent = renderOptionalTemplate(template.ContentTemplate, values)
			renderedActionURL = renderOptionalTemplate(template.ActionURLTemplate, values)
		}

		notificationMetadata := &shared.JSONB{
			Data: map[string]interface{}{
				"source":          "admin_console",
				"send_job_id":     job.ID,
				"template_id":     input.TemplateID,
				"operator_id":     input.OperatorID,
				"requested_at":    requestedAt.Format(time.RFC3339),
				"template_values": buildTemplateValues(recipient, input.TemplateVariables),
			},
		}

		createdNotification, createErr := s.sender.CreateAndNotify(CreateAndNotifyInput{
			UserID:    recipient.ID,
			Type:      resolvedType,
			Category:  resolvedCategory,
			Title:     renderedTitle,
			Content:   renderedContent,
			ActionURL: renderedActionURL,
			Metadata:  notificationMetadata,
			ExpiresAt: input.ExpiresAt,
		})
		if createErr != nil {
			failedCount++
			_, _ = s.createFailedDelivery(job.ID, input.TemplateID, recipient.ID, &recipient.Username, &recipient.Email, createErr.Error())
			continue
		}

		now := time.Now()
		delivery := &notificationModels.NotificationDelivery{
			SendJobID:        job.ID,
			NotificationID:   &createdNotification.ID,
			TemplateID:       input.TemplateID,
			UserID:           recipient.ID,
			UsernameSnapshot: &recipient.Username,
			EmailSnapshot:    &recipient.Email,
			Status:           "sent",
			SentAt:           &now,
		}
		if err := s.db.Create(delivery).Error; err != nil {
			failedCount++
			continue
		}
		successCount++
	}

	finishedAt := time.Now()
	job.SuccessCount = successCount
	job.FailedCount = failedCount
	job.FinishedAt = &finishedAt
	switch {
	case successCount > 0 && failedCount > 0:
		job.Status = "partial_failed"
	case successCount > 0:
		job.Status = "completed"
	default:
		job.Status = "failed"
	}
	if err := s.db.Save(job).Error; err != nil {
		return nil, err
	}

	return &AdminNotificationSendResult{
		SendJobID:    job.ID,
		SentCount:    successCount,
		FailedCount:  failedCount,
		RecipientIDs: recipientIDs,
		Type:         resolvedType,
		Category:     resolvedCategory,
		ActionURL:    job.ActionURL,
		TemplateID:   input.TemplateID,
		TemplateName: templateName,
		ExpiresAt:    input.ExpiresAt,
		RequestedAt:  requestedAt,
		HasFailures:  failedCount > 0,
		JobStatus:    job.Status,
	}, nil
}

func (s *AdminNotificationService) createFailedDelivery(sendJobID uint, templateID *uint, userID uint, username, email *string, reason string) (*notificationModels.NotificationDelivery, error) {
	row := &notificationModels.NotificationDelivery{
		SendJobID:        sendJobID,
		TemplateID:       templateID,
		UserID:           userID,
		UsernameSnapshot: username,
		EmailSnapshot:    email,
		Status:           "failed",
		FailureReason:    shared.Ptr(reason),
	}
	if err := s.db.Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

func validateTemplatePayload(payload AdminNotificationTemplatePayload) error {
	if strings.TrimSpace(payload.Name) == "" {
		return ErrAdminNotificationTemplateNameMissing
	}
	if strings.TrimSpace(payload.TitleTemplate) == "" {
		return ErrAdminNotificationTemplateTitleMiss
	}
	return nil
}

func normalizeAdminPage(page, pageSize, fallback int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = fallback
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func normalizeRecipientIDs(ids []uint) []uint {
	if len(ids) == 0 {
		return nil
	}
	seen := make(map[uint]struct{}, len(ids))
	result := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeCategory(value *string) *string {
	normalized := normalizeOptionalString(value)
	if normalized == nil {
		defaultCategory := adminNotificationDefaultCategory
		return &defaultCategory
	}
	return normalized
}

func defaultType(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return adminNotificationDefaultType
	}
	return trimmed
}

func buildTemplateValues(user userModels.User, custom map[string]string) map[string]string {
	values := map[string]string{
		"user.id":       fmt.Sprintf("%d", user.ID),
		"user.username": user.Username,
		"user.email":    user.Email,
		"user.user_no":  fmt.Sprintf("%d", user.UserNo),
	}
	for key, value := range custom {
		values[key] = value
	}
	return values
}

func renderTemplate(source string, values map[string]string) string {
	return templateTokenPattern.ReplaceAllStringFunc(source, func(match string) string {
		submatches := templateTokenPattern.FindStringSubmatch(match)
		if len(submatches) != 2 {
			return match
		}
		if value, exists := values[submatches[1]]; exists {
			return value
		}
		return ""
	})
}

func renderOptionalTemplate(source *string, values map[string]string) *string {
	if source == nil {
		return nil
	}
	rendered := strings.TrimSpace(renderTemplate(*source, values))
	if rendered == "" {
		return nil
	}
	return &rendered
}

func fallbackString(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func DecodeTemplateVariables(raw json.RawMessage) (map[string]string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return map[string]string{}, nil
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, ErrAdminNotificationInvalidTemplateVars
	}

	result := make(map[string]string, len(payload))
	for key, value := range payload {
		result[key] = fmt.Sprintf("%v", value)
	}
	return result, nil
}
