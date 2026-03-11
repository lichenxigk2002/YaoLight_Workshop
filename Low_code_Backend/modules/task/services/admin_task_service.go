package services

import (
	"fmt"

	artifactRepos "yaolight-workshop/backend/modules/artifact/repositories"
	"yaolight-workshop/backend/modules/task/repositories"
	workflowService "yaolight-workshop/backend/modules/workflow/services"
)

type AdminTaskListResponse struct {
	List     []repositories.AdminTaskListItem `json:"list"`
	Total    int64                            `json:"total"`
	Page     int                              `json:"page"`
	PageSize int                              `json:"page_size"`
}

type AdminTaskNodeExecutionListResponse struct {
	Executions interface{} `json:"executions"`
	Total      int         `json:"total"`
}

type AdminTaskService struct {
	queryRepo         *repositories.AdminTaskQueryRepository
	taskService       *TaskService
	nodeExecutionRepo repositories.TaskNodeExecutionRepository
	artifactRepo      artifactRepos.ArtifactRepository
	workflowService   *workflowService.WorkflowService
	executor          *workflowService.WorkflowExecutor
}

func NewAdminTaskService(
	queryRepo *repositories.AdminTaskQueryRepository,
	taskService *TaskService,
	nodeExecutionRepo repositories.TaskNodeExecutionRepository,
	artifactRepo artifactRepos.ArtifactRepository,
	workflowService *workflowService.WorkflowService,
	executor *workflowService.WorkflowExecutor,
) *AdminTaskService {
	return &AdminTaskService{
		queryRepo:         queryRepo,
		taskService:       taskService,
		nodeExecutionRepo: nodeExecutionRepo,
		artifactRepo:      artifactRepo,
		workflowService:   workflowService,
		executor:          executor,
	}
}

func (s *AdminTaskService) ListTasks(query repositories.AdminTaskListQuery) (*AdminTaskListResponse, error) {
	return s.listTasks(query, s.queryRepo.List, "list admin tasks failed")
}

func (s *AdminTaskService) ListRunningTasks(query repositories.AdminTaskListQuery) (*AdminTaskListResponse, error) {
	return s.listTasks(query, s.queryRepo.ListRunning, "list running admin tasks failed")
}

func (s *AdminTaskService) ListFailureTasks(query repositories.AdminTaskListQuery) (*AdminTaskListResponse, error) {
	return s.listTasks(query, s.queryRepo.ListFailures, "list failure admin tasks failed")
}

func (s *AdminTaskService) listTasks(
	query repositories.AdminTaskListQuery,
	fetcher func(repositories.AdminTaskListQuery) ([]repositories.AdminTaskListItem, int64, error),
	errorMessage string,
) (*AdminTaskListResponse, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	items, total, err := fetcher(query)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", errorMessage, err)
	}

	return &AdminTaskListResponse{
		List:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *AdminTaskService) GetSummary() (*repositories.AdminTaskSummary, error) {
	summary, err := s.queryRepo.Summary()
	if err != nil {
		return nil, fmt.Errorf("get admin task summary failed: %w", err)
	}
	return summary, nil
}

func (s *AdminTaskService) GetFailureStats(query repositories.AdminTaskListQuery) (*repositories.AdminTaskFailureStats, error) {
	stats, err := s.queryRepo.FailureStats(query)
	if err != nil {
		return nil, fmt.Errorf("get admin task failure stats failed: %w", err)
	}
	return stats, nil
}

func (s *AdminTaskService) GetTaskDetail(taskID uint) (*repositories.AdminTaskDetail, error) {
	detail, err := s.queryRepo.GetDetail(taskID)
	if err != nil {
		return nil, fmt.Errorf("get admin task detail failed: %w", err)
	}
	return detail, nil
}

func (s *AdminTaskService) GetTaskLogs(query repositories.AdminTaskLogQuery) (*repositories.AdminTaskLogListResult, error) {
	result, err := s.queryRepo.GetLogs(query)
	if err != nil {
		return nil, fmt.Errorf("get admin task logs failed: %w", err)
	}
	return result, nil
}

func (s *AdminTaskService) GetTaskNodeExecutions(taskID uint) (*TaskNodeExecutionListResponse, error) {
	result, err := s.taskService.GetTaskNodeExecutions(taskID)
	if err != nil {
		return nil, fmt.Errorf("get admin task node executions failed: %w", err)
	}
	return result, nil
}
