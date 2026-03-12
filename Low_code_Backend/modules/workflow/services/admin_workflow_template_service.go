package services

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var (
	ErrAdminWorkflowTemplateNotFound       = errors.New("workflow template not found")
	ErrAdminWorkflowTemplateNameRequired   = errors.New("template name is required")
	ErrAdminWorkflowTemplateSourceRequired = errors.New("source workflow is required")
	ErrAdminWorkflowTemplateSourceNotFound = errors.New("source workflow not found")
	ErrAdminWorkflowTemplateSourceInvalid  = errors.New("source workflow must be a non-template workflow")
	ErrAdminWorkflowTemplateSourceEmpty    = errors.New("source workflow has no nodes")
	ErrAdminWorkflowTemplateStatusInvalid  = errors.New("invalid template status")
)

var adminWorkflowTemplateAllowedStatuses = map[string]struct{}{
	"draft":     {},
	"published": {},
	"archived":  {},
	"disabled":  {},
}

type AdminWorkflowTemplateSummary struct {
	Total     int64 `json:"total"`
	Published int64 `json:"published"`
	Public    int64 `json:"public"`
	Draft     int64 `json:"draft"`
	Archived  int64 `json:"archived"`
	Disabled  int64 `json:"disabled"`
}

type AdminWorkflowTemplateListQuery struct {
	Keyword  string
	Status   string
	Category string
	IsPublic *bool
	Page     int
	PageSize int
}

type AdminWorkflowTemplateSourceWorkflowQuery struct {
	Keyword  string
	PageSize int
}

type AdminWorkflowTemplatePayload struct {
	SourceWorkflowID *uint    `json:"source_workflow_id,omitempty"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	Category         *string  `json:"category"`
	Tags             []string `json:"tags"`
	Status           string   `json:"status"`
	IsPublic         bool     `json:"is_public"`
}

type AdminWorkflowTemplateSyncPayload struct {
	SourceWorkflowID *uint `json:"source_workflow_id,omitempty"`
}

type AdminWorkflowTemplateListItem struct {
	ID                 uint       `json:"id"`
	Name               string     `json:"name"`
	Description        *string    `json:"description"`
	Status             string     `json:"status"`
	Category           *string    `json:"category"`
	Tags               []string   `json:"tags"`
	IsPublic           bool       `json:"is_public"`
	SourceWorkflowID   *uint      `json:"source_workflow_id"`
	SourceWorkflowName *string    `json:"source_workflow_name"`
	SourceUsername     *string    `json:"source_username"`
	NodeCount          int64      `json:"node_count"`
	CommentCardCount   int64      `json:"comment_card_count"`
	UsageCount         int64      `json:"usage_count"`
	ExecutionCount     int        `json:"execution_count"`
	LastExecutedAt     *time.Time `json:"last_executed_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type AdminWorkflowTemplateSourceWorkflowItem struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Status      string    `json:"status"`
	UserID      uint      `json:"user_id"`
	Username    string    `json:"username"`
	ProjectID   *uint     `json:"project_id"`
	NodeCount   int64     `json:"node_count"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type AdminWorkflowTemplateNodeTypeStat struct {
	NodeType string `json:"node_type"`
	Count    int64  `json:"count"`
}

type AdminWorkflowTemplateDetail struct {
	ID                 uint                                `json:"id"`
	Name               string                              `json:"name"`
	Description        *string                             `json:"description"`
	Version            string                              `json:"version"`
	Status             string                              `json:"status"`
	Category           *string                             `json:"category"`
	Tags               []string                            `json:"tags"`
	IsPublic           bool                                `json:"is_public"`
	SourceWorkflowID   *uint                               `json:"source_workflow_id"`
	SourceWorkflowName *string                             `json:"source_workflow_name"`
	SourceUsername     *string                             `json:"source_username"`
	NodeCount          int64                               `json:"node_count"`
	EdgeCount          int64                               `json:"edge_count"`
	CommentCardCount   int64                               `json:"comment_card_count"`
	UsageCount         int64                               `json:"usage_count"`
	ExecutionCount     int                                 `json:"execution_count"`
	LastExecutedAt     *time.Time                          `json:"last_executed_at"`
	NodeTypeStats      []AdminWorkflowTemplateNodeTypeStat `json:"node_type_stats"`
	CreatedAt          time.Time                           `json:"created_at"`
	UpdatedAt          time.Time                           `json:"updated_at"`
}

type AdminWorkflowTemplateService struct {
	db *gorm.DB
}

func NewAdminWorkflowTemplateService(db *gorm.DB) *AdminWorkflowTemplateService {
	return &AdminWorkflowTemplateService{db: db}
}

func (s *AdminWorkflowTemplateService) GetSummary() (*AdminWorkflowTemplateSummary, error) {
	summary := &AdminWorkflowTemplateSummary{}

	if err := s.db.Model(&workflowModels.Workflow{}).Where("is_template = ?", true).Count(&summary.Total).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&workflowModels.Workflow{}).Where("is_template = ? AND status = ?", true, "published").Count(&summary.Published).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&workflowModels.Workflow{}).Where("is_template = ? AND is_public = ?", true, true).Count(&summary.Public).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&workflowModels.Workflow{}).Where("is_template = ? AND status = ?", true, "draft").Count(&summary.Draft).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&workflowModels.Workflow{}).Where("is_template = ? AND status = ?", true, "archived").Count(&summary.Archived).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&workflowModels.Workflow{}).Where("is_template = ? AND status = ?", true, "disabled").Count(&summary.Disabled).Error; err != nil {
		return nil, err
	}

	return summary, nil
}

func (s *AdminWorkflowTemplateService) ListTemplates(query AdminWorkflowTemplateListQuery) ([]AdminWorkflowTemplateListItem, int64, error) {
	page, pageSize := normalizeAdminWorkflowTemplatePage(query.Page, query.PageSize, 20)

	base := s.db.Table("workflows").
		Where("workflows.is_template = ?", true).
		Joins("LEFT JOIN workflows source_workflows ON source_workflows.id = workflows.parent_id").
		Joins("LEFT JOIN users source_users ON source_users.id = source_workflows.user_id")

	keyword := strings.TrimSpace(query.Keyword)
	if keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		base = base.Where(
			`LOWER(workflows.name) LIKE ? OR LOWER(COALESCE(workflows.description, '')) LIKE ? OR LOWER(COALESCE(source_workflows.name, '')) LIKE ?`,
			like, like, like,
		)
	}
	if status := strings.TrimSpace(query.Status); status != "" && status != "all" {
		base = base.Where("workflows.status = ?", status)
	}
	if category := strings.TrimSpace(query.Category); category != "" && category != "all" {
		base = base.Where("workflows.category = ?", category)
	}
	if query.IsPublic != nil {
		base = base.Where("workflows.is_public = ?", *query.IsPublic)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	type row struct {
		workflowModels.Workflow
		SourceWorkflowName *string `json:"source_workflow_name"`
		SourceUsername     *string `json:"source_username"`
		NodeCount          int64   `json:"node_count"`
		CommentCardCount   int64   `json:"comment_card_count"`
		UsageCount         int64   `json:"usage_count"`
	}

	nodeCountSubquery := s.db.Table("workflow_nodes").Select("workflow_id, COUNT(*) AS node_count").Group("workflow_id")
	commentCountSubquery := s.db.Table("workflow_comment_cards").Select("workflow_id, COUNT(*) AS comment_card_count").Group("workflow_id")
	usageCountSubquery := s.db.Table("workflows").Select("template_id, COUNT(*) AS usage_count").Where("template_id IS NOT NULL").Group("template_id")

	var rows []row
	err := base.
		Select(`
			workflows.*,
			source_workflows.name AS source_workflow_name,
			source_users.username AS source_username,
			COALESCE(node_counts.node_count, 0) AS node_count,
			COALESCE(comment_counts.comment_card_count, 0) AS comment_card_count,
			COALESCE(usage_counts.usage_count, 0) AS usage_count
		`).
		Joins("LEFT JOIN (?) AS node_counts ON node_counts.workflow_id = workflows.id", nodeCountSubquery).
		Joins("LEFT JOIN (?) AS comment_counts ON comment_counts.workflow_id = workflows.id", commentCountSubquery).
		Joins("LEFT JOIN (?) AS usage_counts ON usage_counts.template_id = workflows.id", usageCountSubquery).
		Order("workflows.updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}

	items := make([]AdminWorkflowTemplateListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, AdminWorkflowTemplateListItem{
			ID:                 row.ID,
			Name:               row.Name,
			Description:        row.Description,
			Status:             row.Status,
			Category:           row.Category,
			Tags:               jsonbToStringSlice(row.Tags),
			IsPublic:           row.IsPublic,
			SourceWorkflowID:   row.ParentID,
			SourceWorkflowName: row.SourceWorkflowName,
			SourceUsername:     row.SourceUsername,
			NodeCount:          row.NodeCount,
			CommentCardCount:   row.CommentCardCount,
			UsageCount:         row.UsageCount,
			ExecutionCount:     row.ExecutionCount,
			LastExecutedAt:     row.LastExecutedAt,
			CreatedAt:          row.CreatedAt,
			UpdatedAt:          row.UpdatedAt,
		})
	}

	return items, total, nil
}

func (s *AdminWorkflowTemplateService) ListSourceWorkflows(query AdminWorkflowTemplateSourceWorkflowQuery) ([]AdminWorkflowTemplateSourceWorkflowItem, error) {
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50
	}

	base := s.db.Table("workflows").
		Where("workflows.is_template = ?", false).
		Joins("INNER JOIN users ON users.id = workflows.user_id")

	keyword := strings.TrimSpace(query.Keyword)
	if keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		base = base.Where(
			`LOWER(workflows.name) LIKE ? OR LOWER(COALESCE(workflows.description, '')) LIKE ? OR CAST(workflows.id AS TEXT) = ? OR LOWER(users.username) LIKE ?`,
			like, like, keyword, like,
		)
	}

	nodeCountSubquery := s.db.Table("workflow_nodes").Select("workflow_id, COUNT(*) AS node_count").Group("workflow_id")

	var rows []AdminWorkflowTemplateSourceWorkflowItem
	if err := base.
		Select(`
			workflows.id,
			workflows.name,
			workflows.description,
			workflows.status,
			workflows.user_id,
			users.username,
			workflows.project_id,
			COALESCE(node_counts.node_count, 0) AS node_count,
			workflows.updated_at
		`).
		Joins("LEFT JOIN (?) AS node_counts ON node_counts.workflow_id = workflows.id", nodeCountSubquery).
		Order("workflows.updated_at DESC").
		Limit(pageSize).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *AdminWorkflowTemplateService) GetTemplateDetail(id uint) (*AdminWorkflowTemplateDetail, error) {
	var workflow workflowModels.Workflow
	if err := s.db.Where("id = ? AND is_template = ?", id, true).First(&workflow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAdminWorkflowTemplateNotFound
		}
		return nil, err
	}

	var sourceWorkflowName *string
	var sourceUsername *string
	if workflow.ParentID != nil {
		var source struct {
			Name     string `json:"name"`
			Username string `json:"username"`
		}
		if err := s.db.Table("workflows").
			Select("workflows.name, users.username").
			Joins("LEFT JOIN users ON users.id = workflows.user_id").
			Where("workflows.id = ?", *workflow.ParentID).
			Scan(&source).Error; err == nil && source.Name != "" {
			sourceWorkflowName = &source.Name
			sourceUsername = &source.Username
		}
	}

	var nodeTypeRows []AdminWorkflowTemplateNodeTypeStat
	if err := s.db.Model(&workflowModels.WorkflowNode{}).
		Select("node_type, COUNT(*) AS count").
		Where("workflow_id = ?", id).
		Group("node_type").
		Order("count DESC, node_type ASC").
		Scan(&nodeTypeRows).Error; err != nil {
		return nil, err
	}

	nodes, err := s.loadWorkflowNodes(id)
	if err != nil {
		return nil, err
	}
	commentCount, err := s.countWorkflowCommentCards(id)
	if err != nil {
		return nil, err
	}
	usageCount, err := s.countTemplateUsage(id)
	if err != nil {
		return nil, err
	}

	return &AdminWorkflowTemplateDetail{
		ID:                 workflow.ID,
		Name:               workflow.Name,
		Description:        workflow.Description,
		Version:            workflow.Version,
		Status:             workflow.Status,
		Category:           workflow.Category,
		Tags:               jsonbToStringSlice(workflow.Tags),
		IsPublic:           workflow.IsPublic,
		SourceWorkflowID:   workflow.ParentID,
		SourceWorkflowName: sourceWorkflowName,
		SourceUsername:     sourceUsername,
		NodeCount:          int64(len(nodes)),
		EdgeCount:          countWorkflowEdges(nodes),
		CommentCardCount:   commentCount,
		UsageCount:         usageCount,
		ExecutionCount:     workflow.ExecutionCount,
		LastExecutedAt:     workflow.LastExecutedAt,
		NodeTypeStats:      nodeTypeRows,
		CreatedAt:          workflow.CreatedAt,
		UpdatedAt:          workflow.UpdatedAt,
	}, nil
}

func (s *AdminWorkflowTemplateService) CreateTemplate(operatorID uint, payload AdminWorkflowTemplatePayload) (*AdminWorkflowTemplateDetail, error) {
	normalized, err := normalizeAdminWorkflowTemplatePayload(payload, false)
	if err != nil {
		return nil, err
	}

	var createdID uint
	err = s.db.Transaction(func(tx *gorm.DB) error {
		template := &workflowModels.Workflow{
			UserID:         operatorID,
			ProjectID:      nil,
			Name:           normalized.Name,
			Description:    cloneStringPointer(normalized.Description),
			Version:        "1.0.0",
			Status:         normalized.Status,
			Category:       cloneStringPointer(normalized.Category),
			Tags:           normalizeTagsJSONB(normalized.Tags),
			Config:         shared.JSONB{Data: map[string]interface{}{}},
			Variables:      shared.JSONB{Data: map[string]interface{}{}},
			Settings:       shared.JSONB{Data: map[string]interface{}{}},
			IsTemplate:     true,
			IsPublic:       normalized.IsPublic,
			TemplateID:     nil,
			ParentID:       normalized.SourceWorkflowID,
			ExecutionCount: 0,
			SuccessCount:   0,
			FailureCount:   0,
		}

		if normalized.SourceWorkflowID != nil {
			source, sourceNodeCount, err := s.loadSourceWorkflow(tx, *normalized.SourceWorkflowID)
			if err != nil {
				return err
			}
			if sourceNodeCount == 0 {
				return ErrAdminWorkflowTemplateSourceEmpty
			}

			template.Description = fallbackStringPointer(normalized.Description, source.Description)
			template.Version = source.Version
			template.Category = fallbackStringPointer(normalized.Category, source.Category)
			template.Tags = fallbackJSONB(normalizeTagsJSONB(normalized.Tags), source.Tags)
			template.Config = cloneJSONB(source.Config)
			template.Variables = cloneJSONB(source.Variables)
			template.Settings = cloneJSONB(source.Settings)
		}

		if err := tx.Create(template).Error; err != nil {
			return err
		}
		if normalized.SourceWorkflowID != nil {
			if err := cloneWorkflowStructure(tx, *normalized.SourceWorkflowID, template.ID); err != nil {
				return err
			}
		}
		createdID = template.ID
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetTemplateDetail(createdID)
}

func (s *AdminWorkflowTemplateService) EnsureTemplateExists(id uint) error {
	var workflow workflowModels.Workflow
	if err := s.db.Select("id").Where("id = ? AND is_template = ?", id, true).First(&workflow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrAdminWorkflowTemplateNotFound
		}
		return err
	}
	return nil
}

func (s *AdminWorkflowTemplateService) UpdateTemplate(id uint, payload AdminWorkflowTemplatePayload) (*AdminWorkflowTemplateDetail, error) {
	normalized, err := normalizeAdminWorkflowTemplatePayload(payload, false)
	if err != nil {
		return nil, err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		var workflow workflowModels.Workflow
		if err := tx.Where("id = ? AND is_template = ?", id, true).First(&workflow).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAdminWorkflowTemplateNotFound
			}
			return err
		}

		workflow.Name = normalized.Name
		workflow.Description = normalized.Description
		workflow.Category = normalized.Category
		workflow.Tags = normalizeTagsJSONB(normalized.Tags)
		workflow.Status = normalized.Status
		workflow.IsPublic = normalized.IsPublic

		return tx.Save(&workflow).Error
	})
	if err != nil {
		return nil, err
	}

	return s.GetTemplateDetail(id)
}

func (s *AdminWorkflowTemplateService) DeleteTemplate(id uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var workflow workflowModels.Workflow
		if err := tx.Where("id = ? AND is_template = ?", id, true).First(&workflow).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAdminWorkflowTemplateNotFound
			}
			return err
		}
		if err := tx.Where("workflow_id = ?", id).Delete(&workflowModels.WorkflowNode{}).Error; err != nil {
			return err
		}
		if err := tx.Where("workflow_id = ?", id).Delete(&workflowModels.WorkflowCommentCard{}).Error; err != nil {
			return err
		}
		return tx.Delete(&workflow).Error
	})
}

func (s *AdminWorkflowTemplateService) SyncTemplate(id uint, payload AdminWorkflowTemplateSyncPayload) (*AdminWorkflowTemplateDetail, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var template workflowModels.Workflow
		if err := tx.Where("id = ? AND is_template = ?", id, true).First(&template).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAdminWorkflowTemplateNotFound
			}
			return err
		}

		sourceID := template.ParentID
		if payload.SourceWorkflowID != nil {
			sourceID = payload.SourceWorkflowID
		}
		if sourceID == nil {
			return ErrAdminWorkflowTemplateSourceRequired
		}

		source, sourceNodeCount, err := s.loadSourceWorkflow(tx, *sourceID)
		if err != nil {
			return err
		}
		if sourceNodeCount == 0 {
			return ErrAdminWorkflowTemplateSourceEmpty
		}

		template.ParentID = sourceID
		template.Version = source.Version
		template.Config = cloneJSONB(source.Config)
		template.Variables = cloneJSONB(source.Variables)
		template.Settings = cloneJSONB(source.Settings)
		if err := tx.Save(&template).Error; err != nil {
			return err
		}

		if err := tx.Where("workflow_id = ?", id).Delete(&workflowModels.WorkflowNode{}).Error; err != nil {
			return err
		}
		if err := tx.Where("workflow_id = ?", id).Delete(&workflowModels.WorkflowCommentCard{}).Error; err != nil {
			return err
		}
		return cloneWorkflowStructure(tx, source.ID, id)
	})
	if err != nil {
		return nil, err
	}

	return s.GetTemplateDetail(id)
}

func (s *AdminWorkflowTemplateService) loadSourceWorkflow(tx *gorm.DB, sourceID uint) (*workflowModels.Workflow, int64, error) {
	var workflow workflowModels.Workflow
	if err := tx.Where("id = ?", sourceID).First(&workflow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, 0, ErrAdminWorkflowTemplateSourceNotFound
		}
		return nil, 0, err
	}
	if workflow.IsTemplate {
		return nil, 0, ErrAdminWorkflowTemplateSourceInvalid
	}

	var nodeCount int64
	if err := tx.Model(&workflowModels.WorkflowNode{}).Where("workflow_id = ?", sourceID).Count(&nodeCount).Error; err != nil {
		return nil, 0, err
	}

	return &workflow, nodeCount, nil
}

func (s *AdminWorkflowTemplateService) loadWorkflowNodes(workflowID uint) ([]workflowModels.WorkflowNode, error) {
	var nodes []workflowModels.WorkflowNode
	err := s.db.Where("workflow_id = ?", workflowID).Order("sort_order ASC, created_at ASC").Find(&nodes).Error
	return nodes, err
}

func (s *AdminWorkflowTemplateService) countWorkflowCommentCards(workflowID uint) (int64, error) {
	var count int64
	err := s.db.Model(&workflowModels.WorkflowCommentCard{}).Where("workflow_id = ?", workflowID).Count(&count).Error
	return count, err
}

func (s *AdminWorkflowTemplateService) countTemplateUsage(templateID uint) (int64, error) {
	var count int64
	err := s.db.Model(&workflowModels.Workflow{}).Where("template_id = ?", templateID).Count(&count).Error
	return count, err
}

func cloneWorkflowStructure(tx *gorm.DB, sourceWorkflowID, targetWorkflowID uint) error {
	var sourceNodes []workflowModels.WorkflowNode
	if err := tx.Where("workflow_id = ?", sourceWorkflowID).Order("sort_order ASC, created_at ASC").Find(&sourceNodes).Error; err != nil {
		return err
	}

	if len(sourceNodes) > 0 {
		targetNodes := make([]workflowModels.WorkflowNode, 0, len(sourceNodes))
		for _, node := range sourceNodes {
			targetNodes = append(targetNodes, workflowModels.WorkflowNode{
				WorkflowID:    targetWorkflowID,
				NodeID:        node.NodeID,
				NodeType:      node.NodeType,
				Label:         cloneStringPointer(node.Label),
				Position:      cloneJSONB(node.Position),
				Config:        cloneJSONB(node.Config),
				Connections:   cloneJSONB(node.Connections),
				Conditions:    cloneOptionalJSONB(node.Conditions),
				SortOrder:     node.SortOrder,
				IsEnabled:     node.IsEnabled,
				ErrorHandling: cloneOptionalJSONB(node.ErrorHandling),
				Timeout:       cloneIntPointer(node.Timeout),
				RetryConfig:   cloneOptionalJSONB(node.RetryConfig),
			})
		}
		if err := tx.Create(&targetNodes).Error; err != nil {
			return err
		}
	}

	var sourceCards []workflowModels.WorkflowCommentCard
	if err := tx.Where("workflow_id = ?", sourceWorkflowID).Order("created_at ASC").Find(&sourceCards).Error; err != nil {
		return err
	}
	if len(sourceCards) > 0 {
		targetCards := make([]workflowModels.WorkflowCommentCard, 0, len(sourceCards))
		for _, card := range sourceCards {
			targetCards = append(targetCards, workflowModels.WorkflowCommentCard{
				WorkflowID: targetWorkflowID,
				CardID:     card.CardID,
				Position:   cloneJSONB(card.Position),
				Text:       cloneStringPointer(card.Text),
				Color:      card.Color,
			})
		}
		if err := tx.Create(&targetCards).Error; err != nil {
			return err
		}
	}

	return nil
}

func normalizeAdminWorkflowTemplatePage(page, pageSize, defaultPageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func normalizeAdminWorkflowTemplatePayload(payload AdminWorkflowTemplatePayload, requireSource bool) (*AdminWorkflowTemplatePayload, error) {
	name := strings.TrimSpace(payload.Name)
	if name == "" {
		return nil, ErrAdminWorkflowTemplateNameRequired
	}
	if requireSource && payload.SourceWorkflowID == nil {
		return nil, ErrAdminWorkflowTemplateSourceRequired
	}

	status := strings.TrimSpace(payload.Status)
	if status == "" {
		status = "draft"
	}
	if _, ok := adminWorkflowTemplateAllowedStatuses[status]; !ok {
		return nil, ErrAdminWorkflowTemplateStatusInvalid
	}

	return &AdminWorkflowTemplatePayload{
		SourceWorkflowID: payload.SourceWorkflowID,
		Name:             name,
		Description:      normalizeOptionalString(payload.Description),
		Category:         normalizeOptionalString(payload.Category),
		Tags:             normalizeTags(payload.Tags),
		Status:           status,
		IsPublic:         payload.IsPublic,
	}, nil
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

func normalizeTagsJSONB(tags []string) shared.JSONB {
	return shared.JSONB{Data: normalizeTags(tags)}
}

func normalizeTags(tags []string) []string {
	normalized := make([]string, 0, len(tags))
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func fallbackStringPointer(primary, fallback *string) *string {
	if primary != nil {
		return primary
	}
	return cloneStringPointer(fallback)
}

func fallbackJSONB(primary shared.JSONB, fallback shared.JSONB) shared.JSONB {
	if data := jsonbToStringSlice(primary); len(data) > 0 {
		return shared.JSONB{Data: data}
	}
	return cloneJSONB(fallback)
}

func jsonbToStringSlice(value shared.JSONB) []string {
	switch data := value.Data.(type) {
	case nil:
		return []string{}
	case []string:
		return append([]string(nil), data...)
	case []interface{}:
		result := make([]string, 0, len(data))
		for _, item := range data {
			if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
				result = append(result, text)
			}
		}
		return result
	default:
		raw, err := json.Marshal(data)
		if err != nil {
			return []string{}
		}
		var result []string
		if err := json.Unmarshal(raw, &result); err != nil {
			return []string{}
		}
		return result
	}
}

func cloneJSONB(value shared.JSONB) shared.JSONB {
	if value.Data == nil {
		return shared.JSONB{}
	}
	raw, err := json.Marshal(value.Data)
	if err != nil {
		return shared.JSONB{Data: value.Data}
	}
	var cloned interface{}
	if err := json.Unmarshal(raw, &cloned); err != nil {
		return shared.JSONB{Data: value.Data}
	}
	return shared.JSONB{Data: cloned}
}

func cloneOptionalJSONB(value *shared.JSONB) *shared.JSONB {
	if value == nil {
		return nil
	}
	cloned := cloneJSONB(*value)
	return &cloned
}

func cloneStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func cloneIntPointer(value *int) *int {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func countWorkflowEdges(nodes []workflowModels.WorkflowNode) int64 {
	var count int64
	for _, node := range nodes {
		switch data := node.Connections.Data.(type) {
		case []interface{}:
			count += int64(len(data))
		case []map[string]interface{}:
			count += int64(len(data))
		default:
			raw, err := json.Marshal(data)
			if err != nil {
				continue
			}
			var decoded []interface{}
			if err := json.Unmarshal(raw, &decoded); err == nil {
				count += int64(len(decoded))
			}
		}
	}
	return count
}
