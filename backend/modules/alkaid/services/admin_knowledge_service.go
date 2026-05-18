package services

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

var (
	ErrKnowledgeNotFound = errors.New("knowledge not found")
	ErrInvalidKnowledge  = errors.New("invalid knowledge")
)

var allowedKnowledgeCategories = map[string]struct{}{
	"node_usage":     {},
	"error_repair":   {},
	"best_practice":  {},
	"scene_template": {},
}

type AdminKnowledgePayload struct {
	UserID   *uint    `json:"user_id"`
	Category string   `json:"category"`
	Target   string   `json:"target"`
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Tags     []string `json:"tags"`
	IsActive *bool    `json:"is_active"`
}

type AdminKnowledgeListQuery struct {
	Keyword   string
	Category  string
	Target    string
	IsActive  *bool
	Scope     string
	UserID    *uint
	Page      int
	PageSize  int
	SortBy    string
	SortOrder string
}

type AdminKnowledgeListItem struct {
	ID             uint     `json:"id"`
	UserID         *uint    `json:"user_id"`
	Scope          string   `json:"scope"`
	Category       string   `json:"category"`
	Target         string   `json:"target"`
	Title          string   `json:"title"`
	ContentExcerpt string   `json:"content_excerpt"`
	Tags           []string `json:"tags"`
	IsActive       bool     `json:"is_active"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

type AdminKnowledgeDetail struct {
	ID        uint     `json:"id"`
	UserID    *uint    `json:"user_id"`
	Scope     string   `json:"scope"`
	Category  string   `json:"category"`
	Target    string   `json:"target"`
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	Tags      []string `json:"tags"`
	IsActive  bool     `json:"is_active"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

type AdminKnowledgeListResult struct {
	List     []AdminKnowledgeListItem `json:"list"`
	Total    int64                    `json:"total"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"page_size"`
}

type AdminKnowledgeSummary struct {
	Total          int64            `json:"total"`
	Active         int64            `json:"active"`
	SystemCount    int64            `json:"system_count"`
	PrivateCount   int64            `json:"private_count"`
	CategoryCounts map[string]int64 `json:"category_counts"`
}

type AdminKnowledgeSearchResult struct {
	ID             uint     `json:"id"`
	UserID         *uint    `json:"user_id"`
	Scope          string   `json:"scope"`
	Category       string   `json:"category"`
	Target         string   `json:"target"`
	Title          string   `json:"title"`
	ContentExcerpt string   `json:"content_excerpt"`
	Tags           []string `json:"tags"`
}

type AdminKnowledgeSearchTestResult struct {
	Query string                       `json:"query"`
	Total int                          `json:"total"`
	List  []AdminKnowledgeSearchResult `json:"list"`
}

type AdminKnowledgeService struct {
	db *gorm.DB
}

func NewAdminKnowledgeService(db *gorm.DB) *AdminKnowledgeService {
	return &AdminKnowledgeService{db: db}
}

func (s *AdminKnowledgeService) GetSummary() (*AdminKnowledgeSummary, error) {
	summary := &AdminKnowledgeSummary{
		CategoryCounts: map[string]int64{
			"node_usage":     0,
			"error_repair":   0,
			"best_practice":  0,
			"scene_template": 0,
		},
	}

	if err := s.db.Model(&alkaidModels.AlkaidKnowledge{}).Count(&summary.Total).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&alkaidModels.AlkaidKnowledge{}).Where("is_active = ?", true).Count(&summary.Active).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&alkaidModels.AlkaidKnowledge{}).Where("user_id IS NULL").Count(&summary.SystemCount).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&alkaidModels.AlkaidKnowledge{}).Where("user_id IS NOT NULL").Count(&summary.PrivateCount).Error; err != nil {
		return nil, err
	}

	type categoryCount struct {
		Category string
		Count    int64
	}

	var rows []categoryCount
	if err := s.db.Model(&alkaidModels.AlkaidKnowledge{}).
		Select("category, COUNT(*) AS count").
		Group("category").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		summary.CategoryCounts[row.Category] = row.Count
	}

	return summary, nil
}

func (s *AdminKnowledgeService) ListKnowledge(query AdminKnowledgeListQuery) (*AdminKnowledgeListResult, error) {
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

	db := s.applyListFilters(s.db.Model(&alkaidModels.AlkaidKnowledge{}), query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	sortBy := sanitizeKnowledgeSortBy(query.SortBy)
	sortOrder := sanitizeSortOrder(query.SortOrder)

	var items []alkaidModels.AlkaidKnowledge
	if err := db.Order(sortBy + " " + sortOrder).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	result := &AdminKnowledgeListResult{
		List:     make([]AdminKnowledgeListItem, 0, len(items)),
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}
	for _, item := range items {
		result.List = append(result.List, toAdminKnowledgeListItem(item))
	}

	return result, nil
}

func (s *AdminKnowledgeService) GetKnowledge(id uint) (*AdminKnowledgeDetail, error) {
	var item alkaidModels.AlkaidKnowledge
	if err := s.db.First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrKnowledgeNotFound
		}
		return nil, err
	}
	detail := toAdminKnowledgeDetail(item)
	return &detail, nil
}

func (s *AdminKnowledgeService) CreateKnowledge(payload *AdminKnowledgePayload) (*AdminKnowledgeDetail, error) {
	model, err := buildKnowledgeModel(payload, nil)
	if err != nil {
		return nil, err
	}
	if err := s.db.Create(model).Error; err != nil {
		return nil, err
	}
	detail := toAdminKnowledgeDetail(*model)
	return &detail, nil
}

func (s *AdminKnowledgeService) UpdateKnowledge(id uint, payload *AdminKnowledgePayload) (*AdminKnowledgeDetail, error) {
	var existing alkaidModels.AlkaidKnowledge
	if err := s.db.First(&existing, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrKnowledgeNotFound
		}
		return nil, err
	}

	model, err := buildKnowledgeModel(payload, &existing)
	if err != nil {
		return nil, err
	}
	model.ID = existing.ID
	model.CreatedAt = existing.CreatedAt

	if err := s.db.Save(model).Error; err != nil {
		return nil, err
	}

	return s.GetKnowledge(id)
}

func (s *AdminKnowledgeService) DeleteKnowledge(id uint) error {
	if _, err := s.GetKnowledge(id); err != nil {
		return err
	}
	return s.db.Delete(&alkaidModels.AlkaidKnowledge{}, id).Error
}

func (s *AdminKnowledgeService) SetKnowledgeStatus(id uint, isActive bool) error {
	result := s.db.Model(&alkaidModels.AlkaidKnowledge{}).
		Where("id = ?", id).
		Update("is_active", isActive)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrKnowledgeNotFound
	}
	return nil
}

func (s *AdminKnowledgeService) SearchTest(query string, userID *uint, limit int) (*AdminKnowledgeSearchTestResult, error) {
	text := strings.TrimSpace(query)
	if text == "" {
		return nil, fmt.Errorf("%w: query is required", ErrInvalidKnowledge)
	}
	if limit <= 0 {
		limit = 5
	}
	if limit > 10 {
		limit = 10
	}

	var scopedUserID uint
	if userID != nil {
		scopedUserID = *userID
	}
	items, err := (&KnowledgeService{}).SearchKnowledgeScoped(KnowledgeSearchOptions{
		Query:  text,
		UserID: scopedUserID,
		Limit:  limit,
	})
	if err != nil {
		return nil, err
	}

	result := &AdminKnowledgeSearchTestResult{
		Query: text,
		Total: len(items),
		List:  make([]AdminKnowledgeSearchResult, 0, len(items)),
	}
	for _, item := range items {
		result.List = append(result.List, AdminKnowledgeSearchResult{
			ID:             item.ID,
			UserID:         item.UserID,
			Scope:          knowledgeScope(item.UserID),
			Category:       item.Category,
			Target:         item.Target,
			Title:          item.Title,
			ContentExcerpt: excerptText(item.Content, 180),
			Tags:           normalizeTags(item.Tags.Data),
		})
	}
	return result, nil
}

func (s *AdminKnowledgeService) applyListFilters(db *gorm.DB, query AdminKnowledgeListQuery) *gorm.DB {
	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		db = db.Where(
			"title LIKE ? OR content LIKE ? OR target LIKE ?",
			pattern, pattern, pattern,
		)
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

	switch strings.ToLower(strings.TrimSpace(query.Scope)) {
	case "system":
		db = db.Where("user_id IS NULL")
	case "private", "user":
		db = db.Where("user_id IS NOT NULL")
	}

	if query.UserID != nil {
		db = db.Where("user_id = ?", *query.UserID)
	}

	return db
}

func buildKnowledgeModel(payload *AdminKnowledgePayload, existing *alkaidModels.AlkaidKnowledge) (*alkaidModels.AlkaidKnowledge, error) {
	if payload == nil {
		return nil, fmt.Errorf("%w: payload is required", ErrInvalidKnowledge)
	}

	model := &alkaidModels.AlkaidKnowledge{
		UserID:   payload.UserID,
		Category: strings.TrimSpace(payload.Category),
		Target:   strings.TrimSpace(payload.Target),
		Title:    strings.TrimSpace(payload.Title),
		Content:  strings.TrimSpace(payload.Content),
		Tags:     shared.JSONB{Data: sanitizeTags(payload.Tags)},
	}

	if payload.IsActive != nil {
		model.IsActive = *payload.IsActive
	} else if existing != nil {
		model.IsActive = existing.IsActive
	} else {
		model.IsActive = true
	}

	if err := validateKnowledgeModel(model); err != nil {
		return nil, err
	}

	return model, nil
}

func validateKnowledgeModel(model *alkaidModels.AlkaidKnowledge) error {
	if model == nil {
		return fmt.Errorf("%w: model is nil", ErrInvalidKnowledge)
	}
	if model.Title == "" {
		return fmt.Errorf("%w: title is required", ErrInvalidKnowledge)
	}
	if model.Content == "" {
		return fmt.Errorf("%w: content is required", ErrInvalidKnowledge)
	}
	if model.Category == "" {
		return fmt.Errorf("%w: category is required", ErrInvalidKnowledge)
	}
	if _, ok := allowedKnowledgeCategories[model.Category]; !ok {
		return fmt.Errorf("%w: unsupported category", ErrInvalidKnowledge)
	}
	return nil
}

func sanitizeKnowledgeSortBy(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "created_at":
		return "created_at"
	case "title":
		return "title"
	case "category":
		return "category"
	default:
		return "updated_at"
	}
}

func sanitizeSortOrder(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "asc") {
		return "ASC"
	}
	return "DESC"
}

func sanitizeTags(tags []string) []string {
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

func normalizeTags(value interface{}) []string {
	switch data := value.(type) {
	case []string:
		return sanitizeTags(data)
	case []interface{}:
		tags := make([]string, 0, len(data))
		for _, item := range data {
			if str, ok := item.(string); ok {
				tags = append(tags, str)
			}
		}
		return sanitizeTags(tags)
	default:
		return []string{}
	}
}

func knowledgeScope(userID *uint) string {
	if userID == nil {
		return "system"
	}
	return "private"
}

func excerptText(text string, limit int) string {
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

func toAdminKnowledgeListItem(item alkaidModels.AlkaidKnowledge) AdminKnowledgeListItem {
	return AdminKnowledgeListItem{
		ID:             item.ID,
		UserID:         item.UserID,
		Scope:          knowledgeScope(item.UserID),
		Category:       item.Category,
		Target:         item.Target,
		Title:          item.Title,
		ContentExcerpt: excerptText(item.Content, 120),
		Tags:           normalizeTags(item.Tags.Data),
		IsActive:       item.IsActive,
		CreatedAt:      item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:      item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

func toAdminKnowledgeDetail(item alkaidModels.AlkaidKnowledge) AdminKnowledgeDetail {
	return AdminKnowledgeDetail{
		ID:        item.ID,
		UserID:    item.UserID,
		Scope:     knowledgeScope(item.UserID),
		Category:  item.Category,
		Target:    item.Target,
		Title:     item.Title,
		Content:   item.Content,
		Tags:      normalizeTags(item.Tags.Data),
		IsActive:  item.IsActive,
		CreatedAt: item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt: item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}
