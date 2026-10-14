package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
	alkaidTools "yaolight-workshop/backend/modules/alkaid/services/tools"
	projectModels "yaolight-workshop/backend/modules/project/models"
	projectSupport "yaolight-workshop/backend/modules/project/support"
)

var (
	ErrWebsiteSourceNotFound = errors.New("website source not found")
	ErrInvalidWebsiteSource  = errors.New("invalid website source")
)

type WebsiteSourcePayload struct {
	Name              string   `json:"name"`
	BaseURL           string   `json:"baseUrl"`
	EntryURL          string   `json:"entryUrl"`
	ListURLExamples   []string `json:"listUrlExamples"`
	DetailURLExamples []string `json:"detailUrlExamples"`
	AllowedPatterns   []string `json:"allowedPatterns"`
	BlockedPatterns   []string `json:"blockedPatterns"`
	CrawlTips         string   `json:"crawlTips"`
	AuthHint          string   `json:"authHint"`
	ContentHint       string   `json:"contentHint"`
	Tags              []string `json:"tags"`
	Status            string   `json:"status"`
}

type WebsiteSourceListQuery struct {
	Keyword  string
	Status   string
	Page     int
	PageSize int
}

type WebsiteSourceListItem struct {
	ID                uint     `json:"id"`
	ProjectID         uint     `json:"projectId"`
	Name              string   `json:"name"`
	BaseURL           string   `json:"baseUrl"`
	EntryURL          string   `json:"entryUrl,omitempty"`
	Tags              []string `json:"tags"`
	Status            string   `json:"status"`
	LastCheckedAt     *string  `json:"lastCheckedAt,omitempty"`
	LastCheckStatus   string   `json:"lastCheckStatus,omitempty"`
	LastCheckMessage  string   `json:"lastCheckMessage,omitempty"`
	ListURLExamples   []string `json:"listUrlExamples"`
	DetailURLExamples []string `json:"detailUrlExamples"`
	CreatedAt         string   `json:"createdAt"`
	UpdatedAt         string   `json:"updatedAt"`
}

type WebsiteSourceDetail struct {
	ID                uint     `json:"id"`
	ProjectID         uint     `json:"projectId"`
	Name              string   `json:"name"`
	BaseURL           string   `json:"baseUrl"`
	EntryURL          string   `json:"entryUrl,omitempty"`
	ListURLExamples   []string `json:"listUrlExamples"`
	DetailURLExamples []string `json:"detailUrlExamples"`
	AllowedPatterns   []string `json:"allowedPatterns"`
	BlockedPatterns   []string `json:"blockedPatterns"`
	CrawlTips         string   `json:"crawlTips,omitempty"`
	AuthHint          string   `json:"authHint,omitempty"`
	ContentHint       string   `json:"contentHint,omitempty"`
	Tags              []string `json:"tags"`
	Status            string   `json:"status"`
	LastCheckedAt     *string  `json:"lastCheckedAt,omitempty"`
	LastCheckStatus   string   `json:"lastCheckStatus,omitempty"`
	LastCheckMessage  string   `json:"lastCheckMessage,omitempty"`
	CreatedAt         string   `json:"createdAt"`
	UpdatedAt         string   `json:"updatedAt"`
}

type WebsiteSourceListResult struct {
	List     []WebsiteSourceListItem `json:"list"`
	Total    int64                   `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"pageSize"`
}

type WebsiteSourceCheckResult struct {
	ID        uint                   `json:"id"`
	CheckedAt string                 `json:"checkedAt"`
	Result    map[string]interface{} `json:"result"`
}

type ProjectWebsiteSourceService struct {
	db *gorm.DB
}

func NewProjectWebsiteSourceService(db *gorm.DB) *ProjectWebsiteSourceService {
	return &ProjectWebsiteSourceService{db: db}
}

func (s *ProjectWebsiteSourceService) ListSources(userID uint, projectID uint, query WebsiteSourceListQuery) (*WebsiteSourceListResult, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	db := s.db.Model(&projectModels.WebsiteSource{}).
		Where("user_id = ? AND project_id = ?", userID, projectID)

	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR base_url LIKE ? OR entry_url LIKE ? OR crawl_tips LIKE ?", pattern, pattern, pattern, pattern)
	}
	if status := strings.TrimSpace(query.Status); status != "" {
		db = db.Where("status = ?", status)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var items []projectModels.WebsiteSource
	if err := db.Order("updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	result := &WebsiteSourceListResult{
		List:     make([]WebsiteSourceListItem, 0, len(items)),
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}
	for _, item := range items {
		result.List = append(result.List, toWebsiteSourceListItem(item))
	}

	return result, nil
}

func (s *ProjectWebsiteSourceService) GetSource(userID uint, projectID uint, id uint) (*WebsiteSourceDetail, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	var item projectModels.WebsiteSource
	if err := s.db.Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWebsiteSourceNotFound
		}
		return nil, err
	}

	detail := toWebsiteSourceDetail(item)
	return &detail, nil
}

func (s *ProjectWebsiteSourceService) CreateSource(userID uint, projectID uint, payload *WebsiteSourcePayload) (*WebsiteSourceDetail, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	model, err := buildWebsiteSourceModel(userID, projectID, payload, nil)
	if err != nil {
		return nil, err
	}
	if err := s.db.Create(model).Error; err != nil {
		return nil, err
	}

	detail := toWebsiteSourceDetail(*model)
	return &detail, nil
}

func (s *ProjectWebsiteSourceService) UpdateSource(userID uint, projectID uint, id uint, payload *WebsiteSourcePayload) (*WebsiteSourceDetail, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	var existing projectModels.WebsiteSource
	if err := s.db.Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWebsiteSourceNotFound
		}
		return nil, err
	}

	model, err := buildWebsiteSourceModel(userID, projectID, payload, &existing)
	if err != nil {
		return nil, err
	}
	model.ID = existing.ID
	model.CreatedAt = existing.CreatedAt
	model.LastCheckedAt = existing.LastCheckedAt
	model.LastCheckStatus = existing.LastCheckStatus
	model.LastCheckMessage = existing.LastCheckMessage

	if err := s.db.Save(model).Error; err != nil {
		return nil, err
	}

	return s.GetSource(userID, projectID, id)
}

func (s *ProjectWebsiteSourceService) DeleteSource(userID uint, projectID uint, id uint) error {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return err
	}
	result := s.db.Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).Delete(&projectModels.WebsiteSource{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrWebsiteSourceNotFound
	}
	return nil
}

func (s *ProjectWebsiteSourceService) SetSourceStatus(userID uint, projectID uint, id uint, status string) error {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return err
	}
	status = normalizeWebsiteSourceStatus(status)
	result := s.db.Model(&projectModels.WebsiteSource{}).
		Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).
		Update("status", status)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrWebsiteSourceNotFound
	}
	return nil
}

func (s *ProjectWebsiteSourceService) CheckSource(userID uint, projectID uint, id uint) (*WebsiteSourceCheckResult, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	var item projectModels.WebsiteSource
	if err := s.db.Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWebsiteSourceNotFound
		}
		return nil, err
	}

	targetURL := strings.TrimSpace(item.BaseURL)
	if item.EntryURL != nil && strings.TrimSpace(*item.EntryURL) != "" {
		targetURL = strings.TrimSpace(*item.EntryURL)
	}
	if targetURL == "" {
		return nil, fmt.Errorf("%w: base url is required", ErrInvalidWebsiteSource)
	}

	report, err := alkaidTools.InspectURLAccessibility(targetURL, 8*time.Second, 64*1024)
	if err != nil {
		now := time.Now().UTC()
		status := "invalid"
		message := err.Error()
		updateErr := s.db.Model(&projectModels.WebsiteSource{}).
			Where("id = ?", item.ID).
			Updates(map[string]interface{}{
				"last_checked_at":    now,
				"last_check_status":  status,
				"last_check_message": message,
			}).Error
		if updateErr != nil {
			return nil, updateErr
		}
		return &WebsiteSourceCheckResult{
			ID:        item.ID,
			CheckedAt: now.Format(time.RFC3339),
			Result: map[string]interface{}{
				"url":     targetURL,
				"ok":      false,
				"reason":  message,
				"summary": message,
			},
		}, nil
	}

	now := time.Now().UTC()
	checkStatus := "invalid"
	if ok, _ := report["ok"].(bool); ok {
		checkStatus = "ok"
	}
	checkMessage, _ := report["reason"].(string)
	if err := s.db.Model(&projectModels.WebsiteSource{}).
		Where("id = ?", item.ID).
		Updates(map[string]interface{}{
			"last_checked_at":    now,
			"last_check_status":  checkStatus,
			"last_check_message": checkMessage,
		}).Error; err != nil {
		return nil, err
	}

	return &WebsiteSourceCheckResult{
		ID:        item.ID,
		CheckedAt: now.Format(time.RFC3339),
		Result:    report,
	}, nil
}

func buildWebsiteSourceModel(userID uint, projectID uint, payload *WebsiteSourcePayload, existing *projectModels.WebsiteSource) (*projectModels.WebsiteSource, error) {
	if payload == nil {
		return nil, fmt.Errorf("%w: payload is required", ErrInvalidWebsiteSource)
	}

	model := &projectModels.WebsiteSource{
		UserID:            userID,
		ProjectID:         projectID,
		Name:              strings.TrimSpace(payload.Name),
		BaseURL:           strings.TrimSpace(payload.BaseURL),
		ListURLExamples:   shared.JSONB{Data: sanitizeStringList(payload.ListURLExamples)},
		DetailURLExamples: shared.JSONB{Data: sanitizeStringList(payload.DetailURLExamples)},
		AllowedPatterns:   shared.JSONB{Data: sanitizeStringList(payload.AllowedPatterns)},
		BlockedPatterns:   shared.JSONB{Data: sanitizeStringList(payload.BlockedPatterns)},
		Tags:              shared.JSONB{Data: sanitizeStringList(payload.Tags)},
		Status:            normalizeWebsiteSourceStatus(payload.Status),
	}

	if trimmed := strings.TrimSpace(payload.EntryURL); trimmed != "" {
		model.EntryURL = &trimmed
	}
	if trimmed := strings.TrimSpace(payload.CrawlTips); trimmed != "" {
		model.CrawlTips = &trimmed
	}
	if trimmed := strings.TrimSpace(payload.AuthHint); trimmed != "" {
		model.AuthHint = &trimmed
	}
	if trimmed := strings.TrimSpace(payload.ContentHint); trimmed != "" {
		model.ContentHint = &trimmed
	}

	if existing != nil {
		model.LastCheckedAt = existing.LastCheckedAt
		model.LastCheckStatus = existing.LastCheckStatus
		model.LastCheckMessage = existing.LastCheckMessage
	}

	if err := validateWebsiteSourceModel(model); err != nil {
		return nil, err
	}
	return model, nil
}

func validateWebsiteSourceModel(model *projectModels.WebsiteSource) error {
	if model == nil {
		return fmt.Errorf("%w: model is nil", ErrInvalidWebsiteSource)
	}
	if model.Name == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidWebsiteSource)
	}
	if model.BaseURL == "" {
		return fmt.Errorf("%w: base url is required", ErrInvalidWebsiteSource)
	}
	if model.Status != "active" && model.Status != "disabled" && model.Status != "invalid" {
		return fmt.Errorf("%w: invalid status", ErrInvalidWebsiteSource)
	}
	return nil
}

func normalizeWebsiteSourceStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "disabled":
		return "disabled"
	case "invalid":
		return "invalid"
	default:
		return "active"
	}
}

func sanitizeStringList(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func normalizeJSONBStringList(value interface{}) []string {
	switch data := value.(type) {
	case []string:
		return sanitizeStringList(data)
	case []interface{}:
		items := make([]string, 0, len(data))
		for _, item := range data {
			if str, ok := item.(string); ok {
				items = append(items, str)
			}
		}
		return sanitizeStringList(items)
	default:
		return []string{}
	}
}

func formatOptionalTime(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.Format("2006-01-02 15:04:05")
	return &formatted
}

func toWebsiteSourceListItem(item projectModels.WebsiteSource) WebsiteSourceListItem {
	lastCheckedAt := formatOptionalTime(item.LastCheckedAt)
	lastCheckStatus := ""
	lastCheckMessage := ""
	if item.LastCheckStatus != nil {
		lastCheckStatus = *item.LastCheckStatus
	}
	if item.LastCheckMessage != nil {
		lastCheckMessage = *item.LastCheckMessage
	}
	entryURL := ""
	if item.EntryURL != nil {
		entryURL = *item.EntryURL
	}
	return WebsiteSourceListItem{
		ID:                item.ID,
		ProjectID:         item.ProjectID,
		Name:              item.Name,
		BaseURL:           item.BaseURL,
		EntryURL:          entryURL,
		Tags:              normalizeJSONBStringList(item.Tags.Data),
		Status:            item.Status,
		LastCheckedAt:     lastCheckedAt,
		LastCheckStatus:   lastCheckStatus,
		LastCheckMessage:  lastCheckMessage,
		ListURLExamples:   normalizeJSONBStringList(item.ListURLExamples.Data),
		DetailURLExamples: normalizeJSONBStringList(item.DetailURLExamples.Data),
		CreatedAt:         item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:         item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

func toWebsiteSourceDetail(item projectModels.WebsiteSource) WebsiteSourceDetail {
	lastCheckedAt := formatOptionalTime(item.LastCheckedAt)
	lastCheckStatus := ""
	lastCheckMessage := ""
	if item.LastCheckStatus != nil {
		lastCheckStatus = *item.LastCheckStatus
	}
	if item.LastCheckMessage != nil {
		lastCheckMessage = *item.LastCheckMessage
	}
	entryURL := ""
	if item.EntryURL != nil {
		entryURL = *item.EntryURL
	}
	crawlTips := ""
	if item.CrawlTips != nil {
		crawlTips = *item.CrawlTips
	}
	authHint := ""
	if item.AuthHint != nil {
		authHint = *item.AuthHint
	}
	contentHint := ""
	if item.ContentHint != nil {
		contentHint = *item.ContentHint
	}
	return WebsiteSourceDetail{
		ID:                item.ID,
		ProjectID:         item.ProjectID,
		Name:              item.Name,
		BaseURL:           item.BaseURL,
		EntryURL:          entryURL,
		ListURLExamples:   normalizeJSONBStringList(item.ListURLExamples.Data),
		DetailURLExamples: normalizeJSONBStringList(item.DetailURLExamples.Data),
		AllowedPatterns:   normalizeJSONBStringList(item.AllowedPatterns.Data),
		BlockedPatterns:   normalizeJSONBStringList(item.BlockedPatterns.Data),
		CrawlTips:         crawlTips,
		AuthHint:          authHint,
		ContentHint:       contentHint,
		Tags:              normalizeJSONBStringList(item.Tags.Data),
		Status:            item.Status,
		LastCheckedAt:     lastCheckedAt,
		LastCheckStatus:   lastCheckStatus,
		LastCheckMessage:  lastCheckMessage,
		CreatedAt:         item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:         item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}
