package services

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net"
	"sort"
	"strconv"
	"strings"
	"time"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/shared"
	aiUtils "yaolight-workshop/backend/modules/ai/utils"
	taskModels "yaolight-workshop/backend/modules/task/models"
	taskRepos "yaolight-workshop/backend/modules/task/repositories"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

var (
	ErrTaskScheduleNotFound      = errors.New("task schedule not found")
	ErrTaskScheduleReplayBlocked = errors.New("trigger replay blocked")
	ErrTaskScheduleBadSignature  = errors.New("invalid trigger signature")
	ErrTaskScheduleForbiddenIP   = errors.New("trigger ip not allowed")
)

var taskScheduleCronParser = cron.NewParser(
	cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
)

type RetryPolicy struct {
	Mode            string `json:"mode"`
	MaxRetries      int    `json:"maxRetries"`
	DelaySeconds    int    `json:"delaySeconds"`
	MaxDelaySeconds int    `json:"maxDelaySeconds"`
}

type TaskScheduleListQuery struct {
	WorkflowID  *uint
	ProjectID   *uint
	TriggerType string
	Page        int
	PageSize    int
}

type TaskSchedulePlan struct {
	Frequency string `json:"frequency"`
	Time      string `json:"time"`
	Weekdays  []int  `json:"weekdays"`
	MonthDay  *int   `json:"monthDay"`
}

type CreateTaskScheduleRequest struct {
	WorkflowID         uint              `json:"workflowId"`
	Name               string            `json:"name"`
	Description        *string           `json:"description"`
	TriggerType        string            `json:"triggerType"`
	CronExpression     string            `json:"cronExpression"`
	SchedulePlan       *TaskSchedulePlan `json:"schedulePlan"`
	Timezone           string            `json:"timezone"`
	IsActive           *bool             `json:"isActive"`
	StartDate          *time.Time        `json:"startDate"`
	EndDate            *time.Time        `json:"endDate"`
	MaxRuns            *int              `json:"maxRuns"`
	Config             interface{}       `json:"config"`
	NotificationConfig interface{}       `json:"notificationConfig"`
	RetryPolicy        interface{}       `json:"retryPolicy"`
	InputTemplate      interface{}       `json:"inputTemplate"`
}

type UpdateTaskScheduleRequest struct {
	Name                *string           `json:"name"`
	Description         *string           `json:"description"`
	TriggerType         *string           `json:"triggerType"`
	CronExpression      *string           `json:"cronExpression"`
	SchedulePlan        *TaskSchedulePlan `json:"schedulePlan"`
	Timezone            *string           `json:"timezone"`
	IsActive            *bool             `json:"isActive"`
	StartDate           *time.Time        `json:"startDate"`
	EndDate             *time.Time        `json:"endDate"`
	MaxRuns             *int              `json:"maxRuns"`
	Config              interface{}       `json:"config"`
	NotificationConfig  interface{}       `json:"notificationConfig"`
	RetryPolicy         interface{}       `json:"retryPolicy"`
	InputTemplate       interface{}       `json:"inputTemplate"`
	RotateWebhookSecret bool              `json:"rotateWebhookSecret"`
}

type TriggerNowRequest struct {
	Input     interface{} `json:"input"`
	RequestID string      `json:"requestId"`
}

type TaskScheduleResponse struct {
	ID                   uint              `json:"id"`
	WorkflowID           uint              `json:"workflowId"`
	WorkflowName         *string           `json:"workflowName,omitempty"`
	ProjectID            *uint             `json:"projectId,omitempty"`
	UserID               uint              `json:"userId"`
	Name                 string            `json:"name"`
	Description          *string           `json:"description,omitempty"`
	TriggerType          string            `json:"triggerType"`
	CronExpression       string            `json:"cronExpression"`
	SchedulePlan         *TaskSchedulePlan `json:"schedulePlan,omitempty"`
	Timezone             string            `json:"timezone"`
	IsActive             bool              `json:"isActive"`
	StartDate            *time.Time        `json:"startDate,omitempty"`
	EndDate              *time.Time        `json:"endDate,omitempty"`
	MaxRuns              *int              `json:"maxRuns,omitempty"`
	RunCount             int               `json:"runCount"`
	NextRunAt            *time.Time        `json:"nextRunAt,omitempty"`
	LastRunAt            *time.Time        `json:"lastRunAt,omitempty"`
	LastRunStatus        *string           `json:"lastRunStatus,omitempty"`
	LastErrorMessage     *string           `json:"lastErrorMessage,omitempty"`
	LastTriggerRequestID *string           `json:"lastTriggerRequestId,omitempty"`
	WebhookToken         *string           `json:"webhookToken,omitempty"`
	WebhookURL           *string           `json:"webhookUrl,omitempty"`
	Config               interface{}       `json:"config,omitempty"`
	NotificationConfig   interface{}       `json:"notificationConfig,omitempty"`
	RetryPolicy          interface{}       `json:"retryPolicy,omitempty"`
	InputTemplate        interface{}       `json:"inputTemplate,omitempty"`
	CreatedAt            time.Time         `json:"createdAt"`
	UpdatedAt            time.Time         `json:"updatedAt"`
}

type TaskScheduleRunResponse struct {
	ID           uint        `json:"id"`
	ScheduleID   uint        `json:"scheduleId"`
	WorkflowID   uint        `json:"workflowId"`
	UserID       uint        `json:"userId"`
	TriggerType  string      `json:"triggerType"`
	TriggerKey   string      `json:"triggerKey"`
	RequestID    *string     `json:"requestId,omitempty"`
	Status       string      `json:"status"`
	TaskID       *uint       `json:"taskId,omitempty"`
	AttemptCount int         `json:"attemptCount"`
	ErrorMessage *string     `json:"errorMessage,omitempty"`
	InputPayload interface{} `json:"inputPayload,omitempty"`
	Metadata     interface{} `json:"metadata,omitempty"`
	TriggeredAt  time.Time   `json:"triggeredAt"`
	FinishedAt   *time.Time  `json:"finishedAt,omitempty"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

type TaskSchedulePage struct {
	List     []TaskScheduleResponse `json:"list"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"pageSize"`
}

type TaskScheduleRunPage struct {
	List     []TaskScheduleRunResponse `json:"list"`
	Total    int64                     `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"pageSize"`
}

type TaskScheduleMutationResult struct {
	Schedule      TaskScheduleResponse `json:"schedule"`
	WebhookSecret *string              `json:"webhookSecret,omitempty"`
}

type TaskScheduleService struct {
	db          *gorm.DB
	executor    *workflowServices.WorkflowExecutor
	workflowSvc *workflowServices.WorkflowService
	taskRepo    taskRepos.TaskRepository
}

func NewTaskScheduleService(db *gorm.DB) *TaskScheduleService {
	workflowRepo := workflowRepos.NewWorkflowRepository(db)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(db)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(db)
	return &TaskScheduleService{
		db:          db,
		executor:    workflowServices.NewWorkflowExecutor(),
		workflowSvc: workflowServices.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo),
		taskRepo:    taskRepos.NewTaskRepository(db),
	}
}

func (s *TaskScheduleService) ListSchedules(userID uint, query TaskScheduleListQuery, baseURL string) (*TaskSchedulePage, error) {
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 || query.PageSize > 100 {
		query.PageSize = 20
	}

	type taskScheduleListRow struct {
		taskModels.TaskSchedule
		WorkflowName *string `gorm:"column:workflow_name"`
		ProjectID    *uint   `gorm:"column:project_id"`
	}

	dbq := s.db.Model(&taskModels.TaskSchedule{}).
		Joins("LEFT JOIN workflows ON workflows.id = task_schedules.workflow_id AND workflows.deleted_at IS NULL").
		Where("task_schedules.user_id = ?", userID)
	if query.WorkflowID != nil && *query.WorkflowID > 0 {
		dbq = dbq.Where("task_schedules.workflow_id = ?", *query.WorkflowID)
	}
	if query.ProjectID != nil && *query.ProjectID > 0 {
		dbq = dbq.Where("workflows.project_id = ?", *query.ProjectID)
	}
	if strings.TrimSpace(query.TriggerType) != "" {
		dbq = dbq.Where("task_schedules.trigger_type = ?", normalizeTriggerType(query.TriggerType))
	}

	var total int64
	if err := dbq.Distinct("task_schedules.id").Count(&total).Error; err != nil {
		return nil, err
	}

	var rows []taskScheduleListRow
	if err := dbq.
		Select("task_schedules.*, workflows.name AS workflow_name, workflows.project_id AS project_id").
		Order("task_schedules.updated_at DESC").
		Offset((query.Page - 1) * query.PageSize).
		Limit(query.PageSize).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]TaskScheduleResponse, 0, len(rows))
	for i := range rows {
		item := s.toScheduleResponse(&rows[i].TaskSchedule, baseURL)
		item.WorkflowName = rows[i].WorkflowName
		item.ProjectID = rows[i].ProjectID
		items = append(items, item)
	}

	return &TaskSchedulePage{
		List:     items,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

func (s *TaskScheduleService) ListRuns(userID, scheduleID uint, page, pageSize int) (*TaskScheduleRunPage, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	schedule, err := s.getOwnedSchedule(userID, scheduleID)
	if err != nil {
		return nil, err
	}

	dbq := s.db.Model(&taskModels.TaskScheduleRun{}).Where("schedule_id = ?", schedule.ID)
	var total int64
	if err := dbq.Count(&total).Error; err != nil {
		return nil, err
	}

	var rows []taskModels.TaskScheduleRun
	if err := dbq.Order("triggered_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]TaskScheduleRunResponse, 0, len(rows))
	for i := range rows {
		items = append(items, toRunResponse(&rows[i]))
	}

	return &TaskScheduleRunPage{
		List:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *TaskScheduleService) CreateSchedule(userID uint, req CreateTaskScheduleRequest, baseURL string) (*TaskScheduleMutationResult, error) {
	workflow, err := s.getOwnedWorkflow(userID, req.WorkflowID)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("schedule name is required")
	}

	schedule := &taskModels.TaskSchedule{
		WorkflowID:  workflow.ID,
		UserID:      userID,
		Name:        name,
		Description: trimOptionalString(req.Description),
	}

	webhookSecret, err := s.applyScheduleConfig(schedule, req, true)
	if err != nil {
		return nil, err
	}

	if err := s.db.Create(schedule).Error; err != nil {
		return nil, err
	}

	return &TaskScheduleMutationResult{
		Schedule:      s.toScheduleResponse(schedule, baseURL),
		WebhookSecret: webhookSecret,
	}, nil
}

func (s *TaskScheduleService) UpdateSchedule(userID, scheduleID uint, req UpdateTaskScheduleRequest, baseURL string) (*TaskScheduleMutationResult, error) {
	schedule, err := s.getOwnedSchedule(userID, scheduleID)
	if err != nil {
		return nil, err
	}

	webhookSecret, err := s.applyScheduleConfig(schedule, req, false)
	if err != nil {
		return nil, err
	}

	if err := s.db.Save(schedule).Error; err != nil {
		return nil, err
	}

	return &TaskScheduleMutationResult{
		Schedule:      s.toScheduleResponse(schedule, baseURL),
		WebhookSecret: webhookSecret,
	}, nil
}

func (s *TaskScheduleService) CancelSchedule(userID, scheduleID uint, baseURL string) (*TaskScheduleResponse, error) {
	schedule, err := s.getOwnedSchedule(userID, scheduleID)
	if err != nil {
		return nil, err
	}

	schedule.IsActive = false
	if err := s.db.Save(schedule).Error; err != nil {
		return nil, err
	}

	result := s.toScheduleResponse(schedule, baseURL)
	return &result, nil
}

func (s *TaskScheduleService) TriggerNow(userID, scheduleID uint, req TriggerNowRequest) (*TaskScheduleRunResponse, error) {
	schedule, err := s.getOwnedSchedule(userID, scheduleID)
	if err != nil {
		return nil, err
	}

	requestID := strings.TrimSpace(req.RequestID)
	if requestID == "" {
		requestID, err = generateTriggerRequestID()
		if err != nil {
			return nil, err
		}
	}

	inputPayload := s.resolveRuntimeInput(schedule, req.Input)
	run, err := s.createAdhocRun(schedule, "manual", requestID, inputPayload, map[string]interface{}{
		"source": "manual_trigger",
	})
	if err != nil {
		return nil, err
	}

	s.executeRunAsync(run.ID)
	result := toRunResponse(run)
	return &result, nil
}

func (s *TaskScheduleService) InvokeWebhook(
	ctx context.Context,
	token string,
	rawBody []byte,
	input interface{},
	requestID string,
	signature string,
	clientIP string,
	userAgent string,
) (*TaskScheduleRunResponse, error) {
	schedule, err := s.getScheduleByWebhookToken(token)
	if err != nil {
		return nil, err
	}
	if !schedule.IsActive {
		return nil, ErrTaskScheduleNotFound
	}

	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return nil, fmt.Errorf("missing X-Request-Id")
	}

	if err := s.validateWebhookSignature(schedule, rawBody, signature); err != nil {
		return nil, err
	}
	if err := s.validateWebhookIP(schedule, clientIP); err != nil {
		return nil, err
	}

	inputPayload := s.resolveRuntimeInput(schedule, input)
	run, err := s.createAdhocRun(schedule, "webhook", requestID, inputPayload, map[string]interface{}{
		"source":    "webhook",
		"clientIp":  strings.TrimSpace(clientIP),
		"userAgent": strings.TrimSpace(userAgent),
	})
	if err != nil {
		return nil, err
	}

	s.executeRunAsync(run.ID)
	result := toRunResponse(run)
	return &result, nil
}

func (s *TaskScheduleService) StartScheduler(ctx context.Context) {
	if ctx == nil {
		ctx = context.Background()
	}

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	if err := s.scanDueSchedules(ctx); err != nil {
		log.Printf("task scheduler initial scan failed: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.scanDueSchedules(ctx); err != nil {
				log.Printf("task scheduler scan failed: %v", err)
			}
		}
	}
}

func (s *TaskScheduleService) scanDueSchedules(ctx context.Context) error {
	var ids []uint
	if err := s.db.Model(&taskModels.TaskSchedule{}).
		Where("trigger_type = ? AND is_active = ? AND next_run_at IS NOT NULL AND next_run_at <= ?", "cron", true, time.Now().UTC()).
		Order("next_run_at ASC").
		Limit(50).
		Pluck("id", &ids).Error; err != nil {
		return err
	}

	for _, id := range ids {
		if _, err := s.dequeueAndCreateCronRun(id); err != nil {
			log.Printf("task scheduler failed to enqueue schedule %d: %v", id, err)
		}
	}
	return nil
}

func (s *TaskScheduleService) dequeueAndCreateCronRun(scheduleID uint) (*taskModels.TaskScheduleRun, error) {
	var run taskModels.TaskScheduleRun
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var schedule taskModels.TaskSchedule
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&schedule, scheduleID).Error; err != nil {
			return err
		}
		if !schedule.IsActive || schedule.TriggerType != "cron" || schedule.NextRunAt == nil {
			return nil
		}

		now := time.Now().UTC()
		if schedule.NextRunAt.After(now) {
			return nil
		}
		if schedule.MaxRuns != nil && *schedule.MaxRuns > 0 && schedule.RunCount >= *schedule.MaxRuns {
			schedule.IsActive = false
			return tx.Save(&schedule).Error
		}

		dueAt := schedule.NextRunAt.UTC()
		triggerKey := "cron:" + dueAt.Format(time.RFC3339Nano)
		payload := copyJSONValue(jsonbValue(schedule.InputTemplate))
		run = taskModels.TaskScheduleRun{
			ScheduleID:   schedule.ID,
			WorkflowID:   schedule.WorkflowID,
			UserID:       schedule.UserID,
			TriggerType:  "cron",
			TriggerKey:   triggerKey,
			Status:       "queued",
			InputPayload: jsonbFromAny(payload),
			TriggeredAt:  now,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := tx.Create(&run).Error; err != nil {
			if isUniqueViolation(err) {
				return nil
			}
			return err
		}

		schedule.RunCount++
		nextRunAt, active, err := computeNextRunForSchedule(&schedule, dueAt)
		if err != nil {
			return err
		}
		schedule.NextRunAt = nextRunAt
		schedule.IsActive = active
		schedule.UpdatedAt = now
		return tx.Save(&schedule).Error
	})
	if err != nil {
		return nil, err
	}

	if run.ID > 0 {
		s.executeRunAsync(run.ID)
		return &run, nil
	}
	return nil, nil
}

func (s *TaskScheduleService) createAdhocRun(
	schedule *taskModels.TaskSchedule,
	triggerType string,
	requestID string,
	inputPayload interface{},
	metadata map[string]interface{},
) (*taskModels.TaskScheduleRun, error) {
	now := time.Now().UTC()
	if requestID == "" {
		generated, err := generateTriggerRequestID()
		if err != nil {
			return nil, err
		}
		requestID = generated
	}

	run := &taskModels.TaskScheduleRun{
		ScheduleID:   schedule.ID,
		WorkflowID:   schedule.WorkflowID,
		UserID:       schedule.UserID,
		TriggerType:  triggerType,
		TriggerKey:   triggerType + ":" + requestID,
		RequestID:    &requestID,
		Status:       "queued",
		InputPayload: jsonbFromAny(inputPayload),
		Metadata:     jsonbFromAny(metadata),
		TriggeredAt:  now,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	err := s.db.Create(run).Error
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrTaskScheduleReplayBlocked
		}
		return nil, err
	}

	return run, nil
}

func (s *TaskScheduleService) executeRunAsync(runID uint) {
	go func() {
		if err := s.executeRun(context.Background(), runID); err != nil {
			log.Printf("task schedule run %d failed: %v", runID, err)
		}
	}()
}

func (s *TaskScheduleService) executeRun(ctx context.Context, runID uint) error {
	var run taskModels.TaskScheduleRun
	if err := s.db.First(&run, runID).Error; err != nil {
		return err
	}

	var schedule taskModels.TaskSchedule
	if err := s.db.First(&schedule, run.ScheduleID).Error; err != nil {
		return err
	}

	policy := normalizeRetryPolicy(schedule.RetryPolicy)
	var lastErr string
	var lastTaskID uint

	for attempt := 1; attempt <= policy.MaxRetries+1; attempt++ {
		now := time.Now().UTC()
		run.AttemptCount = attempt
		run.Status = "running"
		run.ErrorMessage = nil
		run.UpdatedAt = now
		if err := s.db.Save(&run).Error; err != nil {
			return err
		}

		requestID := ""
		if run.RequestID != nil {
			requestID = *run.RequestID
		}
		execReq, err := s.buildExecutionRequest(&schedule, &run, runInputPayload(run.InputPayload), requestID, attempt)
		if err != nil {
			lastErr = err.Error()
			break
		}
		if err := s.executor.ValidateExecutionRequest(execReq); err != nil {
			return s.finalizeRun(&run, &schedule, optionalUintPtr(lastTaskID), "failed", err.Error())
		}

		taskID := uint(0)
		execReq.OnTaskCreated = func(id uint) {
			taskID = id
			lastTaskID = id
			run.TaskID = &id
			_ = s.db.Model(&taskModels.TaskScheduleRun{}).Where("id = ?", run.ID).Updates(map[string]interface{}{
				"task_id":       id,
				"attempt_count": attempt,
				"updated_at":    time.Now().UTC(),
			}).Error
			s.attachTaskScheduleMetadata(id, &schedule, &run, attempt)
		}

		if err := s.executor.ExecuteWorkflowStreamConcurrent(ctx, execReq, func(string, string, bool, string, error) {}); err != nil {
			return s.finalizeRun(&run, &schedule, optionalUintPtr(taskID), "failed", err.Error())
		}
		status, errMessage := s.resolveRunFinalStatus(taskID)
		lastErr = errMessage
		if status == "completed" {
			return s.finalizeRun(&run, &schedule, optionalUintPtr(taskID), status, "")
		}
		if attempt > policy.MaxRetries {
			return s.finalizeRun(&run, &schedule, optionalUintPtr(taskID), status, errMessage)
		}

		run.Status = "queued"
		run.ErrorMessage = stringPtr(errMessage)
		run.UpdatedAt = time.Now().UTC()
		if err := s.db.Save(&run).Error; err != nil {
			return err
		}
		time.Sleep(retryDelay(policy, attempt))
	}

	return s.finalizeRun(&run, &schedule, optionalUintPtr(lastTaskID), "failed", lastErr)
}

func (s *TaskScheduleService) finalizeRun(
	run *taskModels.TaskScheduleRun,
	schedule *taskModels.TaskSchedule,
	taskID *uint,
	status string,
	errMessage string,
) error {
	now := time.Now().UTC()
	run.Status = status
	run.TaskID = optionalUintPtrFromPtr(taskID)
	run.FinishedAt = &now
	run.UpdatedAt = now
	run.ErrorMessage = stringPtr(errMessage)

	schedule.LastRunAt = &now
	schedule.LastRunStatus = stringPtr(status)
	schedule.LastTriggerRequest = run.RequestID
	schedule.LastErrorMessage = run.ErrorMessage
	schedule.UpdatedAt = now

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(run).Error; err != nil {
			return err
		}
		return tx.Save(schedule).Error
	})
}

func (s *TaskScheduleService) resolveRunFinalStatus(taskID uint) (string, string) {
	if taskID == 0 {
		return "failed", "task was not created"
	}

	task, err := s.taskRepo.GetTaskByID(taskID)
	if err != nil {
		return "failed", err.Error()
	}

	switch task.Status {
	case "completed":
		return "completed", ""
	case "cancelled":
		if task.ErrorMessage != nil {
			return "cancelled", *task.ErrorMessage
		}
		return "cancelled", "task cancelled"
	case "failed", "timeout":
		if task.ErrorMessage != nil {
			return "failed", *task.ErrorMessage
		}
		return "failed", "task failed"
	default:
		if task.ErrorMessage != nil {
			return "failed", *task.ErrorMessage
		}
		return "failed", "task did not complete successfully"
	}
}

func (s *TaskScheduleService) buildExecutionRequest(
	schedule *taskModels.TaskSchedule,
	run *taskModels.TaskScheduleRun,
	input interface{},
	requestID string,
	attempt int,
) (workflowServices.ExecutionRequest, error) {
	canvas, err := s.workflowSvc.GetWorkflowNodes(schedule.WorkflowID)
	if err != nil {
		return workflowServices.ExecutionRequest{}, err
	}

	nodes := make([]workflowServices.NodeConfig, 0, len(canvas.Nodes))
	for _, node := range canvas.Nodes {
		configMap := map[string]interface{}{}
		if node.Data != nil {
			if rawConfig, ok := node.Data["config"].(map[string]interface{}); ok {
				configMap = rawConfig
			}
		}
		nodes = append(nodes, workflowServices.NodeConfig{
			ID:     node.ID,
			Type:   node.Type,
			Config: configMap,
		})
	}

	edges := make([]workflowServices.EdgeConfig, 0, len(canvas.Edges))
	for _, edge := range canvas.Edges {
		edges = append(edges, workflowServices.EdgeConfig{
			Source:       edge.Source,
			Target:       edge.Target,
			SourceHandle: edge.SourceHandle,
			TargetHandle: edge.TargetHandle,
		})
	}

	return workflowServices.ExecutionRequest{
		Nodes:        nodes,
		Edges:        edges,
		UserID:       schedule.UserID,
		WorkflowID:   schedule.WorkflowID,
		RuntimeInput: input,
		RuntimeMeta: map[string]interface{}{
			"source":        run.TriggerType,
			"scheduleId":    schedule.ID,
			"scheduleRunId": run.ID,
			"requestId":     requestID,
			"attempt":       attempt,
		},
	}, nil
}

func (s *TaskScheduleService) attachTaskScheduleMetadata(taskID uint, schedule *taskModels.TaskSchedule, run *taskModels.TaskScheduleRun, attempt int) {
	task, err := s.taskRepo.GetTaskByID(taskID)
	if err != nil {
		return
	}

	task.ScheduleID = &schedule.ID
	name := fmt.Sprintf("%s [%s]", schedule.Name, strings.ToUpper(run.TriggerType))
	task.Name = &name

	metadata := map[string]interface{}{}
	if task.Metadata != nil {
		if existing, ok := task.Metadata.Data.(map[string]interface{}); ok {
			for key, value := range existing {
				metadata[key] = value
			}
		}
	}
	metadata["triggerSource"] = run.TriggerType
	metadata["scheduleId"] = schedule.ID
	metadata["scheduleRunId"] = run.ID
	metadata["attempt"] = attempt
	if run.RequestID != nil {
		metadata["requestId"] = *run.RequestID
	}
	task.Metadata = &shared.JSONB{Data: metadata}
	task.UpdatedAt = time.Now().UTC()
	_ = s.taskRepo.UpdateTask(task)
}

func (s *TaskScheduleService) getOwnedWorkflow(userID uint, workflowID uint) (*workflowModels.Workflow, error) {
	var workflow workflowModels.Workflow
	if err := s.db.Where("id = ? AND user_id = ?", workflowID, userID).First(&workflow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTaskScheduleNotFound
		}
		return nil, err
	}
	return &workflow, nil
}

func (s *TaskScheduleService) getOwnedSchedule(userID uint, scheduleID uint) (*taskModels.TaskSchedule, error) {
	var schedule taskModels.TaskSchedule
	if err := s.db.Where("id = ? AND user_id = ?", scheduleID, userID).First(&schedule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTaskScheduleNotFound
		}
		return nil, err
	}
	return &schedule, nil
}

func (s *TaskScheduleService) getScheduleByWebhookToken(token string) (*taskModels.TaskSchedule, error) {
	var schedule taskModels.TaskSchedule
	if err := s.db.Where("webhook_token = ? AND trigger_type = ?", strings.TrimSpace(token), "webhook").First(&schedule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTaskScheduleNotFound
		}
		return nil, err
	}
	return &schedule, nil
}

func (s *TaskScheduleService) validateWebhookSignature(schedule *taskModels.TaskSchedule, rawBody []byte, signature string) error {
	if schedule.WebhookSecretEnc == nil || strings.TrimSpace(*schedule.WebhookSecretEnc) == "" {
		return ErrTaskScheduleBadSignature
	}

	secret, err := aiUtils.DecryptAPIKey(*schedule.WebhookSecretEnc)
	if err != nil {
		return err
	}

	signature = strings.TrimSpace(signature)
	signature = strings.TrimPrefix(signature, "sha256=")
	if signature == "" {
		return ErrTaskScheduleBadSignature
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(strings.ToLower(expected)), []byte(strings.ToLower(signature))) {
		return ErrTaskScheduleBadSignature
	}

	return nil
}

func (s *TaskScheduleService) validateWebhookIP(schedule *taskModels.TaskSchedule, clientIP string) error {
	whitelist := extractIPWhitelist(schedule.Config)
	if len(whitelist) == 0 {
		return nil
	}

	clientIP = strings.TrimSpace(clientIP)
	if clientIP == "" {
		return ErrTaskScheduleForbiddenIP
	}

	ip := net.ParseIP(clientIP)
	if ip == nil {
		return ErrTaskScheduleForbiddenIP
	}

	for _, item := range whitelist {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if strings.Contains(item, "/") {
			if _, network, err := net.ParseCIDR(item); err == nil && network.Contains(ip) {
				return nil
			}
			continue
		}
		if item == clientIP {
			return nil
		}
	}

	return ErrTaskScheduleForbiddenIP
}

func (s *TaskScheduleService) applyScheduleConfig(schedule *taskModels.TaskSchedule, patch interface{}, isCreate bool) (*string, error) {
	triggerType := schedule.TriggerType
	cronExpression := schedule.CronExpression
	timezone := schedule.Timezone
	isActive := schedule.IsActive
	rotateSecret := false

	switch req := patch.(type) {
	case CreateTaskScheduleRequest:
		triggerType = normalizeTriggerType(req.TriggerType)
		cronExpression = strings.TrimSpace(req.CronExpression)
		if req.SchedulePlan != nil {
			derivedCron, err := cronExpressionFromSchedulePlan(req.SchedulePlan)
			if err != nil {
				return nil, err
			}
			cronExpression = derivedCron
		}
		timezone = normalizeTimezone(req.Timezone)
		if req.IsActive == nil {
			isActive = true
		} else {
			isActive = *req.IsActive
		}
		schedule.StartDate = req.StartDate
		schedule.EndDate = req.EndDate
		schedule.MaxRuns = normalizePositiveIntPtr(req.MaxRuns)
		schedule.Config = jsonbFromAny(req.Config)
		schedule.NotificationConfig = jsonbFromAny(req.NotificationConfig)
		schedule.RetryPolicy = jsonbFromRetryPolicy(normalizeRetryPolicy(jsonbFromAny(req.RetryPolicy)))
		schedule.InputTemplate = jsonbFromAny(req.InputTemplate)
	case UpdateTaskScheduleRequest:
		if req.Name != nil {
			schedule.Name = strings.TrimSpace(*req.Name)
		}
		if req.Description != nil {
			schedule.Description = trimOptionalString(req.Description)
		}
		if req.TriggerType != nil {
			triggerType = normalizeTriggerType(*req.TriggerType)
		}
		if req.CronExpression != nil {
			cronExpression = strings.TrimSpace(*req.CronExpression)
		}
		if req.SchedulePlan != nil {
			derivedCron, err := cronExpressionFromSchedulePlan(req.SchedulePlan)
			if err != nil {
				return nil, err
			}
			cronExpression = derivedCron
		}
		if req.Timezone != nil {
			timezone = normalizeTimezone(*req.Timezone)
		}
		if req.IsActive != nil {
			isActive = *req.IsActive
		}
		if req.StartDate != nil {
			schedule.StartDate = req.StartDate
		}
		if req.EndDate != nil {
			schedule.EndDate = req.EndDate
		}
		if req.MaxRuns != nil {
			schedule.MaxRuns = normalizePositiveIntPtr(req.MaxRuns)
		}
		if req.Config != nil {
			schedule.Config = jsonbFromAny(req.Config)
		}
		if req.NotificationConfig != nil {
			schedule.NotificationConfig = jsonbFromAny(req.NotificationConfig)
		}
		if req.RetryPolicy != nil {
			schedule.RetryPolicy = jsonbFromRetryPolicy(normalizeRetryPolicy(jsonbFromAny(req.RetryPolicy)))
		}
		if req.InputTemplate != nil {
			schedule.InputTemplate = jsonbFromAny(req.InputTemplate)
		}
		rotateSecret = req.RotateWebhookSecret
	default:
		return nil, fmt.Errorf("unsupported schedule patch")
	}

	if strings.TrimSpace(schedule.Name) == "" {
		return nil, fmt.Errorf("schedule name is required")
	}
	if schedule.StartDate != nil && schedule.EndDate != nil && schedule.EndDate.Before(*schedule.StartDate) {
		return nil, fmt.Errorf("endDate must be after startDate")
	}

	schedule.TriggerType = normalizeTriggerType(triggerType)
	schedule.CronExpression = cronExpression
	schedule.Timezone = timezone
	schedule.IsActive = isActive

	switch schedule.TriggerType {
	case "cron":
		if strings.TrimSpace(schedule.CronExpression) == "" {
			return nil, fmt.Errorf("cronExpression is required")
		}
		nextRunAt, active, err := computeNextRunForSchedule(schedule, time.Now().UTC())
		if err != nil {
			return nil, err
		}
		schedule.NextRunAt = nextRunAt
		schedule.IsActive = schedule.IsActive && active
		schedule.WebhookToken = nil
		schedule.WebhookSecretHash = nil
		schedule.WebhookSecretEnc = nil
		return nil, nil
	case "webhook":
		schedule.CronExpression = ""
		schedule.NextRunAt = nil
		if schedule.Timezone == "" {
			schedule.Timezone = "UTC"
		}
		if schedule.WebhookToken == nil || strings.TrimSpace(*schedule.WebhookToken) == "" || rotateSecret || isCreate {
			token, secret, err := generateWebhookCredentials()
			if err != nil {
				return nil, err
			}
			secretHash := hashSensitive(secret)
			secretEnc, err := aiUtils.EncryptAPIKey(secret)
			if err != nil {
				return nil, err
			}
			schedule.WebhookToken = &token
			schedule.WebhookSecretHash = &secretHash
			schedule.WebhookSecretEnc = &secretEnc
			return &secret, nil
		}
		return nil, nil
	default:
		return nil, fmt.Errorf("unsupported triggerType")
	}
}

func (s *TaskScheduleService) resolveRuntimeInput(schedule *taskModels.TaskSchedule, payload interface{}) interface{} {
	template := jsonbValue(schedule.InputTemplate)
	if payload == nil {
		return copyJSONValue(template)
	}
	if template == nil {
		return copyJSONValue(payload)
	}

	templateMap, okTemplate := copyJSONValue(template).(map[string]interface{})
	payloadMap, okPayload := copyJSONValue(payload).(map[string]interface{})
	if okTemplate && okPayload {
		merged := make(map[string]interface{}, len(templateMap)+len(payloadMap)+1)
		for key, value := range templateMap {
			merged[key] = value
		}
		for key, value := range payloadMap {
			merged[key] = value
		}
		if _, exists := merged["_payload"]; !exists {
			merged["_payload"] = payloadMap
		}
		return merged
	}

	if okTemplate {
		templateMap["_payload"] = copyJSONValue(payload)
		return templateMap
	}

	return map[string]interface{}{
		"template": copyJSONValue(template),
		"payload":  copyJSONValue(payload),
	}
}

func (s *TaskScheduleService) toScheduleResponse(schedule *taskModels.TaskSchedule, baseURL string) TaskScheduleResponse {
	response := TaskScheduleResponse{
		ID:                   schedule.ID,
		WorkflowID:           schedule.WorkflowID,
		UserID:               schedule.UserID,
		Name:                 schedule.Name,
		Description:          schedule.Description,
		TriggerType:          schedule.TriggerType,
		CronExpression:       schedule.CronExpression,
		SchedulePlan:         schedulePlanFromCronExpression(schedule.CronExpression),
		Timezone:             schedule.Timezone,
		IsActive:             schedule.IsActive,
		StartDate:            schedule.StartDate,
		EndDate:              schedule.EndDate,
		MaxRuns:              schedule.MaxRuns,
		RunCount:             schedule.RunCount,
		NextRunAt:            schedule.NextRunAt,
		LastRunAt:            schedule.LastRunAt,
		LastRunStatus:        schedule.LastRunStatus,
		LastErrorMessage:     schedule.LastErrorMessage,
		LastTriggerRequestID: schedule.LastTriggerRequest,
		WebhookToken:         schedule.WebhookToken,
		Config:               jsonbValue(schedule.Config),
		NotificationConfig:   jsonbValue(schedule.NotificationConfig),
		RetryPolicy:          jsonbValue(schedule.RetryPolicy),
		InputTemplate:        jsonbValue(schedule.InputTemplate),
		CreatedAt:            schedule.CreatedAt,
		UpdatedAt:            schedule.UpdatedAt,
	}
	if schedule.WebhookToken != nil && strings.TrimSpace(*schedule.WebhookToken) != "" {
		webhookURL := buildWebhookURL(baseURL, *schedule.WebhookToken)
		response.WebhookURL = &webhookURL
	}
	return response
}

func toRunResponse(run *taskModels.TaskScheduleRun) TaskScheduleRunResponse {
	return TaskScheduleRunResponse{
		ID:           run.ID,
		ScheduleID:   run.ScheduleID,
		WorkflowID:   run.WorkflowID,
		UserID:       run.UserID,
		TriggerType:  run.TriggerType,
		TriggerKey:   run.TriggerKey,
		RequestID:    run.RequestID,
		Status:       run.Status,
		TaskID:       run.TaskID,
		AttemptCount: run.AttemptCount,
		ErrorMessage: run.ErrorMessage,
		InputPayload: jsonbValue(run.InputPayload),
		Metadata:     jsonbValue(run.Metadata),
		TriggeredAt:  run.TriggeredAt,
		FinishedAt:   run.FinishedAt,
		CreatedAt:    run.CreatedAt,
		UpdatedAt:    run.UpdatedAt,
	}
}

func computeNextRunForSchedule(schedule *taskModels.TaskSchedule, from time.Time) (*time.Time, bool, error) {
	if schedule.TriggerType != "cron" {
		return nil, schedule.IsActive, nil
	}

	loc, err := time.LoadLocation(normalizeTimezone(schedule.Timezone))
	if err != nil {
		return nil, false, fmt.Errorf("invalid timezone: %w", err)
	}
	spec, err := taskScheduleCronParser.Parse(strings.TrimSpace(schedule.CronExpression))
	if err != nil {
		return nil, false, fmt.Errorf("invalid cron expression: %w", err)
	}

	start := from.In(loc)
	if schedule.StartDate != nil && start.Before(schedule.StartDate.In(loc)) {
		start = schedule.StartDate.In(loc).Add(-time.Second)
	}
	next := spec.Next(start)
	if schedule.EndDate != nil && next.After(schedule.EndDate.In(loc)) {
		return nil, false, nil
	}

	value := next.UTC()
	return &value, true, nil
}

func normalizeTriggerType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "webhook":
		return "webhook"
	default:
		return "cron"
	}
}

func normalizeTimezone(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "UTC"
	}
	return value
}

func cronExpressionFromSchedulePlan(plan *TaskSchedulePlan) (string, error) {
	if plan == nil {
		return "", fmt.Errorf("schedulePlan is required")
	}

	parts := strings.Split(strings.TrimSpace(plan.Time), ":")
	if len(parts) != 2 {
		return "", fmt.Errorf("schedulePlan.time must be HH:mm")
	}
	hour, err := strconv.Atoi(parts[0])
	if err != nil || hour < 0 || hour > 23 {
		return "", fmt.Errorf("schedulePlan.time hour must be between 0 and 23")
	}
	minute, err := strconv.Atoi(parts[1])
	if err != nil || minute < 0 || minute > 59 {
		return "", fmt.Errorf("schedulePlan.time minute must be between 0 and 59")
	}

	switch strings.ToLower(strings.TrimSpace(plan.Frequency)) {
	case "daily", "":
		return fmt.Sprintf("%d %d * * *", minute, hour), nil
	case "weekly":
		if len(plan.Weekdays) == 0 {
			return "", fmt.Errorf("schedulePlan.weekdays is required for weekly plans")
		}
		seen := map[int]bool{}
		weekdays := make([]string, 0, len(plan.Weekdays))
		for _, day := range plan.Weekdays {
			if day < 0 || day > 6 {
				return "", fmt.Errorf("schedulePlan.weekdays must be between 0 and 6")
			}
			if seen[day] {
				continue
			}
			seen[day] = true
			weekdays = append(weekdays, strconv.Itoa(day))
		}
		sort.Strings(weekdays)
		return fmt.Sprintf("%d %d * * %s", minute, hour, strings.Join(weekdays, ",")), nil
	case "monthly":
		day := 1
		if plan.MonthDay != nil {
			day = *plan.MonthDay
		}
		if day < 1 || day > 31 {
			return "", fmt.Errorf("schedulePlan.monthDay must be between 1 and 31")
		}
		return fmt.Sprintf("%d %d %d * *", minute, hour, day), nil
	default:
		return "", fmt.Errorf("unsupported schedulePlan.frequency")
	}
}

func schedulePlanFromCronExpression(expression string) *TaskSchedulePlan {
	fields := strings.Fields(strings.TrimSpace(expression))
	if len(fields) != 5 {
		return nil
	}
	minute, errMinute := strconv.Atoi(fields[0])
	hour, errHour := strconv.Atoi(fields[1])
	if errMinute != nil || errHour != nil || minute < 0 || minute > 59 || hour < 0 || hour > 23 {
		return nil
	}
	timeValue := fmt.Sprintf("%02d:%02d", hour, minute)
	if fields[2] == "*" && fields[3] == "*" && fields[4] == "*" {
		return &TaskSchedulePlan{Frequency: "daily", Time: timeValue}
	}
	if fields[2] == "*" && fields[3] == "*" && fields[4] != "*" {
		rawWeekdays := strings.Split(fields[4], ",")
		weekdays := make([]int, 0, len(rawWeekdays))
		for _, raw := range rawWeekdays {
			day, err := strconv.Atoi(strings.TrimSpace(raw))
			if err != nil || day < 0 || day > 6 {
				return nil
			}
			weekdays = append(weekdays, day)
		}
		return &TaskSchedulePlan{Frequency: "weekly", Time: timeValue, Weekdays: weekdays}
	}
	if fields[2] != "*" && fields[3] == "*" && fields[4] == "*" {
		day, err := strconv.Atoi(fields[2])
		if err != nil || day < 1 || day > 31 {
			return nil
		}
		return &TaskSchedulePlan{Frequency: "monthly", Time: timeValue, MonthDay: &day}
	}
	return nil
}

func normalizePositiveIntPtr(value *int) *int {
	if value == nil {
		return nil
	}
	if *value <= 0 {
		return nil
	}
	normalized := *value
	return &normalized
}

func trimOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func jsonbFromAny(value interface{}) *shared.JSONB {
	if value == nil {
		return nil
	}
	return &shared.JSONB{Data: copyJSONValue(value)}
}

func jsonbValue(value *shared.JSONB) interface{} {
	if value == nil {
		return nil
	}
	return value.Data
}

func runInputPayload(value *shared.JSONB) interface{} {
	if value == nil {
		return nil
	}
	return value.Data
}

func copyJSONValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var copied interface{}
	if err := json.Unmarshal(raw, &copied); err != nil {
		return value
	}
	return copied
}

func normalizeRetryPolicy(value *shared.JSONB) RetryPolicy {
	policy := RetryPolicy{
		Mode:            "none",
		MaxRetries:      0,
		DelaySeconds:    15,
		MaxDelaySeconds: 300,
	}
	if value == nil || value.Data == nil {
		return policy
	}

	payload, ok := value.Data.(map[string]interface{})
	if !ok {
		return policy
	}

	if mode, ok := payload["mode"].(string); ok {
		mode = strings.ToLower(strings.TrimSpace(mode))
		if mode == "fixed" || mode == "exponential" {
			policy.Mode = mode
		}
	}
	if maxRetries, ok := readInt(payload["maxRetries"]); ok && maxRetries > 0 {
		policy.MaxRetries = maxRetries
	}
	if delaySeconds, ok := readInt(payload["delaySeconds"]); ok && delaySeconds > 0 {
		policy.DelaySeconds = delaySeconds
	}
	if maxDelaySeconds, ok := readInt(payload["maxDelaySeconds"]); ok && maxDelaySeconds > 0 {
		policy.MaxDelaySeconds = maxDelaySeconds
	}

	return policy
}

func jsonbFromRetryPolicy(policy RetryPolicy) *shared.JSONB {
	return &shared.JSONB{Data: map[string]interface{}{
		"mode":            policy.Mode,
		"maxRetries":      policy.MaxRetries,
		"delaySeconds":    policy.DelaySeconds,
		"maxDelaySeconds": policy.MaxDelaySeconds,
	}}
}

func retryDelay(policy RetryPolicy, attempt int) time.Duration {
	delay := policy.DelaySeconds
	if policy.Mode == "exponential" {
		delay = int(math.Round(float64(policy.DelaySeconds) * math.Pow(2, float64(attempt-1))))
	}
	if policy.MaxDelaySeconds > 0 && delay > policy.MaxDelaySeconds {
		delay = policy.MaxDelaySeconds
	}
	if delay <= 0 {
		delay = 1
	}
	return time.Duration(delay) * time.Second
}

func readInt(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int32:
		return int(typed), true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	default:
		return 0, false
	}
}

func buildWebhookURL(baseURL string, token string) string {
	return strings.TrimRight(baseURL, "/") + "/open-api/v1/triggers/" + token + "/invoke"
}

func generateWebhookCredentials() (string, string, error) {
	tokenBytes := make([]byte, 18)
	secretBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", "", err
	}
	if _, err := rand.Read(secretBytes); err != nil {
		return "", "", err
	}
	return "trg_" + hex.EncodeToString(tokenBytes), "trgsec_" + hex.EncodeToString(secretBytes), nil
}

func generateTriggerRequestID() (string, error) {
	raw := make([]byte, 12)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return "tsr_" + hex.EncodeToString(raw), nil
}

func hashSensitive(raw string) string {
	pepper := config.OpenAPIKeyPepper
	if strings.TrimSpace(pepper) == "" {
		pepper = config.JWTSecret
	}
	sum := sha256.Sum256([]byte(pepper + ":" + raw))
	return hex.EncodeToString(sum[:])
}

func extractIPWhitelist(value *shared.JSONB) []string {
	if value == nil || value.Data == nil {
		return nil
	}
	configMap, ok := value.Data.(map[string]interface{})
	if !ok {
		return nil
	}
	raw, ok := configMap["ipWhitelist"]
	if !ok {
		raw = configMap["ip_whitelist"]
	}
	list, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	result := make([]string, 0, len(list))
	for _, item := range list {
		if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
			result = append(result, strings.TrimSpace(text))
		}
	}
	return result
}

func stringPtr(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func optionalUintPtr(value uint) *uint {
	if value == 0 {
		return nil
	}
	return &value
}

func optionalUintPtrFromPtr(value *uint) *uint {
	if value == nil || *value == 0 {
		return nil
	}
	cloned := *value
	return &cloned
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique constraint")
}
