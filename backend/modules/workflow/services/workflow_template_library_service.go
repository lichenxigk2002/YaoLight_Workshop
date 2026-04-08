package services

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var (
	ErrWorkflowTemplateNotFound   = errors.New("workflow template not found")
	ErrWorkflowTemplateNotPublic  = errors.New("workflow template is not publicly available")
)

type WorkflowTemplateLibraryQuery struct {
	Keyword  string
	Page     int
	PageSize int
}

type WorkflowTemplateLibraryItem struct {
	ID               uint      `json:"id"`
	Name             string    `json:"name"`
	Description      *string   `json:"description"`
	Category         *string   `json:"category"`
	Tags             []string  `json:"tags"`
	NodeCount        int64     `json:"node_count"`
	UsageCount       int64     `json:"usage_count"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type WorkflowTemplateLibraryService struct {
	db *gorm.DB
}

func NewWorkflowTemplateLibraryService(db *gorm.DB) *WorkflowTemplateLibraryService {
	return &WorkflowTemplateLibraryService{db: db}
}

func (s *WorkflowTemplateLibraryService) ListPublishedTemplates(query WorkflowTemplateLibraryQuery) ([]WorkflowTemplateLibraryItem, int64, error) {
	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 12
	}
	if pageSize > 50 {
		pageSize = 50
	}

	base := s.db.Table("workflows").
		Where("workflows.is_template = ? AND workflows.status = ? AND workflows.is_public = ? AND workflows.deleted_at IS NULL", true, "published", true)

	keyword := strings.TrimSpace(query.Keyword)
	if keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		base = base.Where(
			`LOWER(workflows.name) LIKE ? OR LOWER(COALESCE(workflows.description, '')) LIKE ? OR LOWER(COALESCE(workflows.category, '')) LIKE ?`,
			like, like, like,
		)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	type row struct {
		workflowModels.Workflow
		NodeCount  int64 `json:"node_count"`
		UsageCount int64 `json:"usage_count"`
	}

	nodeCountSubquery := s.db.Table("workflow_nodes").
		Select("workflow_id, COUNT(*) AS node_count").
		Where("deleted_at IS NULL").
		Group("workflow_id")
	usageCountSubquery := s.db.Table("workflows").
		Select("template_id, COUNT(*) AS usage_count").
		Where("template_id IS NOT NULL AND deleted_at IS NULL").
		Group("template_id")

	var rows []row
	if err := base.
		Select(`
			workflows.*,
			COALESCE(node_counts.node_count, 0) AS node_count,
			COALESCE(usage_counts.usage_count, 0) AS usage_count
		`).
		Joins("LEFT JOIN (?) AS node_counts ON node_counts.workflow_id = workflows.id", nodeCountSubquery).
		Joins("LEFT JOIN (?) AS usage_counts ON usage_counts.template_id = workflows.id", usageCountSubquery).
		Order("workflows.updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	items := make([]WorkflowTemplateLibraryItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, WorkflowTemplateLibraryItem{
			ID:          row.ID,
			Name:        row.Name,
			Description: row.Description,
			Category:    row.Category,
			Tags:        workflowTemplateJSONBToStringSlice(row.Tags),
			NodeCount:   row.NodeCount,
			UsageCount:  row.UsageCount,
			UpdatedAt:   row.UpdatedAt,
		})
	}

	return items, total, nil
}

func (s *WorkflowTemplateLibraryService) GetPublishedTemplateNodes(templateID uint) (*SaveWorkflowNodesRequest, error) {
	var workflow workflowModels.Workflow
	if err := s.db.Where("id = ? AND is_template = ?", templateID, true).First(&workflow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWorkflowTemplateNotFound
		}
		return nil, err
	}
	if workflow.Status != "published" || !workflow.IsPublic {
		return nil, ErrWorkflowTemplateNotPublic
	}

	var dbNodes []workflowModels.WorkflowNode
	if err := s.db.Where("workflow_id = ?", templateID).Order("sort_order ASC, created_at ASC").Find(&dbNodes).Error; err != nil {
		return nil, err
	}

	nodes := make([]WorkflowNodeData, len(dbNodes))
	edges := make([]EdgeData, 0)
	for i, dbNode := range dbNodes {
		position := map[string]interface{}{}
		if posMap, ok := dbNode.Position.Data.(map[string]interface{}); ok {
			position = posMap
		}

		config := map[string]interface{}{}
		if configMap, ok := dbNode.Config.Data.(map[string]interface{}); ok {
			config = configMap
		}

		nodeData := map[string]interface{}{
			"label":  dbNode.Label,
			"type":   dbNode.NodeType,
			"config": config,
		}
		if direction, ok := config["connectionDirection"]; ok {
			nodeData["connectionDirection"] = direction
		}

		nodes[i] = WorkflowNodeData{
			ID:       dbNode.NodeID,
			Type:     dbNode.NodeType,
			Position: position,
			Data:     nodeData,
		}

		switch connections := dbNode.Connections.Data.(type) {
		case []interface{}:
			for _, connection := range connections {
				connectionMap, ok := connection.(map[string]interface{})
				if !ok {
					continue
				}
				target, ok := connectionMap["target"].(string)
				if !ok || target == "" {
					continue
				}
				edgeID, _ := connectionMap["edgeId"].(string)
				if edgeID == "" {
					edgeID = dbNode.NodeID + "-" + target
				}
				edge := EdgeData{
					ID:     edgeID,
					Source: dbNode.NodeID,
					Target: target,
				}
				if sourceHandle, ok := connectionMap["sourceHandle"].(string); ok {
					edge.SourceHandle = sourceHandle
				}
				if targetHandle, ok := connectionMap["targetHandle"].(string); ok {
					edge.TargetHandle = targetHandle
				}
				edges = append(edges, edge)
			}
		}
	}

	var dbCards []workflowModels.WorkflowCommentCard
	if err := s.db.Where("workflow_id = ?", templateID).Order("created_at ASC").Find(&dbCards).Error; err != nil {
		return nil, err
	}

	commentCards := make([]WorkflowCommentCardData, len(dbCards))
	for i, dbCard := range dbCards {
		position := map[string]interface{}{}
		if posMap, ok := dbCard.Position.Data.(map[string]interface{}); ok {
			position = posMap
		}
		commentCards[i] = WorkflowCommentCardData{
			ID:       dbCard.CardID,
			Position: position,
			Data: map[string]interface{}{
				"text":  dbCard.Text,
				"color": dbCard.Color,
			},
		}
	}

	return &SaveWorkflowNodesRequest{
		Nodes:        nodes,
		Edges:        edges,
		CommentCards: commentCards,
	}, nil
}

func workflowTemplateJSONBToStringSlice(value interface{}) []string {
	if value == nil {
		return []string{}
	}
	switch data := value.(type) {
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
