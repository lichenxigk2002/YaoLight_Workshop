package repositories

import (
	"strings"
	"time"

	"gorm.io/gorm"
	taskModels "yaolight-workshop/backend/modules/task/models"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

type AdminTaskListQuery struct {
	Keyword      string
	UserID       *uint
	WorkflowID   *uint
	Status       string
	Statuses     []string
	ErrorKeyword string
	NodeType     string
	StartedFrom  *time.Time
	StartedTo    *time.Time
	Page         int
	PageSize     int
	SortBy       string
	SortOrder    string
}

type AdminTaskListItem struct {
	ID             uint       `json:"id"`
	WorkflowID     uint       `json:"workflow_id"`
	WorkflowName   string     `json:"workflow_name"`
	UserID         uint       `json:"user_id"`
	Username       string     `json:"username"`
	UserNo         int64      `json:"user_no"`
	Name           *string    `json:"name"`
	Status         string     `json:"status"`
	Progress       int        `json:"progress"`
	Priority       int        `json:"priority"`
	ActualDuration *int       `json:"actual_duration"`
	ErrorMessage   *string    `json:"error_message"`
	CreatedAt      time.Time  `json:"created_at"`
	StartedAt      *time.Time `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at"`
}

type AdminTaskSummary struct {
	Total          int64   `json:"total"`
	Running        int64   `json:"running"`
	Failed         int64   `json:"failed"`
	CompletedToday int64   `json:"completed_today"`
	AvgDurationMs  float64 `json:"avg_duration_ms"`
	FailureRate24h float64 `json:"failure_rate_24h"`
}

type AdminTaskDetail struct {
	Task               taskModels.Task      `json:"task"`
	Workflow           adminTaskWorkflowRef `json:"workflow"`
	User               adminTaskUserRef     `json:"user"`
	NodeExecutionCount int64                `json:"node_execution_count"`
	LogCount           int64                `json:"log_count"`
	ArtifactCount      int64                `json:"artifact_count"`
}

type adminTaskWorkflowRef struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type adminTaskUserRef struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	UserNo   int64  `json:"user_no"`
}

type AdminTaskLogQuery struct {
	TaskID   uint
	Level    string
	NodeID   string
	Page     int
	PageSize int
}

type AdminTaskLogListResult struct {
	Logs     []taskModels.TaskLog `json:"logs"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"page_size"`
}

type AdminTaskFailureStats struct {
	TotalFailures   int64                        `json:"total_failures"`
	TimeoutCount    int64                        `json:"timeout_count"`
	UniqueWorkflows int64                        `json:"unique_workflows"`
	UniqueUsers     int64                        `json:"unique_users"`
	TopNodeTypes    []AdminTaskCountItem         `json:"top_node_types"`
	TopWorkflows    []AdminTaskWorkflowCountItem `json:"top_workflows"`
	TopErrors       []AdminTaskCountItem         `json:"top_errors"`
	DailyTrend      []AdminTaskTrendPoint        `json:"daily_trend"`
}

type AdminTaskCountItem struct {
	Label string `json:"label"`
	Count int64  `json:"count"`
}

type AdminTaskWorkflowCountItem struct {
	WorkflowID   uint   `json:"workflow_id"`
	WorkflowName string `json:"workflow_name"`
	Count        int64  `json:"count"`
}

type AdminTaskTrendPoint struct {
	Day   string `json:"day"`
	Count int64  `json:"count"`
}

type AdminTaskQueryRepository struct {
	db *gorm.DB
}

func NewAdminTaskQueryRepository(db *gorm.DB) *AdminTaskQueryRepository {
	return &AdminTaskQueryRepository{db: db}
}

func (r *AdminTaskQueryRepository) List(query AdminTaskListQuery) ([]AdminTaskListItem, int64, error) {
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

	db := r.baseTaskJoinQuery()
	db = applyAdminTaskFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []AdminTaskListItem
	if err := db.Select(`
		tasks.id,
		tasks.workflow_id,
		workflows.name AS workflow_name,
		tasks.user_id,
		users.username,
		users.user_no,
		tasks.name,
		tasks.status,
		tasks.progress,
		tasks.priority,
		tasks.actual_duration,
		tasks.error_message,
		tasks.created_at,
		tasks.started_at,
		tasks.completed_at
	`).
		Order(buildTaskSort(query.SortBy, query.SortOrder)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&items).Error; err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (r *AdminTaskQueryRepository) ListRunning(query AdminTaskListQuery) ([]AdminTaskListItem, int64, error) {
	query.Status = ""
	query.Statuses = []string{"pending", "queued", "running", "paused"}
	return r.List(query)
}

func (r *AdminTaskQueryRepository) ListFailures(query AdminTaskListQuery) ([]AdminTaskListItem, int64, error) {
	query.Status = ""
	query.Statuses = []string{"failed", "timeout"}
	return r.List(query)
}

func (r *AdminTaskQueryRepository) Summary() (*AdminTaskSummary, error) {
	summary := &AdminTaskSummary{}

	if err := r.db.Model(&taskModels.Task{}).Count(&summary.Total).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&taskModels.Task{}).
		Where("status IN ?", []string{"pending", "queued", "running", "paused"}).
		Count(&summary.Running).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&taskModels.Task{}).
		Where("status IN ?", []string{"failed", "timeout"}).
		Count(&summary.Failed).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if err := r.db.Model(&taskModels.Task{}).
		Where("status = ?", "completed").
		Where("completed_at >= ?", startOfDay).
		Count(&summary.CompletedToday).Error; err != nil {
		return nil, err
	}

	var avgDuration float64
	if err := r.db.Model(&taskModels.Task{}).
		Where("actual_duration IS NOT NULL").
		Select("COALESCE(AVG(actual_duration), 0)").
		Scan(&avgDuration).Error; err != nil {
		return nil, err
	}
	summary.AvgDurationMs = avgDuration

	since24h := time.Now().Add(-24 * time.Hour)
	var total24h int64
	if err := r.db.Model(&taskModels.Task{}).
		Where("created_at >= ?", since24h).
		Count(&total24h).Error; err != nil {
		return nil, err
	}
	if total24h > 0 {
		var failed24h int64
		if err := r.db.Model(&taskModels.Task{}).
			Where("created_at >= ?", since24h).
			Where("status IN ?", []string{"failed", "timeout"}).
			Count(&failed24h).Error; err != nil {
			return nil, err
		}
		summary.FailureRate24h = (float64(failed24h) / float64(total24h)) * 100
	}

	return summary, nil
}

func (r *AdminTaskQueryRepository) FailureStats(query AdminTaskListQuery) (*AdminTaskFailureStats, error) {
	query.Status = ""
	query.Statuses = []string{"failed", "timeout"}

	stats := &AdminTaskFailureStats{}
	failureTaskQuery := r.baseTaskJoinQuery()
	failureTaskQuery = applyAdminTaskFilters(failureTaskQuery, query)

	if err := failureTaskQuery.Count(&stats.TotalFailures).Error; err != nil {
		return nil, err
	}
	if err := failureTaskQuery.Session(&gorm.Session{}).
		Where("tasks.status = ?", "timeout").
		Count(&stats.TimeoutCount).Error; err != nil {
		return nil, err
	}
	if err := failureTaskQuery.Session(&gorm.Session{}).
		Distinct("tasks.workflow_id").
		Count(&stats.UniqueWorkflows).Error; err != nil {
		return nil, err
	}
	if err := failureTaskQuery.Session(&gorm.Session{}).
		Distinct("tasks.user_id").
		Count(&stats.UniqueUsers).Error; err != nil {
		return nil, err
	}

	if err := failureTaskQuery.Session(&gorm.Session{}).
		Select("tasks.workflow_id AS workflow_id, workflows.name AS workflow_name, COUNT(*) AS count").
		Group("tasks.workflow_id, workflows.name").
		Order("count DESC, workflows.name ASC").
		Limit(5).
		Scan(&stats.TopWorkflows).Error; err != nil {
		return nil, err
	}

	nodeTypeRows := make([]AdminTaskCountItem, 0)
	failureNodeQuery := r.db.Model(&taskModels.TaskNodeExecution{}).
		Joins("JOIN tasks ON tasks.id = task_node_executions.task_id").
		Joins("JOIN workflows ON workflows.id = tasks.workflow_id").
		Joins("JOIN users ON users.id = tasks.user_id").
		Where("workflows.deleted_at IS NULL").
		Where("users.deleted_at IS NULL").
		Where("task_node_executions.status IN ?", []string{"failed", "timeout"})
	failureNodeQuery = applyAdminTaskFilters(failureNodeQuery, query)
	if err := failureNodeQuery.
		Select("COALESCE(NULLIF(task_node_executions.node_type, ''), 'unknown') AS label, COUNT(*) AS count").
		Group("label").
		Order("count DESC, label ASC").
		Limit(5).
		Scan(&nodeTypeRows).Error; err != nil {
		return nil, err
	}
	stats.TopNodeTypes = nodeTypeRows

	errorRows := make([]AdminTaskCountItem, 0)
	if err := failureTaskQuery.Session(&gorm.Session{}).
		Select("LEFT(COALESCE(NULLIF(tasks.error_message, ''), 'Unknown error'), 120) AS label, COUNT(*) AS count").
		Group("label").
		Order("count DESC, label ASC").
		Limit(5).
		Scan(&errorRows).Error; err != nil {
		return nil, err
	}
	stats.TopErrors = errorRows

	trendRows := make([]AdminTaskTrendPoint, 0)
	if err := failureTaskQuery.Session(&gorm.Session{}).
		Select("TO_CHAR(DATE(COALESCE(tasks.started_at, tasks.created_at)), 'YYYY-MM-DD') AS day, COUNT(*) AS count").
		Group("DATE(COALESCE(tasks.started_at, tasks.created_at))").
		Order("DATE(COALESCE(tasks.started_at, tasks.created_at)) ASC").
		Limit(7).
		Scan(&trendRows).Error; err != nil {
		return nil, err
	}
	stats.DailyTrend = trendRows

	return stats, nil
}

func (r *AdminTaskQueryRepository) GetDetail(taskID uint) (*AdminTaskDetail, error) {
	task := &taskModels.Task{}
	if err := r.db.First(task, taskID).Error; err != nil {
		return nil, err
	}

	var workflow workflowModels.Workflow
	if err := r.db.Select("id", "name").First(&workflow, task.WorkflowID).Error; err != nil {
		return nil, err
	}

	var user userModels.User
	if err := r.db.Select("id", "username", "email", "user_no").First(&user, task.UserID).Error; err != nil {
		return nil, err
	}

	var nodeExecutionCount int64
	if err := r.db.Model(&taskModels.TaskNodeExecution{}).
		Where("task_id = ?", taskID).
		Count(&nodeExecutionCount).Error; err != nil {
		return nil, err
	}

	var logCount int64
	if err := r.db.Model(&taskModels.TaskLog{}).
		Where("task_id = ?", taskID).
		Count(&logCount).Error; err != nil {
		return nil, err
	}

	var artifactCount int64
	if r.db.Table("artifacts").Where("task_id = ?", taskID).Count(&artifactCount).Error != nil {
		artifactCount = 0
	}

	return &AdminTaskDetail{
		Task: *task,
		Workflow: adminTaskWorkflowRef{
			ID:   workflow.ID,
			Name: workflow.Name,
		},
		User: adminTaskUserRef{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			UserNo:   user.UserNo,
		},
		NodeExecutionCount: nodeExecutionCount,
		LogCount:           logCount,
		ArtifactCount:      artifactCount,
	}, nil
}

func (r *AdminTaskQueryRepository) GetLogs(query AdminTaskLogQuery) (*AdminTaskLogListResult, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 100
	}
	if pageSize > 1000 {
		pageSize = 1000
	}

	db := r.db.Model(&taskModels.TaskLog{}).Where("task_id = ?", query.TaskID)
	if level := strings.TrimSpace(query.Level); level != "" {
		db = db.Where("level = ?", level)
	}
	if nodeID := strings.TrimSpace(query.NodeID); nodeID != "" {
		db = db.Where("node_id = ?", nodeID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var logs []taskModels.TaskLog
	if err := db.Order("created_at ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&logs).Error; err != nil {
		return nil, err
	}

	return &AdminTaskLogListResult{
		Logs:     logs,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *AdminTaskQueryRepository) baseTaskJoinQuery() *gorm.DB {
	return r.db.Model(&taskModels.Task{}).
		Joins("JOIN workflows ON workflows.id = tasks.workflow_id").
		Joins("JOIN users ON users.id = tasks.user_id").
		Where("workflows.deleted_at IS NULL").
		Where("users.deleted_at IS NULL")
}

func applyAdminTaskFilters(db *gorm.DB, query AdminTaskListQuery) *gorm.DB {
	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where(`
			CAST(tasks.id AS TEXT) ILIKE ? OR
			COALESCE(tasks.name, '') ILIKE ? OR
			workflows.name ILIKE ? OR
			users.username ILIKE ? OR
			CAST(users.user_no AS TEXT) ILIKE ? OR
			COALESCE(tasks.error_message, '') ILIKE ?
		`, like, like, like, like, like, like)
	}
	if query.UserID != nil {
		db = db.Where("tasks.user_id = ?", *query.UserID)
	}
	if query.WorkflowID != nil {
		db = db.Where("tasks.workflow_id = ?", *query.WorkflowID)
	}
	if len(query.Statuses) > 0 {
		db = db.Where("tasks.status IN ?", query.Statuses)
	} else if status := strings.TrimSpace(query.Status); status != "" {
		db = db.Where("tasks.status = ?", status)
	}
	if errorKeyword := strings.TrimSpace(query.ErrorKeyword); errorKeyword != "" {
		like := "%" + errorKeyword + "%"
		db = db.Where(`
			COALESCE(tasks.error_message, '') ILIKE ? OR
			EXISTS (
				SELECT 1
				FROM task_node_executions
				WHERE task_node_executions.task_id = tasks.id
					AND COALESCE(task_node_executions.error_message, '') ILIKE ?
			)
		`, like, like)
	}
	if nodeType := strings.TrimSpace(query.NodeType); nodeType != "" {
		db = db.Where(`
			EXISTS (
				SELECT 1
				FROM task_node_executions
				WHERE task_node_executions.task_id = tasks.id
					AND task_node_executions.node_type = ?
			)
		`, nodeType)
	}
	if query.StartedFrom != nil {
		db = db.Where("COALESCE(tasks.started_at, tasks.created_at) >= ?", *query.StartedFrom)
	}
	if query.StartedTo != nil {
		db = db.Where("COALESCE(tasks.started_at, tasks.created_at) <= ?", *query.StartedTo)
	}
	return db
}

func buildTaskSort(sortBy, sortOrder string) string {
	column := "tasks.created_at"
	switch strings.TrimSpace(sortBy) {
	case "started_at":
		column = "tasks.started_at"
	case "completed_at":
		column = "tasks.completed_at"
	case "status":
		column = "tasks.status"
	case "progress":
		column = "tasks.progress"
	case "actual_duration":
		column = "tasks.actual_duration"
	}

	order := "DESC"
	if strings.EqualFold(strings.TrimSpace(sortOrder), "ASC") {
		order = "ASC"
	}
	return column + " " + order
}
