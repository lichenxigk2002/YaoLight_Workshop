package services

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	projectSupport "yaolight-workshop/backend/modules/project/support"
)

var (
	ErrProjectKnowledgeNotFound = errors.New("project knowledge not found")
	ErrInvalidProjectKnowledge  = errors.New("invalid project knowledge")
)

var allowedProjectKnowledgeCategories = map[string]struct{}{
	"node_usage":     {},
	"error_repair":   {},
	"best_practice":  {},
	"scene_template": {},
	"business_rule":  {},
}

type ProjectKnowledgePayload struct {
	Category   string   `json:"category"`
	Target     string   `json:"target"`
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	SourceName string   `json:"sourceName"`
	SourceMime string   `json:"sourceMimeType"`
	SourceSize *int64   `json:"sourceSize"`
	Tags       []string `json:"tags"`
	IsActive   *bool    `json:"isActive"`
	WorkflowID *uint    `json:"workflowId"`
}

type ProjectKnowledgeListQuery struct {
	Keyword    string
	Category   string
	Target     string
	IsActive   *bool
	WorkflowID *uint
	Page       int
	PageSize   int
}

type ProjectKnowledgeListItem struct {
	ID             uint     `json:"id"`
	ProjectID      *uint    `json:"projectId,omitempty"`
	WorkflowID     *uint    `json:"workflowId,omitempty"`
	SourceType     string   `json:"sourceType"`
	Category       string   `json:"category"`
	Target         string   `json:"target"`
	Title          string   `json:"title"`
	ContentExcerpt string   `json:"contentExcerpt"`
	SourceName     string   `json:"sourceName,omitempty"`
	SourceMime     string   `json:"sourceMimeType,omitempty"`
	SourceSize     *int64   `json:"sourceSize,omitempty"`
	Tags           []string `json:"tags"`
	IsActive       bool     `json:"isActive"`
	CreatedAt      string   `json:"createdAt"`
	UpdatedAt      string   `json:"updatedAt"`
}

type ProjectKnowledgeDetail struct {
	ID         uint     `json:"id"`
	ProjectID  *uint    `json:"projectId,omitempty"`
	WorkflowID *uint    `json:"workflowId,omitempty"`
	SourceType string   `json:"sourceType"`
	Category   string   `json:"category"`
	Target     string   `json:"target"`
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	SourceName string   `json:"sourceName,omitempty"`
	SourceMime string   `json:"sourceMimeType,omitempty"`
	SourceSize *int64   `json:"sourceSize,omitempty"`
	Tags       []string `json:"tags"`
	IsActive   bool     `json:"isActive"`
	CreatedAt  string   `json:"createdAt"`
	UpdatedAt  string   `json:"updatedAt"`
}

type ProjectKnowledgeListResult struct {
	List     []ProjectKnowledgeListItem `json:"list"`
	Total    int64                      `json:"total"`
	Page     int                        `json:"page"`
	PageSize int                        `json:"pageSize"`
}

type ProjectKnowledgeSearchResult struct {
	ID             uint     `json:"id"`
	Scope          string   `json:"scope"`
	SourceType     string   `json:"sourceType"`
	Category       string   `json:"category"`
	Target         string   `json:"target"`
	Title          string   `json:"title"`
	ContentExcerpt string   `json:"contentExcerpt"`
	Tags           []string `json:"tags"`
}

type ProjectKnowledgeSearchTestResult struct {
	Query string                         `json:"query"`
	Total int                            `json:"total"`
	List  []ProjectKnowledgeSearchResult `json:"list"`
}

type ProjectKnowledgeService struct {
	db *gorm.DB
}

func NewProjectKnowledgeService(db *gorm.DB) *ProjectKnowledgeService {
	return &ProjectKnowledgeService{db: db}
}

func (s *ProjectKnowledgeService) ListKnowledge(userID uint, projectID uint, query ProjectKnowledgeListQuery) (*ProjectKnowledgeListResult, error) {
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

	db := s.db.Model(&alkaidModels.AlkaidKnowledge{}).
		Where("user_id = ? AND project_id = ?", userID, projectID)

	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		db = db.Where("title LIKE ? OR content LIKE ? OR target LIKE ?", pattern, pattern, pattern)
	}
	if category := strings.TrimSpace(query.Category); category != "" {
		db = db.Where("category = ?", category)
	}
	if target := strings.TrimSpace(query.Target); target != "" {
		db = db.Where("target LIKE ?", "%"+target+"%")
	}
	if query.IsActive != nil {
		db = db.Where("is_active = ?", *query.IsActive)
	}
	if query.WorkflowID != nil {
		db = db.Where("workflow_id = ?", *query.WorkflowID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var items []alkaidModels.AlkaidKnowledge
	if err := db.Order("updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	result := &ProjectKnowledgeListResult{
		List:     make([]ProjectKnowledgeListItem, 0, len(items)),
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}
	for _, item := range items {
		result.List = append(result.List, toProjectKnowledgeListItem(item))
	}

	return result, nil
}

func (s *ProjectKnowledgeService) GetKnowledge(userID uint, projectID uint, id uint) (*ProjectKnowledgeDetail, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	var item alkaidModels.AlkaidKnowledge
	if err := s.db.Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProjectKnowledgeNotFound
		}
		return nil, err
	}

	detail := toProjectKnowledgeDetail(item)
	return &detail, nil
}

func (s *ProjectKnowledgeService) CreateKnowledge(userID uint, projectID uint, payload *ProjectKnowledgePayload) (*ProjectKnowledgeDetail, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	model, err := buildProjectKnowledgeModel(userID, projectID, payload, nil)
	if err != nil {
		return nil, err
	}
	if model.WorkflowID != nil {
		if err := projectSupport.EnsureWorkflowInProject(s.db, *model.WorkflowID, projectID, userID); err != nil {
			return nil, err
		}
	}

	if err := s.db.Create(model).Error; err != nil {
		return nil, err
	}
	detail := toProjectKnowledgeDetail(*model)
	return &detail, nil
}

func (s *ProjectKnowledgeService) UpdateKnowledge(userID uint, projectID uint, id uint, payload *ProjectKnowledgePayload) (*ProjectKnowledgeDetail, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	var existing alkaidModels.AlkaidKnowledge
	if err := s.db.Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProjectKnowledgeNotFound
		}
		return nil, err
	}

	model, err := buildProjectKnowledgeModel(userID, projectID, payload, &existing)
	if err != nil {
		return nil, err
	}
	if model.WorkflowID != nil {
		if err := projectSupport.EnsureWorkflowInProject(s.db, *model.WorkflowID, projectID, userID); err != nil {
			return nil, err
		}
	}
	model.ID = existing.ID
	model.CreatedAt = existing.CreatedAt

	if err := s.db.Save(model).Error; err != nil {
		return nil, err
	}

	return s.GetKnowledge(userID, projectID, id)
}

func (s *ProjectKnowledgeService) DeleteKnowledge(userID uint, projectID uint, id uint) error {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return err
	}
	result := s.db.Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).
		Delete(&alkaidModels.AlkaidKnowledge{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrProjectKnowledgeNotFound
	}
	return nil
}

func (s *ProjectKnowledgeService) SetKnowledgeStatus(userID uint, projectID uint, id uint, isActive bool) error {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return err
	}
	result := s.db.Model(&alkaidModels.AlkaidKnowledge{}).
		Where("id = ? AND user_id = ? AND project_id = ?", id, userID, projectID).
		Update("is_active", isActive)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrProjectKnowledgeNotFound
	}
	return nil
}

func (s *ProjectKnowledgeService) SearchTest(userID uint, projectID uint, query string, limit int) (*ProjectKnowledgeSearchTestResult, error) {
	if err := projectSupport.EnsureProjectOwner(s.db, projectID, userID); err != nil {
		return nil, err
	}

	text := strings.TrimSpace(query)
	if text == "" {
		return nil, fmt.Errorf("%w: query is required", ErrInvalidProjectKnowledge)
	}
	if limit <= 0 {
		limit = 5
	}
	if limit > 10 {
		limit = 10
	}

	pattern := "%" + text + "%"
	var items []alkaidModels.AlkaidKnowledge
	if err := s.db.Model(&alkaidModels.AlkaidKnowledge{}).
		Where(`
			is_active = true
			AND (
				(user_id IS NULL AND project_id IS NULL AND workflow_id IS NULL)
				OR (user_id = ? AND project_id IS NULL AND workflow_id IS NULL)
				OR (user_id = ? AND project_id = ? AND workflow_id IS NULL)
			)
			AND (title LIKE ? OR content LIKE ? OR target LIKE ?)
		`, userID, userID, projectID, pattern, pattern, pattern).
		Order("updated_at DESC").
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, err
	}

	result := &ProjectKnowledgeSearchTestResult{
		Query: text,
		Total: len(items),
		List:  make([]ProjectKnowledgeSearchResult, 0, len(items)),
	}
	for _, item := range items {
		result.List = append(result.List, ProjectKnowledgeSearchResult{
			ID:             item.ID,
			Scope:          projectKnowledgeScope(item),
			SourceType:     normalizeSourceType(item.SourceType, item.ProjectID, item.WorkflowID, item.UserID),
			Category:       item.Category,
			Target:         item.Target,
			Title:          item.Title,
			ContentExcerpt: excerptProjectText(item.Content, 180),
			Tags:           normalizeProjectTags(item.Tags.Data),
		})
	}
	return result, nil
}

func buildProjectKnowledgeModel(userID uint, projectID uint, payload *ProjectKnowledgePayload, existing *alkaidModels.AlkaidKnowledge) (*alkaidModels.AlkaidKnowledge, error) {
	if payload == nil {
		return nil, fmt.Errorf("%w: payload is required", ErrInvalidProjectKnowledge)
	}

	model := &alkaidModels.AlkaidKnowledge{
		UserID:    &userID,
		ProjectID: &projectID,
		Category:  strings.TrimSpace(payload.Category),
		Target:    strings.TrimSpace(payload.Target),
		Title:     strings.TrimSpace(payload.Title),
		Content:   strings.TrimSpace(payload.Content),
		Tags:      shared.JSONB{Data: sanitizeProjectTags(payload.Tags)},
	}

	if sourceName := strings.TrimSpace(payload.SourceName); sourceName != "" {
		model.SourceName = &sourceName
	}
	if sourceMime := strings.TrimSpace(payload.SourceMime); sourceMime != "" {
		model.SourceMime = &sourceMime
	}
	if payload.SourceSize != nil && *payload.SourceSize > 0 {
		model.SourceSize = payload.SourceSize
	}

	if payload.WorkflowID != nil && *payload.WorkflowID > 0 {
		model.WorkflowID = payload.WorkflowID
		model.SourceType = "workflow"
	} else {
		model.WorkflowID = nil
		model.SourceType = "project"
	}

	if payload.IsActive != nil {
		model.IsActive = *payload.IsActive
	} else if existing != nil {
		model.IsActive = existing.IsActive
	} else {
		model.IsActive = true
	}

	if err := validateProjectKnowledgeModel(model); err != nil {
		return nil, err
	}
	return model, nil
}

func validateProjectKnowledgeModel(model *alkaidModels.AlkaidKnowledge) error {
	if model == nil {
		return fmt.Errorf("%w: model is nil", ErrInvalidProjectKnowledge)
	}
	if model.Title == "" {
		return fmt.Errorf("%w: title is required", ErrInvalidProjectKnowledge)
	}
	if model.Content == "" {
		return fmt.Errorf("%w: content is required", ErrInvalidProjectKnowledge)
	}
	if model.Category == "" {
		return fmt.Errorf("%w: category is required", ErrInvalidProjectKnowledge)
	}
	if _, ok := allowedProjectKnowledgeCategories[model.Category]; !ok {
		return fmt.Errorf("%w: unsupported category", ErrInvalidProjectKnowledge)
	}
	if model.UserID == nil || *model.UserID == 0 {
		return fmt.Errorf("%w: user id is required", ErrInvalidProjectKnowledge)
	}
	if model.ProjectID == nil || *model.ProjectID == 0 {
		return fmt.Errorf("%w: project id is required", ErrInvalidProjectKnowledge)
	}
	return nil
}

func sanitizeProjectTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
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

func normalizeProjectTags(value interface{}) []string {
	switch data := value.(type) {
	case []string:
		return sanitizeProjectTags(data)
	case []interface{}:
		tags := make([]string, 0, len(data))
		for _, item := range data {
			if str, ok := item.(string); ok {
				tags = append(tags, str)
			}
		}
		return sanitizeProjectTags(tags)
	default:
		return []string{}
	}
}

func excerptProjectText(text string, limit int) string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" || limit <= 0 {
		return ""
	}
	runes := []rune(trimmed)
	if len(runes) <= limit {
		return trimmed
	}
	return string(runes[:limit]) + "..."
}

func normalizeSourceType(sourceType string, projectID *uint, workflowID *uint, userID *uint) string {
	trimmed := strings.TrimSpace(sourceType)
	if trimmed != "" {
		return trimmed
	}
	if workflowID != nil {
		return "workflow"
	}
	if projectID != nil {
		return "project"
	}
	if userID == nil {
		return "system"
	}
	return "user"
}

func projectKnowledgeScope(item alkaidModels.AlkaidKnowledge) string {
	if item.WorkflowID != nil {
		return "workflow"
	}
	if item.ProjectID != nil {
		return "project"
	}
	if item.UserID == nil {
		return "system"
	}
	return "user"
}

func toProjectKnowledgeListItem(item alkaidModels.AlkaidKnowledge) ProjectKnowledgeListItem {
	return ProjectKnowledgeListItem{
		ID:             item.ID,
		ProjectID:      item.ProjectID,
		WorkflowID:     item.WorkflowID,
		SourceType:     normalizeSourceType(item.SourceType, item.ProjectID, item.WorkflowID, item.UserID),
		Category:       item.Category,
		Target:         item.Target,
		Title:          item.Title,
		ContentExcerpt: excerptProjectText(item.Content, 120),
		SourceName:     optionalProjectString(item.SourceName),
		SourceMime:     optionalProjectString(item.SourceMime),
		SourceSize:     item.SourceSize,
		Tags:           normalizeProjectTags(item.Tags.Data),
		IsActive:       item.IsActive,
		CreatedAt:      item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:      item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

func toProjectKnowledgeDetail(item alkaidModels.AlkaidKnowledge) ProjectKnowledgeDetail {
	return ProjectKnowledgeDetail{
		ID:         item.ID,
		ProjectID:  item.ProjectID,
		WorkflowID: item.WorkflowID,
		SourceType: normalizeSourceType(item.SourceType, item.ProjectID, item.WorkflowID, item.UserID),
		Category:   item.Category,
		Target:     item.Target,
		Title:      item.Title,
		Content:    item.Content,
		SourceName: optionalProjectString(item.SourceName),
		SourceMime: optionalProjectString(item.SourceMime),
		SourceSize: item.SourceSize,
		Tags:       normalizeProjectTags(item.Tags.Data),
		IsActive:   item.IsActive,
		CreatedAt:  item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:  item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

func optionalProjectString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
