package services

import (
	"errors"
	"strings"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
	nodeModels "yaolight-workshop/backend/modules/node/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var (
	ErrAdminNodeTypeNotFound       = errors.New("node type not found")
	ErrAdminNodeTypeCategoryDup    = errors.New("node type category already exists")
	ErrAdminNodeTypeSystemDelete   = errors.New("system node types cannot be deleted")
	ErrAdminNodeTypeReferenced     = errors.New("node type is referenced by workflows")
	ErrAdminNodeTypeInvalidPayload = errors.New("invalid node type payload")
)

type AdminNodeTypeService struct {
	db *gorm.DB
}

type AdminNodeTypeSummary struct {
	Total          int64 `json:"total"`
	Active         int64 `json:"active"`
	System         int64 `json:"system"`
	Custom         int64 `json:"custom"`
	Inactive       int64 `json:"inactive"`
	WorkflowUsages int64 `json:"workflow_usages"`
}

type AdminNodeTypeListQuery struct {
	Keyword  string
	Category string
	IsSystem *bool
	IsActive *bool
	Page     int
	PageSize int
}

type AdminNodeTypeListResult struct {
	List     []AdminNodeTypeListItem `json:"list"`
	Total    int64                   `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"page_size"`
}

type AdminNodeTypeListItem struct {
	ID            uint    `json:"id"`
	Name          string  `json:"name"`
	Category      string  `json:"category"`
	Icon          *string `json:"icon"`
	Color         *string `json:"color"`
	Description   *string `json:"description"`
	IsSystem      bool    `json:"is_system"`
	IsActive      bool    `json:"is_active"`
	Version       string  `json:"version"`
	UsageCount    int64   `json:"usage_count"`
	WorkflowCount int64   `json:"workflow_count"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

type AdminNodeTypeDetail struct {
	ID            uint        `json:"id"`
	Name          string      `json:"name"`
	Category      string      `json:"category"`
	Icon          *string     `json:"icon"`
	Color         *string     `json:"color"`
	ConfigSchema  interface{} `json:"config_schema"`
	DefaultConfig interface{} `json:"default_config"`
	Description   *string     `json:"description"`
	Documentation *string     `json:"documentation"`
	Examples      interface{} `json:"examples"`
	IsSystem      bool        `json:"is_system"`
	IsActive      bool        `json:"is_active"`
	Version       string      `json:"version"`
	UsageCount    int64       `json:"usage_count"`
	WorkflowCount int64       `json:"workflow_count"`
	CreatedAt     string      `json:"created_at"`
	UpdatedAt     string      `json:"updated_at"`
}

type AdminNodeTypePayload struct {
	Name          string      `json:"name" binding:"required"`
	Category      string      `json:"category" binding:"required"`
	Icon          *string     `json:"icon"`
	Color         *string     `json:"color"`
	ConfigSchema  interface{} `json:"config_schema"`
	DefaultConfig interface{} `json:"default_config"`
	Description   *string     `json:"description"`
	Documentation *string     `json:"documentation"`
	Examples      interface{} `json:"examples"`
	IsActive      bool        `json:"is_active"`
	Version       string      `json:"version"`
}

type AdminNodeTypeStatusPayload struct {
	IsActive bool `json:"is_active"`
}

func NewAdminNodeTypeService(db *gorm.DB) *AdminNodeTypeService {
	return &AdminNodeTypeService{db: db}
}

func (s *AdminNodeTypeService) GetSummary() (*AdminNodeTypeSummary, error) {
	summary := &AdminNodeTypeSummary{}
	if err := s.db.Model(&nodeModels.NodeType{}).Count(&summary.Total).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&nodeModels.NodeType{}).Where("is_active = ?", true).Count(&summary.Active).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&nodeModels.NodeType{}).Where("is_system = ?", true).Count(&summary.System).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&nodeModels.NodeType{}).Where("is_system = ?", false).Count(&summary.Custom).Error; err != nil {
		return nil, err
	}
	summary.Inactive = summary.Total - summary.Active
	if err := s.db.Model(&workflowModels.WorkflowNode{}).Count(&summary.WorkflowUsages).Error; err != nil {
		return nil, err
	}
	return summary, nil
}

func (s *AdminNodeTypeService) ListNodeTypes(query AdminNodeTypeListQuery) (*AdminNodeTypeListResult, error) {
	page, pageSize := normalizeNodeTypePage(query.Page, query.PageSize)

	db := s.applyFilters(s.db.Model(&nodeModels.NodeType{}), query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var items []nodeModels.NodeType
	if err := db.Order("is_system DESC, category ASC, updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	categories := make([]string, 0, len(items))
	for _, item := range items {
		categories = append(categories, item.Category)
	}
	usageMap, workflowMap, err := s.buildUsageMaps(categories)
	if err != nil {
		return nil, err
	}

	resultItems := make([]AdminNodeTypeListItem, 0, len(items))
	for i := range items {
		resultItems = append(resultItems, toAdminNodeTypeListItem(&items[i], usageMap[items[i].Category], workflowMap[items[i].Category]))
	}

	return &AdminNodeTypeListResult{
		List:     resultItems,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *AdminNodeTypeService) GetNodeType(id uint) (*AdminNodeTypeDetail, error) {
	item, err := s.findNodeType(id)
	if err != nil {
		return nil, err
	}

	usageCount, workflowCount, err := s.getUsageStats(item.Category)
	if err != nil {
		return nil, err
	}

	return toAdminNodeTypeDetail(item, usageCount, workflowCount), nil
}

func (s *AdminNodeTypeService) CreateNodeType(payload *AdminNodeTypePayload) (*AdminNodeTypeDetail, error) {
	model, err := s.buildNodeTypeModel(nil, payload)
	if err != nil {
		return nil, err
	}
	model.IsSystem = false

	if err := s.ensureCategoryUnique(model.Category, 0); err != nil {
		return nil, err
	}

	if err := s.db.Create(model).Error; err != nil {
		return nil, err
	}

	return toAdminNodeTypeDetail(model, 0, 0), nil
}

func (s *AdminNodeTypeService) UpdateNodeType(id uint, payload *AdminNodeTypePayload) (*AdminNodeTypeDetail, error) {
	item, err := s.findNodeType(id)
	if err != nil {
		return nil, err
	}

	usageCount, workflowCount, err := s.getUsageStats(item.Category)
	if err != nil {
		return nil, err
	}

	originalCategory := item.Category
	if err := s.assignNodeTypeFields(item, payload); err != nil {
		return nil, err
	}

	if item.IsSystem {
		item.Category = originalCategory
	} else if originalCategory != item.Category {
		if usageCount > 0 {
			return nil, ErrAdminNodeTypeReferenced
		}
		if err := s.ensureCategoryUnique(item.Category, item.ID); err != nil {
			return nil, err
		}
	}

	if err := s.db.Save(item).Error; err != nil {
		return nil, err
	}

	usageCount, workflowCount, err = s.getUsageStats(item.Category)
	if err != nil {
		return nil, err
	}

	return toAdminNodeTypeDetail(item, usageCount, workflowCount), nil
}

func (s *AdminNodeTypeService) SetNodeTypeStatus(id uint, isActive bool) error {
	item, err := s.findNodeType(id)
	if err != nil {
		return err
	}
	item.IsActive = isActive
	return s.db.Save(item).Error
}

func (s *AdminNodeTypeService) DeleteNodeType(id uint) error {
	item, err := s.findNodeType(id)
	if err != nil {
		return err
	}
	if item.IsSystem {
		return ErrAdminNodeTypeSystemDelete
	}

	usageCount, _, err := s.getUsageStats(item.Category)
	if err != nil {
		return err
	}
	if usageCount > 0 {
		return ErrAdminNodeTypeReferenced
	}

	return s.db.Delete(&nodeModels.NodeType{}, item.ID).Error
}

func (s *AdminNodeTypeService) findNodeType(id uint) (*nodeModels.NodeType, error) {
	var item nodeModels.NodeType
	if err := s.db.First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAdminNodeTypeNotFound
		}
		return nil, err
	}
	return &item, nil
}

func (s *AdminNodeTypeService) buildNodeTypeModel(existing *nodeModels.NodeType, payload *AdminNodeTypePayload) (*nodeModels.NodeType, error) {
	if payload == nil {
		return nil, ErrAdminNodeTypeInvalidPayload
	}
	model := existing
	if model == nil {
		model = &nodeModels.NodeType{}
	}
	if err := s.assignNodeTypeFields(model, payload); err != nil {
		return nil, err
	}
	return model, nil
}

func (s *AdminNodeTypeService) assignNodeTypeFields(model *nodeModels.NodeType, payload *AdminNodeTypePayload) error {
	name := strings.TrimSpace(payload.Name)
	category := strings.TrimSpace(payload.Category)
	version := strings.TrimSpace(payload.Version)
	if name == "" || category == "" {
		return ErrAdminNodeTypeInvalidPayload
	}

	model.Name = name
	model.Category = category
	model.Icon = normalizeOptionalString(payload.Icon)
	model.Color = normalizeOptionalString(payload.Color)
	model.Description = normalizeOptionalString(payload.Description)
	model.Documentation = normalizeOptionalString(payload.Documentation)
	model.ConfigSchema = toJSONB(payload.ConfigSchema, map[string]interface{}{})
	model.DefaultConfig = toJSONB(payload.DefaultConfig, map[string]interface{}{})
	model.Examples = toOptionalJSONB(payload.Examples)
	model.IsActive = payload.IsActive
	if version == "" {
		version = "1.0.0"
	}
	model.Version = version
	return nil
}

func (s *AdminNodeTypeService) ensureCategoryUnique(category string, excludeID uint) error {
	var count int64
	db := s.db.Model(&nodeModels.NodeType{}).Where("category = ?", category)
	if excludeID != 0 {
		db = db.Where("id <> ?", excludeID)
	}
	if err := db.Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrAdminNodeTypeCategoryDup
	}
	return nil
}

func (s *AdminNodeTypeService) applyFilters(db *gorm.DB, query AdminNodeTypeListQuery) *gorm.DB {
	keyword := strings.TrimSpace(query.Keyword)
	if keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		db = db.Where(
			"LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?",
			like, like, like,
		)
	}
	if category := strings.TrimSpace(query.Category); category != "" {
		db = db.Where("category = ?", category)
	}
	if query.IsSystem != nil {
		db = db.Where("is_system = ?", *query.IsSystem)
	}
	if query.IsActive != nil {
		db = db.Where("is_active = ?", *query.IsActive)
	}
	return db
}

func (s *AdminNodeTypeService) buildUsageMaps(categories []string) (map[string]int64, map[string]int64, error) {
	usageMap := make(map[string]int64, len(categories))
	workflowMap := make(map[string]int64, len(categories))
	if len(categories) == 0 {
		return usageMap, workflowMap, nil
	}

	type usageRow struct {
		NodeType string
		Count    int64
	}
	var usageRows []usageRow
	if err := s.db.Model(&workflowModels.WorkflowNode{}).
		Select("node_type, COUNT(*) AS count").
		Where("node_type IN ?", categories).
		Group("node_type").
		Scan(&usageRows).Error; err != nil {
		return nil, nil, err
	}
	for _, row := range usageRows {
		usageMap[row.NodeType] = row.Count
	}

	type workflowRow struct {
		NodeType string
		Count    int64
	}
	var workflowRows []workflowRow
	if err := s.db.Model(&workflowModels.WorkflowNode{}).
		Select("node_type, COUNT(DISTINCT workflow_id) AS count").
		Where("node_type IN ?", categories).
		Group("node_type").
		Scan(&workflowRows).Error; err != nil {
		return nil, nil, err
	}
	for _, row := range workflowRows {
		workflowMap[row.NodeType] = row.Count
	}

	return usageMap, workflowMap, nil
}

func (s *AdminNodeTypeService) getUsageStats(category string) (int64, int64, error) {
	usageMap, workflowMap, err := s.buildUsageMaps([]string{category})
	if err != nil {
		return 0, 0, err
	}
	return usageMap[category], workflowMap[category], nil
}

func normalizeNodeTypePage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
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

func toJSONB(value interface{}, fallback interface{}) shared.JSONB {
	if value == nil {
		return shared.JSONB{Data: fallback}
	}
	return shared.JSONB{Data: value}
}

func toOptionalJSONB(value interface{}) *shared.JSONB {
	if value == nil {
		return nil
	}
	jsonb := shared.JSONB{Data: value}
	return &jsonb
}

func toAdminNodeTypeListItem(item *nodeModels.NodeType, usageCount, workflowCount int64) AdminNodeTypeListItem {
	return AdminNodeTypeListItem{
		ID:            item.ID,
		Name:          item.Name,
		Category:      item.Category,
		Icon:          item.Icon,
		Color:         item.Color,
		Description:   item.Description,
		IsSystem:      item.IsSystem,
		IsActive:      item.IsActive,
		Version:       item.Version,
		UsageCount:    usageCount,
		WorkflowCount: workflowCount,
		CreatedAt:     item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:     item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

func toAdminNodeTypeDetail(item *nodeModels.NodeType, usageCount, workflowCount int64) *AdminNodeTypeDetail {
	var examples interface{}
	if item.Examples != nil {
		examples = item.Examples.Data
	}
	return &AdminNodeTypeDetail{
		ID:            item.ID,
		Name:          item.Name,
		Category:      item.Category,
		Icon:          item.Icon,
		Color:         item.Color,
		ConfigSchema:  item.ConfigSchema.Data,
		DefaultConfig: item.DefaultConfig.Data,
		Description:   item.Description,
		Documentation: item.Documentation,
		Examples:      examples,
		IsSystem:      item.IsSystem,
		IsActive:      item.IsActive,
		Version:       item.Version,
		UsageCount:    usageCount,
		WorkflowCount: workflowCount,
		CreatedAt:     item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:     item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}
