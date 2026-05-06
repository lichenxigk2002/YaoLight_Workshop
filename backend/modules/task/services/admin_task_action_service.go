package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	artifactModels "yaolight-workshop/backend/modules/artifact/models"
	artifactServices "yaolight-workshop/backend/modules/artifact/services"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

var (
	ErrAdminTaskActionNotAllowed = errors.New("task action not allowed for current status")
	ErrAdminTaskRetryNotAllowed  = errors.New("task retry not allowed for current status")
)

type AdminTaskActionResponse struct {
	TaskID  uint   `json:"task_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type AdminTaskArtifactItem struct {
	ID          uint        `json:"id"`
	UserID      uint        `json:"user_id"`
	WorkflowID  *uint       `json:"workflow_id"`
	TaskID      *uint       `json:"task_id"`
	NodeID      string      `json:"node_id"`
	Name        string      `json:"name"`
	Description *string     `json:"description,omitempty"`
	Kind        string      `json:"kind"`
	MimeType    string      `json:"mime_type"`
	Size        int64       `json:"size"`
	Storage     string      `json:"storage"`
	Path        string      `json:"path"`
	Metadata    interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	DownloadURL string      `json:"download_url"`
}

type AdminTaskArtifactListResponse struct {
	List     []AdminTaskArtifactItem `json:"list"`
	Total    int64                   `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"page_size"`
}

type ArtifactDownloadInfo struct {
	Name        string
	MimeType    string
	Storage     string
	LocalPath   string
	RedirectURL string
	Artifact    *artifactModels.Artifact
}

func (s *AdminTaskService) CancelTask(taskID, operatorID uint) (*AdminTaskActionResponse, error) {
	task, err := s.taskService.GetTaskDetail(taskID)
	if err != nil {
		return nil, fmt.Errorf("load task for cancel failed: %w", err)
	}

	switch task.Status {
	case "pending", "queued", "running", "paused":
	default:
		return nil, ErrAdminTaskActionNotAllowed
	}

	now := time.Now()
	task.Status = "cancelled"
	task.CancelledAt = &now
	task.CancelledBy = &operatorID
	task.UpdatedAt = now
	if task.StartedAt != nil {
		duration := int(now.Sub(*task.StartedAt).Milliseconds())
		task.ActualDuration = &duration
	}

	if err := s.taskService.taskRepo.UpdateTask(task); err != nil {
		return nil, fmt.Errorf("update task status failed: %w", err)
	}

	executions, err := s.nodeExecutionRepo.GetByTaskID(taskID)
	if err == nil {
		for i := range executions {
			if executions[i].Status == "pending" || executions[i].Status == "running" {
				executions[i].Status = "cancelled"
				executions[i].CompletedAt = &now
				if updateErr := s.nodeExecutionRepo.Update(&executions[i]); updateErr != nil {
					return nil, fmt.Errorf("update task node execution failed: %w", updateErr)
				}
			}
		}
	}

	return &AdminTaskActionResponse{
		TaskID:  task.ID,
		Status:  task.Status,
		Message: "task cancelled",
	}, nil
}

func (s *AdminTaskService) RetryTask(taskID uint) (*AdminTaskActionResponse, error) {
	task, err := s.taskService.GetTaskDetail(taskID)
	if err != nil {
		return nil, fmt.Errorf("load task for retry failed: %w", err)
	}

	switch task.Status {
	case "failed", "timeout", "cancelled":
	default:
		return nil, ErrAdminTaskRetryNotAllowed
	}

	workflowNodes, err := s.workflowService.GetWorkflowNodes(task.WorkflowID)
	if err != nil {
		return nil, fmt.Errorf("load workflow nodes for retry failed: %w", err)
	}

	req := workflowServices.ExecutionRequest{
		UserID:     task.UserID,
		WorkflowID: task.WorkflowID,
		Nodes:      make([]workflowServices.NodeConfig, len(workflowNodes.Nodes)),
		Edges:      make([]workflowServices.EdgeConfig, len(workflowNodes.Edges)),
	}

	for i, node := range workflowNodes.Nodes {
		config := map[string]interface{}{}
		if rawConfig, ok := node.Data["config"].(map[string]interface{}); ok {
			config = rawConfig
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
	if err := s.executor.ValidateExecutionRequest(req); err != nil {
		return nil, err
	}

	go func() {
		_ = s.executor.ExecuteWorkflowStreamConcurrent(context.Background(), req, func(string, string, bool, string, error) {})
	}()

	return &AdminTaskActionResponse{
		TaskID:  task.ID,
		Status:  "retry_started",
		Message: "task retry started",
	}, nil
}

func (s *AdminTaskService) ListTaskArtifacts(taskID uint, page, pageSize int) (*AdminTaskArtifactListResponse, error) {
	if _, err := s.taskService.GetTaskDetail(taskID); err != nil {
		return nil, fmt.Errorf("load task for artifacts failed: %w", err)
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	artifacts, total, err := s.artifactRepo.ListByTaskAdmin(taskID, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("list task artifacts failed: %w", err)
	}

	items := make([]AdminTaskArtifactItem, 0, len(artifacts))
	for _, artifact := range artifacts {
		items = append(items, toAdminTaskArtifactItem(&artifact))
	}

	return &AdminTaskArtifactListResponse{
		List:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *AdminTaskService) GetArtifactDownloadInfo(artifactID uint) (*ArtifactDownloadInfo, error) {
	artifact, err := s.artifactRepo.GetByID(artifactID)
	if err != nil {
		return nil, fmt.Errorf("load artifact failed: %w", err)
	}

	info := &ArtifactDownloadInfo{
		Name:     artifact.Name,
		MimeType: artifact.MimeType,
		Storage:  artifact.Storage,
		Artifact: artifact,
	}

	switch artifact.Storage {
	case "local":
		info.LocalPath = artifactServices.ArtifactAbsolutePath(artifact.Path)
	case "cos":
		downloadURL, err := artifactServices.ArtifactDownloadURL(artifact, 15*time.Minute)
		if err != nil {
			return nil, fmt.Errorf("build artifact cos download url failed: %w", err)
		}
		info.RedirectURL = downloadURL
	default:
		return nil, fmt.Errorf("unsupported artifact storage: %s", artifact.Storage)
	}

	return info, nil
}

func toAdminTaskArtifactItem(artifact *artifactModels.Artifact) AdminTaskArtifactItem {
	var metadata interface{}
	if artifact.Metadata != nil {
		metadata = artifact.Metadata.Data
	}

	return AdminTaskArtifactItem{
		ID:          artifact.ID,
		UserID:      artifact.UserID,
		WorkflowID:  artifact.WorkflowID,
		TaskID:      artifact.TaskID,
		NodeID:      artifact.NodeID,
		Name:        artifact.Name,
		Description: artifact.Description,
		Kind:        artifact.Kind,
		MimeType:    artifact.MimeType,
		Size:        artifact.Size,
		Storage:     artifact.Storage,
		Path:        artifact.Path,
		Metadata:    metadata,
		CreatedAt:   artifact.CreatedAt,
		DownloadURL: fmt.Sprintf("/api/admin/tasks/artifacts/%d/download", artifact.ID),
	}
}
