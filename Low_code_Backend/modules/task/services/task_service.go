package services

import (
	"fmt"
	"yaolight-workshop/backend/modules/task/models"
	"yaolight-workshop/backend/modules/task/repositories"
)

// TaskService 任务服务
type TaskService struct {
	taskRepo          repositories.TaskRepository
	nodeExecutionRepo repositories.TaskNodeExecutionRepository
	logRepo           repositories.TaskLogRepository
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

// TaskListResponse 任务列表响应
type TaskListResponse struct {
	Tasks []models.Task `json:"tasks"`
	Total int64         `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
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

	return &TaskListResponse{
		Tasks: tasks,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// GetTaskDetail 获取任务详情
func (s *TaskService) GetTaskDetail(taskID uint) (*models.Task, error) {
	task, err := s.taskRepo.GetTaskByID(taskID)
	if err != nil {
		return nil, fmt.Errorf("获取任务详情失败: %w", err)
	}
	return task, nil
}

// TaskNodeExecutionListResponse 节点执行列表响应
type TaskNodeExecutionListResponse struct {
	Executions []models.TaskNodeExecution `json:"executions"`
	Total      int                        `json:"total"`
}

// GetTaskNodeExecutions 获取任务的节点执行记录
func (s *TaskService) GetTaskNodeExecutions(taskID uint) (*TaskNodeExecutionListResponse, error) {
	executions, err := s.nodeExecutionRepo.GetByTaskID(taskID)
	if err != nil {
		return nil, fmt.Errorf("获取节点执行记录失败: %w", err)
	}

	return &TaskNodeExecutionListResponse{
		Executions: executions,
		Total:      len(executions),
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
