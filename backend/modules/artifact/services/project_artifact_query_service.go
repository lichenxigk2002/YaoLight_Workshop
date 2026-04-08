package services

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	projectSupport "yaolight-workshop/backend/modules/project/support"
)

type ProjectArtifactListQuery struct {
	Keyword    string
	Kind       string
	WorkflowID *uint
	TaskID     *uint
	Page       int
	PageSize   int
}

type ProjectArtifactListItem struct {
	ID           uint      `json:"id"`
	WorkflowID   *uint     `json:"workflowId,omitempty"`
	TaskID       *uint     `json:"taskId,omitempty"`
	NodeID       string    `json:"nodeId"`
	Name         string    `json:"name"`
	Kind         string    `json:"kind"`
	MimeType     string    `json:"mimeType"`
	Size         int64     `json:"size"`
	WorkflowName string    `json:"workflowName,omitempty"`
	TaskName     string    `json:"taskName,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	DownloadURL  string    `json:"downloadUrl"`
}

type ProjectArtifactListResult struct {
	List     []ProjectArtifactListItem `json:"list"`
	Total    int64                     `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"pageSize"`
}

type projectArtifactRow struct {
	ID           uint      `gorm:"column:id"`
	WorkflowID   *uint     `gorm:"column:workflow_id"`
	TaskID       *uint     `gorm:"column:task_id"`
	NodeID       string    `gorm:"column:node_id"`
	Name         string    `gorm:"column:name"`
	Kind         string    `gorm:"column:kind"`
	MimeType     string    `gorm:"column:mime_type"`
	Size         int64     `gorm:"column:size"`
	WorkflowName *string   `gorm:"column:workflow_name"`
	TaskName     *string   `gorm:"column:task_name"`
	CreatedAt    time.Time `gorm:"column:created_at"`
}

type ProjectArtifactQueryService struct {
	db *gorm.DB
}

func NewProjectArtifactQueryService(db *gorm.DB) *ProjectArtifactQueryService {
	return &ProjectArtifactQueryService{db: db}
}

func (s *ProjectArtifactQueryService) ListByProject(userID uint, projectID uint, query ProjectArtifactListQuery) (*ProjectArtifactListResult, error) {
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

	db := s.db.Table("artifacts AS a").
		Joins("JOIN workflows AS w ON w.id = a.workflow_id AND w.deleted_at IS NULL").
		Joins("LEFT JOIN tasks AS t ON t.id = a.task_id AND t.deleted_at IS NULL").
		Where("a.user_id = ? AND w.project_id = ? AND a.deleted_at IS NULL", userID, projectID)

	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		db = db.Where("a.name LIKE ? OR a.node_id LIKE ? OR w.name LIKE ? OR t.name LIKE ?", pattern, pattern, pattern, pattern)
	}
	if kind := strings.TrimSpace(query.Kind); kind != "" {
		db = db.Where("a.kind = ?", kind)
	}
	if query.WorkflowID != nil {
		db = db.Where("a.workflow_id = ?", *query.WorkflowID)
	}
	if query.TaskID != nil {
		db = db.Where("a.task_id = ?", *query.TaskID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var rows []projectArtifactRow
	if err := db.Select(`
		a.id,
		a.workflow_id,
		a.task_id,
		a.node_id,
		a.name,
		a.kind,
		a.mime_type,
		a.size,
		w.name AS workflow_name,
		t.name AS task_name,
		a.created_at
	`).
		Order("a.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	result := &ProjectArtifactListResult{
		List:     make([]ProjectArtifactListItem, 0, len(rows)),
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}
	for _, row := range rows {
		workflowName := ""
		if row.WorkflowName != nil {
			workflowName = *row.WorkflowName
		}
		taskName := ""
		if row.TaskName != nil {
			taskName = *row.TaskName
		}
		result.List = append(result.List, ProjectArtifactListItem{
			ID:           row.ID,
			WorkflowID:   row.WorkflowID,
			TaskID:       row.TaskID,
			NodeID:       row.NodeID,
			Name:         row.Name,
			Kind:         row.Kind,
			MimeType:     row.MimeType,
			Size:         row.Size,
			WorkflowName: workflowName,
			TaskName:     taskName,
			CreatedAt:    row.CreatedAt,
			DownloadURL:  fmt.Sprintf("/api/artifacts/%d/download", row.ID),
		})
	}

	return result, nil
}
