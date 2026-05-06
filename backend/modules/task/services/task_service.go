package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"yaolight-workshop/backend/infrastructure/database"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	"yaolight-workshop/backend/modules/task/models"
	"yaolight-workshop/backend/modules/task/repositories"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

var (
	ErrTaskNotOwned       = errors.New("task does not belong to current user")
	ErrTaskActionNotAllow = errors.New("task action not allowed for current status")
)

type TaskActionResponse struct {
	TaskID  uint   `json:"task_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

// TaskWithMetadata 带元数据的任务（包含序号和AI信息）
type TaskWithMetadata struct {
	models.Task
	SequenceNumber int    `json:"sequenceNumber"` // 工作流内序号
	Provider       string `json:"provider"`       // AI供应商（如果有AI节点）
	ModelName      string `json:"modelName"`      // AI模型名称（如果有AI节点）
	ProviderIcon   string `json:"providerIcon,omitempty"`
	ModelIcon      string `json:"modelIcon,omitempty"`
}

// TaskService 任务服务
type TaskService struct {
	taskRepo          repositories.TaskRepository
	nodeExecutionRepo repositories.TaskNodeExecutionRepository
	logRepo           repositories.TaskLogRepository
	workflowService   workflowServiceAdapter
	executor          *workflowServices.WorkflowExecutor
}

type workflowServiceAdapter interface {
	GetWorkflowNodes(workflowID uint) (*workflowServices.SaveWorkflowNodesRequest, error)
}

// NewTaskService 创建任务服务实例
func NewTaskService(
	taskRepo repositories.TaskRepository,
	nodeExecutionRepo repositories.TaskNodeExecutionRepository,
	logRepo repositories.TaskLogRepository,
) *TaskService {
	return &TaskService{
		taskRepo:          taskRepo,
		nodeExecutionRepo: nodeExecutionRepo,
		logRepo:           logRepo,
	}
}

func (s *TaskService) SetWorkflowExecutionServices(workflowService workflowServiceAdapter, executor *workflowServices.WorkflowExecutor) {
	s.workflowService = workflowService
	s.executor = executor
}

// TaskListResponse 任务列表响应
type TaskListResponse struct {
	Tasks []TaskWithMetadata `json:"tasks"`
	Total int64              `json:"total"`
	Page  int                `json:"page"`
	Limit int                `json:"limit"`
}

// GetWorkflowTasks 获取工作流的任务列表
func (s *TaskService) GetWorkflowTasks(workflowID uint, page, limit int) (*TaskListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20 // 默认每页20条
	}

	offset := (page - 1) * limit

	tasks, total, err := s.taskRepo.GetTasksByWorkflowID(workflowID, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("获取任务列表失败: %w", err)
	}

	// 转换为带元数据的任务列表
	tasksWithMetadata := make([]TaskWithMetadata, len(tasks))
	for i, task := range tasks {
		// 计算工作流内序号：总数 - 当前页偏移 - 当前索引
		// 因为任务是按创建时间倒序排列的，所以最新的任务序号最大
		sequenceNumber := int(total) - offset - i

		// 从节点执行记录中提取AI供应商和模型信息
		provider, modelName, providerIcon, modelIcon := s.extractAIInfo(task.ID)

		tasksWithMetadata[i] = TaskWithMetadata{
			Task:           task,
			SequenceNumber: sequenceNumber,
			Provider:       provider,
			ModelName:      modelName,
			ProviderIcon:   providerIcon,
			ModelIcon:      modelIcon,
		}
	}

	return &TaskListResponse{
		Tasks: tasksWithMetadata,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// extractAIInfo 从节点执行记录中提取AI供应商和模型信息
func (s *TaskService) extractAIInfo(taskID uint) (provider, modelName, providerIcon, modelIcon string) {
	executions, err := s.nodeExecutionRepo.GetByTaskID(taskID)
	if err != nil {
		return "", "", "", ""
	}

	// 查找AI节点的执行记录（优先查找已完成的）
	for _, exec := range executions {
		if exec.NodeType == "ai" && exec.Status == "completed" {
			// 从输出数据中提取模型信息
			if exec.OutputData != nil && exec.OutputData.Data != nil {
				if outputMap, ok := exec.OutputData.Data.(map[string]interface{}); ok {
					// 尝试从输出中获取模型名称
					if model, ok := outputMap["model"].(string); ok && model != "" {
						modelName = model
					}
					if icon, ok := outputMap["providerIcon"].(string); ok && icon != "" {
						providerIcon = icon
					}
					if icon, ok := outputMap["modelIcon"].(string); ok && icon != "" {
						modelIcon = icon
					}
					if p, ok := outputMap["provider"].(string); ok && p != "" && provider == "" {
						provider = p
					}
				}
			}

			// 从输入数据中提取供应商信息（节点配置可能保存在输入数据中）
			if exec.InputData != nil && exec.InputData.Data != nil {
				if inputMap, ok := exec.InputData.Data.(map[string]interface{}); ok {
					// 尝试从输入数据中获取provider
					if p, ok := inputMap["provider"].(string); ok && p != "" {
						provider = p
					}
					// 也尝试从config字段中获取
					if config, ok := inputMap["config"].(map[string]interface{}); ok {
						if p, ok := config["provider"].(string); ok && p != "" {
							provider = p
						}
						if m, ok := config["modelName"].(string); ok && m != "" && modelName == "" {
							modelName = m
						}
					}
				}
			}

			// 如果从输出数据中获取到了模型名称，尝试从模型名称推断供应商
			if provider == "" && modelName != "" {
				provider = inferProviderFromModel(modelName)
			}
			if providerIcon == "" || (modelIcon == "" && modelName != "") {
				resolvedProviderIcon, resolvedModelIcon := resolveAIIcons(provider, modelName)
				if providerIcon == "" {
					providerIcon = resolvedProviderIcon
				}
				if modelIcon == "" {
					modelIcon = resolvedModelIcon
				}
			}

			// 如果找到了AI节点信息，返回第一个找到的信息
			if provider != "" || modelName != "" {
				return provider, modelName, providerIcon, modelIcon
			}
		}
	}

	// 如果没找到已完成的，查找所有AI节点（包括运行中的）
	for _, exec := range executions {
		if exec.NodeType == "ai" {
			// 从输入数据中提取供应商信息
			if exec.InputData != nil && exec.InputData.Data != nil {
				if inputMap, ok := exec.InputData.Data.(map[string]interface{}); ok {
					if p, ok := inputMap["provider"].(string); ok && p != "" {
						provider = p
					}
					if config, ok := inputMap["config"].(map[string]interface{}); ok {
						if p, ok := config["provider"].(string); ok && p != "" {
							provider = p
						}
						if m, ok := config["modelName"].(string); ok && m != "" {
							modelName = m
						}
					}
				}
			}

			if provider != "" || modelName != "" {
				resolvedProviderIcon, resolvedModelIcon := resolveAIIcons(provider, modelName)
				return provider, modelName, resolvedProviderIcon, resolvedModelIcon
			}
		}
	}

	return "", "", "", ""
}

// inferProviderFromModel 从模型名称推断供应商
func inferProviderFromModel(modelName string) string {
	modelLower := strings.ToLower(modelName)
	if len(modelLower) == 0 {
		return ""
	}

	// 简单的模型名称匹配逻辑
	if strings.Contains(modelLower, "deepseek") {
		return "deepseek"
	} else if strings.Contains(modelLower, "doubao") || strings.Contains(modelLower, "seed") {
		return "doubao"
	} else if strings.Contains(modelLower, "qwen") || strings.Contains(modelLower, "qianwen") {
		return "qwen"
	} else if strings.Contains(modelLower, "zhipu") || strings.Contains(modelLower, "glm") {
		return "zhipuai"
	} else if strings.Contains(modelLower, "gemini") {
		return "gemini"
	} else if strings.Contains(modelLower, "gpt") || strings.Contains(modelLower, "openai") {
		return "openai"
	} else if strings.Contains(modelLower, "grok") {
		return "grok"
	} else if strings.Contains(modelLower, "spark") {
		return "spark"
	} else if strings.Contains(modelLower, "hunyuan") {
		return "hunyuan"
	} else if strings.Contains(modelLower, "claude") || strings.Contains(modelLower, "anthropic") {
		return "claude"
	}

	return ""
}

func resolveAIIcons(provider, modelName string) (providerIcon, modelIcon string) {
	if strings.TrimSpace(provider) != "" {
		var template aiModels.ProviderTemplate
		if err := database.DB.
			Where("provider = ?", provider).
			Select("icon").
			First(&template).Error; err == nil && template.Icon != nil {
			providerIcon = strings.TrimSpace(*template.Icon)
		}
	}

	if strings.TrimSpace(provider) != "" && strings.TrimSpace(modelName) != "" {
		var managed aiModels.ManagedAIModel
		if err := database.DB.
			Where("provider = ? AND model_name = ?", provider, modelName).
			Select("model_icon").
			First(&managed).Error; err == nil && managed.ModelIcon != nil {
			modelIcon = strings.TrimSpace(*managed.ModelIcon)
		}
	}

	return providerIcon, modelIcon
}

// GetTaskDetail 获取任务详情
func (s *TaskService) GetTaskDetail(taskID uint) (*models.Task, error) {
	task, err := s.taskRepo.GetTaskByID(taskID)
	if err != nil {
		return nil, fmt.Errorf("获取任务详情失败: %w", err)
	}
	return task, nil
}

func (s *TaskService) CancelTask(taskID, userID uint) (*TaskActionResponse, error) {
	task, err := s.taskRepo.GetTaskByID(taskID)
	if err != nil {
		return nil, fmt.Errorf("获取任务详情失败: %w", err)
	}
	if task.UserID != userID {
		return nil, ErrTaskNotOwned
	}

	switch task.Status {
	case "pending", "queued", "running", "paused":
	default:
		return nil, ErrTaskActionNotAllow
	}

	now := time.Now()
	task.Status = "cancelled"
	task.CancelledAt = &now
	task.CancelledBy = &userID
	task.UpdatedAt = now
	if task.StartedAt != nil {
		duration := int(now.Sub(*task.StartedAt).Milliseconds())
		task.ActualDuration = &duration
	}

	if err := s.taskRepo.UpdateTask(task); err != nil {
		return nil, fmt.Errorf("更新任务状态失败: %w", err)
	}

	executions, err := s.nodeExecutionRepo.GetByTaskID(taskID)
	if err == nil {
		for i := range executions {
			if executions[i].Status == "pending" || executions[i].Status == "running" {
				executions[i].Status = "cancelled"
				executions[i].CompletedAt = &now
				if updateErr := s.nodeExecutionRepo.Update(&executions[i]); updateErr != nil {
					return nil, fmt.Errorf("更新节点执行状态失败: %w", updateErr)
				}
			}
		}
	}

	return &TaskActionResponse{
		TaskID:  task.ID,
		Status:  task.Status,
		Message: "task cancelled",
	}, nil
}

func (s *TaskService) RetryFailedTask(taskID, userID uint) (*TaskActionResponse, error) {
	task, err := s.taskRepo.GetTaskByID(taskID)
	if err != nil {
		return nil, fmt.Errorf("获取任务详情失败: %w", err)
	}
	if task.UserID != userID {
		return nil, ErrTaskNotOwned
	}
	switch task.Status {
	case "failed", "cancelled", "timeout":
	default:
		return nil, ErrTaskActionNotAllow
	}
	if s.workflowService == nil || s.executor == nil {
		return nil, fmt.Errorf("任务重试服务未初始化")
	}

	executions, err := s.nodeExecutionRepo.GetByTaskID(taskID)
	if err != nil {
		return nil, fmt.Errorf("加载节点执行记录失败: %w", err)
	}

	req, err := s.buildRetryExecutionRequest(task)
	if err != nil {
		return nil, err
	}
	req.RuntimeMeta = mergeRetryRuntimeMeta(req.RuntimeMeta, task.ID)

	resumeState, err := buildResumeExecutionState(task.ID, req.Nodes, req.Edges, executions)
	if err != nil {
		if errors.Is(err, ErrNoResumableFailedNodes) {
			return nil, ErrTaskActionNotAllow
		}
		return nil, err
	}
	req.ResumeState = resumeState
	if err := s.executor.ValidateExecutionRequest(req); err != nil {
		return nil, err
	}

	taskIDCh := make(chan uint, 1)
	req.OnTaskCreated = func(newTaskID uint) {
		select {
		case taskIDCh <- newTaskID:
		default:
		}
	}

	go func() {
		_ = s.executor.ExecuteWorkflowStreamConcurrent(context.Background(), req, func(string, string, bool, string, error) {})
	}()

	var newTaskID uint
	select {
	case newTaskID = <-taskIDCh:
	case <-time.After(2 * time.Second):
	}

	return &TaskActionResponse{
		TaskID:  newTaskID,
		Status:  "retry_started",
		Message: "task retry started",
	}, nil
}

func (s *TaskService) buildRetryExecutionRequest(task *models.Task) (workflowServices.ExecutionRequest, error) {
	if task.ExecutionContext != nil {
		if req, ok := retryExecutionRequestFromSnapshot(task); ok {
			return req, nil
		}
	}
	if s.workflowService == nil {
		return workflowServices.ExecutionRequest{}, fmt.Errorf("任务重试服务未初始化")
	}
	workflowNodes, err := s.workflowService.GetWorkflowNodes(task.WorkflowID)
	if err != nil {
		return workflowServices.ExecutionRequest{}, fmt.Errorf("加载工作流配置失败: %w", err)
	}

	req := workflowServices.ExecutionRequest{
		UserID:     task.UserID,
		WorkflowID: task.WorkflowID,
		Nodes:      make([]workflowServices.NodeConfig, len(workflowNodes.Nodes)),
		Edges:      make([]workflowServices.EdgeConfig, len(workflowNodes.Edges)),
	}

	for i, node := range workflowNodes.Nodes {
		config := map[string]interface{}{}
		if node.Data != nil {
			if rawConfig, ok := node.Data["config"].(map[string]interface{}); ok {
				config = rawConfig
			}
		}
		req.Nodes[i] = workflowServices.NodeConfig{
			ID:     node.ID,
			Type:   node.Type,
			Config: config,
		}
	}
	for i, edge := range workflowNodes.Edges {
		req.Edges[i] = workflowServices.EdgeConfig{
			Source:       edge.Source,
			Target:       edge.Target,
			SourceHandle: edge.SourceHandle,
			TargetHandle: edge.TargetHandle,
		}
	}
	return req, nil
}

func mergeRetryRuntimeMeta(runtimeMeta map[string]interface{}, sourceTaskID uint) map[string]interface{} {
	merged := make(map[string]interface{}, len(runtimeMeta)+3)
	for key, value := range runtimeMeta {
		merged[key] = value
	}
	merged["retry_source"] = "task_retry"
	merged["retry_mode"] = "resume_failed"
	merged["source_task_id"] = sourceTaskID
	return merged
}

// TaskNodeExecutionListResponse 节点执行列表响应
type TaskNodeExecutionListResponse struct {
	Executions []TaskNodeExecutionSummary `json:"executions"`
	Total      int                        `json:"total"`
}

type TaskNodeExecutionSummary struct {
	ID               uint        `json:"id"`
	TaskID           uint        `json:"taskId"`
	NodeID           string      `json:"nodeId"`
	NodeType         string      `json:"nodeType"`
	Status           string      `json:"status"`
	ErrorMessage     *string     `json:"errorMessage"`
	ExecutionTime    *int        `json:"executionTime"`
	RetryCount       int         `json:"retryCount"`
	StartedAt        interface{} `json:"startedAt"`
	CompletedAt      interface{} `json:"completedAt"`
	CreatedAt        interface{} `json:"createdAt"`
	HasInputData     bool        `json:"hasInputData"`
	HasOutputData    bool        `json:"hasOutputData"`
	HasErrorStack    bool        `json:"hasErrorStack"`
	HasResourceUsage bool        `json:"hasResourceUsage"`
}

type TaskNodeExecutionDetailResponse struct {
	Execution *models.TaskNodeExecution `json:"execution"`
}

// GetTaskNodeExecutions 获取任务的节点执行记录
func (s *TaskService) GetTaskNodeExecutions(taskID uint) (*TaskNodeExecutionListResponse, error) {
	executions, err := s.nodeExecutionRepo.GetByTaskID(taskID)
	if err != nil {
		return nil, fmt.Errorf("获取节点执行记录失败: %w", err)
	}

	summaries := make([]TaskNodeExecutionSummary, 0, len(executions))
	for _, execution := range executions {
		summaries = append(summaries, TaskNodeExecutionSummary{
			ID:               execution.ID,
			TaskID:           execution.TaskID,
			NodeID:           execution.NodeID,
			NodeType:         execution.NodeType,
			Status:           execution.Status,
			ErrorMessage:     execution.ErrorMessage,
			ExecutionTime:    execution.ExecutionTime,
			RetryCount:       execution.RetryCount,
			StartedAt:        execution.StartedAt,
			CompletedAt:      execution.CompletedAt,
			CreatedAt:        execution.CreatedAt,
			HasInputData:     execution.InputData != nil,
			HasOutputData:    execution.OutputData != nil,
			HasErrorStack:    execution.ErrorStack != nil && *execution.ErrorStack != "",
			HasResourceUsage: execution.ResourceUsage != nil,
		})
	}

	return &TaskNodeExecutionListResponse{
		Executions: summaries,
		Total:      len(summaries),
	}, nil
}

func (s *TaskService) GetTaskNodeExecutionDetail(taskID uint, executionID uint) (*TaskNodeExecutionDetailResponse, error) {
	execution, err := s.nodeExecutionRepo.GetByID(taskID, executionID)
	if err != nil {
		return nil, fmt.Errorf("获取节点执行详情失败: %w", err)
	}

	return &TaskNodeExecutionDetailResponse{
		Execution: execution,
	}, nil
}

// TaskLogListResponse 任务日志列表响应
type TaskLogListResponse struct {
	Logs  []models.TaskLog `json:"logs"`
	Total int64            `json:"total"`
	Page  int              `json:"page"`
	Limit int              `json:"limit"`
}

// GetTaskLogs 获取任务日志
func (s *TaskService) GetTaskLogs(taskID uint, level string, page, limit int) (*TaskLogListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 1000 {
		limit = 100 // 日志默认每页100条
	}

	offset := (page - 1) * limit

	var logs []models.TaskLog
	var total int64
	var err error

	if level != "" {
		logs, total, err = s.logRepo.GetByTaskIDAndLevel(taskID, level, offset, limit)
	} else {
		logs, total, err = s.logRepo.GetByTaskID(taskID, offset, limit)
	}

	if err != nil {
		return nil, fmt.Errorf("获取任务日志失败: %w", err)
	}

	return &TaskLogListResponse{
		Logs:  logs,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// RunningTasksResponse 正在运行的任务响应
type RunningTasksResponse struct {
	Tasks    []models.Task `json:"tasks"`
	HasTasks bool          `json:"hasTasks"`
	Count    int           `json:"count"`
}

// GetRunningTasks 获取工作流正在运行的任务
func (s *TaskService) GetRunningTasks(workflowID uint) (*RunningTasksResponse, error) {
	tasks, err := s.taskRepo.GetRunningTasksByWorkflowID(workflowID)
	if err != nil {
		return nil, fmt.Errorf("获取正在运行的任务失败: %w", err)
	}

	return &RunningTasksResponse{
		Tasks:    tasks,
		HasTasks: len(tasks) > 0,
		Count:    len(tasks),
	}, nil
}
