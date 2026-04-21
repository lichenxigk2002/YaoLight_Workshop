package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/shared"
	artifactModels "yaolight-workshop/backend/modules/artifact/models"
	artifactRepos "yaolight-workshop/backend/modules/artifact/repositories"
	artifactServices "yaolight-workshop/backend/modules/artifact/services"
	taskRepos "yaolight-workshop/backend/modules/task/repositories"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
	workflowAPIModels "yaolight-workshop/backend/modules/workflowapi/models"
)

var slugCleaner = regexp.MustCompile(`[^a-z0-9]+`)

var (
	ErrWorkflowNotFound   = errors.New("workflow not found")
	ErrEndpointNotFound   = errors.New("workflow api endpoint not found")
	ErrAPIKeyInvalid      = errors.New("invalid api key")
	ErrInvocationNotFound = errors.New("invocation not found")
	ErrInvalidKeyStatus   = errors.New("invalid api key status")
	ErrInvalidKeyExpiry   = errors.New("api key expiry must be in the future")
	ErrValidationFailed   = errors.New("workflow api validation failed")
)

type WorkflowAPIService struct {
	db           *gorm.DB
	executor     *workflowServices.WorkflowExecutor
	workflowSvc  *workflowServices.WorkflowService
	taskRepo     taskRepos.TaskRepository
	artifactRepo artifactRepos.ArtifactRepository
}

type EndpointSummary struct {
	ID                 uint        `json:"id"`
	WorkflowID         uint        `json:"workflowId"`
	Name               string      `json:"name"`
	Slug               string      `json:"slug"`
	Description        *string     `json:"description,omitempty"`
	Status             string      `json:"status"`
	ResponseMode       string      `json:"responseMode"`
	ResultMode         string      `json:"resultMode"`
	RequestSchema      interface{} `json:"requestSchema,omitempty"`
	InputMapping       interface{} `json:"inputMapping,omitempty"`
	ResponseSchema     interface{} `json:"responseSchema,omitempty"`
	OutputMapping      interface{} `json:"outputMapping,omitempty"`
	ExposeArtifacts    string      `json:"exposeArtifacts"`
	ExposedArtifactIDs interface{} `json:"exposedArtifactNodeIds,omitempty"`
	WaitTimeoutSeconds int         `json:"waitTimeoutSeconds"`
	RequestExample     interface{} `json:"requestExample,omitempty"`
	ResponseExample    interface{} `json:"responseExample,omitempty"`
	PublishedAt        *time.Time  `json:"publishedAt,omitempty"`
	InvokePath         string      `json:"invokePath"`
	DocsPath           string      `json:"docsPath"`
}

type EndpointUpsertRequest struct {
	Name               string       `json:"name"`
	Slug               string       `json:"slug"`
	Description        *string      `json:"description"`
	Status             string       `json:"status"`
	ResponseMode       string       `json:"responseMode"`
	ResultMode         string       `json:"resultMode"`
	RequestSchema      OptionalJSON `json:"requestSchema"`
	InputMapping       OptionalJSON `json:"inputMapping"`
	ResponseSchema     OptionalJSON `json:"responseSchema"`
	OutputMapping      OptionalJSON `json:"outputMapping"`
	ExposeArtifacts    string       `json:"exposeArtifacts"`
	ExposedArtifactIDs OptionalJSON `json:"exposedArtifactNodeIds"`
	WaitTimeoutSeconds int          `json:"waitTimeoutSeconds"`
	RequestExample     OptionalJSON `json:"requestExample"`
	ResponseExample    OptionalJSON `json:"responseExample"`
}

type CreateAPIKeyRequest struct {
	Name      string     `json:"name"`
	ExpiresAt *time.Time `json:"expiresAt"`
}

type UpdateAPIKeyRequest struct {
	Status string `json:"status"`
}

type CreatedAPIKey struct {
	ID        uint       `json:"id"`
	Name      string     `json:"name"`
	Key       string     `json:"key"`
	KeyPrefix string     `json:"keyPrefix"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

type APIKeySummary struct {
	ID         uint       `json:"id"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"keyPrefix"`
	Status     string     `json:"status"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type InvocationListItem struct {
	RequestID    string      `json:"requestId"`
	Status       string      `json:"status"`
	TaskID       *uint       `json:"taskId,omitempty"`
	ErrorMessage *string     `json:"errorMessage,omitempty"`
	Response     interface{} `json:"response,omitempty"`
	StartedAt    *time.Time  `json:"startedAt,omitempty"`
	CompletedAt  *time.Time  `json:"completedAt,omitempty"`
	CreatedAt    time.Time   `json:"createdAt"`
}

type InvocationPage struct {
	List  []InvocationListItem `json:"list"`
	Total int64                `json:"total"`
}

type PublicInvokeRequest struct {
	Input        interface{} `json:"input"`
	ResponseMode string      `json:"responseMode"`
}

type ArtifactDTO struct {
	ID          uint        `json:"id"`
	NodeID      string      `json:"nodeId,omitempty"`
	Name        string      `json:"name"`
	Kind        string      `json:"kind"`
	MimeType    string      `json:"mimeType"`
	Size        int64       `json:"size"`
	CreatedAt   time.Time   `json:"createdAt"`
	Metadata    interface{} `json:"metadata,omitempty"`
	DownloadURL string      `json:"downloadUrl"`
}

type PublicInvokeResponse struct {
	RequestID string        `json:"requestId"`
	Status    string        `json:"status"`
	TaskID    *uint         `json:"taskId,omitempty"`
	Result    interface{}   `json:"result,omitempty"`
	Artifacts []ArtifactDTO `json:"artifacts,omitempty"`
	Error     *string       `json:"error,omitempty"`
}

type PublicDocsResponse struct {
	Name               string                 `json:"name"`
	Slug               string                 `json:"slug"`
	Description        *string                `json:"description,omitempty"`
	Status             string                 `json:"status"`
	ResponseMode       string                 `json:"responseMode"`
	ResultMode         string                 `json:"resultMode"`
	RequestSchema      interface{}            `json:"requestSchema,omitempty"`
	ResponseSchema     interface{}            `json:"responseSchema,omitempty"`
	InputMapping       interface{}            `json:"inputMapping,omitempty"`
	OutputMapping      interface{}            `json:"outputMapping,omitempty"`
	ExposeArtifacts    string                 `json:"exposeArtifacts"`
	ExposedArtifactIDs interface{}            `json:"exposedArtifactNodeIds,omitempty"`
	WaitTimeoutSeconds int                    `json:"waitTimeoutSeconds"`
	Auth               map[string]string      `json:"auth"`
	Endpoints          map[string]string      `json:"endpoints"`
	RequestExample     interface{}            `json:"requestExample"`
	ResponseExamples   map[string]interface{} `json:"responseExamples"`
	Errors             []map[string]string    `json:"errors"`
}

type authenticatedEndpoint struct {
	Endpoint workflowAPIModels.WorkflowAPIEndpoint
	Key      workflowAPIModels.WorkflowAPIKey
	Workflow workflowModels.Workflow
}

type OptionalJSON struct {
	Set   bool
	Value interface{}
}

func (o *OptionalJSON) UnmarshalJSON(data []byte) error {
	o.Set = true
	trimmed := bytes.TrimSpace(data)
	if bytes.Equal(trimmed, []byte("null")) {
		o.Value = nil
		return nil
	}

	var value interface{}
	if err := json.Unmarshal(trimmed, &value); err != nil {
		return err
	}
	o.Value = value
	return nil
}

func NewWorkflowAPIService(db *gorm.DB) *WorkflowAPIService {
	workflowRepo := workflowRepos.NewWorkflowRepository(db)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(db)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(db)
	return &WorkflowAPIService{
		db:           db,
		executor:     workflowServices.NewWorkflowExecutor(),
		workflowSvc:  workflowServices.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo),
		taskRepo:     taskRepos.NewTaskRepository(db),
		artifactRepo: artifactRepos.NewArtifactRepository(db),
	}
}

func (s *WorkflowAPIService) GetEndpoint(userID uint, workflowID uint) (*EndpointSummary, error) {
	workflow, err := s.getOwnedWorkflow(userID, workflowID)
	if err != nil {
		return nil, err
	}
	endpoint, err := s.findOrCreateEndpoint(workflow)
	if err != nil {
		return nil, err
	}
	return s.toEndpointSummary(endpoint), nil
}

func (s *WorkflowAPIService) UpsertEndpoint(userID uint, workflowID uint, req EndpointUpsertRequest) (*EndpointSummary, error) {
	workflow, err := s.getOwnedWorkflow(userID, workflowID)
	if err != nil {
		return nil, err
	}
	endpoint, err := s.findOrCreateEndpoint(workflow)
	if err != nil {
		return nil, err
	}
	previousStatus := endpoint.Status

	if strings.TrimSpace(req.Name) != "" {
		endpoint.Name = strings.TrimSpace(req.Name)
	}
	if req.Description != nil {
		endpoint.Description = req.Description
	}
	if req.Status != "" {
		endpoint.Status = normalizeEndpointStatus(req.Status)
	}
	if req.ResponseMode != "" {
		endpoint.ResponseMode = normalizeResponseMode(req.ResponseMode)
	}
	if req.ResultMode != "" {
		endpoint.ResultMode = normalizeResultMode(req.ResultMode)
	}
	if req.RequestSchema.Set {
		endpoint.RequestSchema = jsonbFieldPtr(req.RequestSchema.Value)
	}
	if req.InputMapping.Set {
		endpoint.InputMapping = jsonbFieldPtr(req.InputMapping.Value)
	}
	if req.ResponseSchema.Set {
		endpoint.ResponseSchema = jsonbFieldPtr(req.ResponseSchema.Value)
	}
	if req.OutputMapping.Set {
		endpoint.OutputMapping = jsonbFieldPtr(req.OutputMapping.Value)
	}
	if req.ExposeArtifacts != "" {
		endpoint.ExposeArtifacts = normalizeArtifactExposure(req.ExposeArtifacts)
	}
	if req.ExposedArtifactIDs.Set {
		endpoint.ExposedArtifactIDs = jsonbFieldPtr(req.ExposedArtifactIDs.Value)
	}
	if req.WaitTimeoutSeconds > 0 {
		endpoint.WaitTimeoutSeconds = req.WaitTimeoutSeconds
	}
	if req.RequestExample.Set {
		endpoint.RequestExample = jsonbFieldPtr(req.RequestExample.Value)
	}
	if req.ResponseExample.Set {
		endpoint.ResponseExample = jsonbFieldPtr(req.ResponseExample.Value)
	}
	if strings.TrimSpace(req.Slug) != "" {
		slug, err := s.ensureUniqueSlug(req.Slug, endpoint.ID)
		if err != nil {
			return nil, err
		}
		endpoint.Slug = slug
	}

	now := time.Now()
	if shouldValidatePublishedEndpointCanvas(previousStatus, endpoint.Status) {
		if err := s.validatePublishedEndpointCanvas(workflow.ID); err != nil {
			return nil, wrapValidationError(err)
		}
	}
	if endpoint.Status == "published" && endpoint.PublishedAt == nil {
		endpoint.PublishedAt = &now
	}
	if endpoint.Status != "published" {
		endpoint.PublishedAt = nil
	}

	if err := s.db.Save(endpoint).Error; err != nil {
		return nil, err
	}
	return s.toEndpointSummary(endpoint), nil
}

func (s *WorkflowAPIService) ListKeys(userID uint, workflowID uint) ([]APIKeySummary, error) {
	endpoint, err := s.getEndpointForUser(userID, workflowID)
	if err != nil {
		return nil, err
	}

	var keys []workflowAPIModels.WorkflowAPIKey
	if err := s.db.Where("endpoint_id = ?", endpoint.ID).Order("created_at DESC").Find(&keys).Error; err != nil {
		return nil, err
	}

	items := make([]APIKeySummary, 0, len(keys))
	for _, key := range keys {
		items = append(items, APIKeySummary{
			ID:         key.ID,
			Name:       key.Name,
			KeyPrefix:  key.KeyPrefix,
			Status:     key.Status,
			ExpiresAt:  key.ExpiresAt,
			LastUsedAt: key.LastUsedAt,
			CreatedAt:  key.CreatedAt,
		})
	}
	return items, nil
}

func (s *WorkflowAPIService) CreateKey(userID uint, workflowID uint, req CreateAPIKeyRequest) (*CreatedAPIKey, error) {
	endpoint, err := s.getEndpointForUser(userID, workflowID)
	if err != nil {
		return nil, err
	}
	if err := validateAPIKeyExpiry(req.ExpiresAt, time.Now()); err != nil {
		return nil, err
	}

	rawKey, err := generateAPIKey()
	if err != nil {
		return nil, err
	}

	entity := &workflowAPIModels.WorkflowAPIKey{
		EndpointID: endpoint.ID,
		Name:       defaultString(strings.TrimSpace(req.Name), "Default Key"),
		KeyPrefix:  rawKey[:12],
		KeyHash:    s.hashAPIKey(rawKey),
		Status:     "active",
		ExpiresAt:  req.ExpiresAt,
	}
	if err := s.db.Create(entity).Error; err != nil {
		return nil, err
	}

	return &CreatedAPIKey{
		ID:        entity.ID,
		Name:      entity.Name,
		Key:       rawKey,
		KeyPrefix: entity.KeyPrefix,
		ExpiresAt: entity.ExpiresAt,
		CreatedAt: entity.CreatedAt,
	}, nil
}

func (s *WorkflowAPIService) UpdateKey(userID uint, workflowID uint, keyID uint, req UpdateAPIKeyRequest) (*APIKeySummary, error) {
	endpoint, err := s.getExistingEndpointForUser(userID, workflowID)
	if err != nil {
		return nil, err
	}

	var entity workflowAPIModels.WorkflowAPIKey
	if err := s.db.Where("id = ? AND endpoint_id = ?", keyID, endpoint.ID).First(&entity).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEndpointNotFound
		}
		return nil, err
	}

	status, err := normalizeAPIKeyStatus(req.Status)
	if err != nil {
		return nil, err
	}
	entity.Status = status
	if err := s.db.Save(&entity).Error; err != nil {
		return nil, err
	}

	return &APIKeySummary{
		ID:         entity.ID,
		Name:       entity.Name,
		KeyPrefix:  entity.KeyPrefix,
		Status:     entity.Status,
		ExpiresAt:  entity.ExpiresAt,
		LastUsedAt: entity.LastUsedAt,
		CreatedAt:  entity.CreatedAt,
	}, nil
}

func (s *WorkflowAPIService) DeleteKey(userID uint, workflowID uint, keyID uint) error {
	endpoint, err := s.getExistingEndpointForUser(userID, workflowID)
	if err != nil {
		return err
	}

	result := s.db.Where("id = ? AND endpoint_id = ?", keyID, endpoint.ID).Delete(&workflowAPIModels.WorkflowAPIKey{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrEndpointNotFound
	}
	return nil
}

func (s *WorkflowAPIService) ListInvocations(userID uint, workflowID uint, page int, pageSize int) (*InvocationPage, error) {
	endpoint, err := s.getEndpointForUser(userID, workflowID)
	if err != nil {
		return nil, err
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var total int64
	query := s.db.Model(&workflowAPIModels.WorkflowAPIInvocation{}).Where("endpoint_id = ?", endpoint.ID)
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var invocations []workflowAPIModels.WorkflowAPIInvocation
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&invocations).Error; err != nil {
		return nil, err
	}

	items := make([]InvocationListItem, 0, len(invocations))
	for _, item := range invocations {
		items = append(items, InvocationListItem{
			RequestID:    item.RequestID,
			Status:       item.Status,
			TaskID:       item.TaskID,
			ErrorMessage: item.ErrorMessage,
			Response:     jsonbValue(item.ResponseSnapshot),
			StartedAt:    item.StartedAt,
			CompletedAt:  item.CompletedAt,
			CreatedAt:    item.CreatedAt,
		})
	}
	return &InvocationPage{List: items, Total: total}, nil
}

func (s *WorkflowAPIService) PublicInvoke(ctx context.Context, slug string, rawKey string, req PublicInvokeRequest, clientIP string, userAgent string) (*PublicInvokeResponse, error) {
	auth, err := s.authenticatePublishedEndpoint(slug, rawKey)
	if err != nil {
		return nil, err
	}
	if auth.Endpoint.RequestSchema != nil {
		if err := validateContractSchema(req.Input, auth.Endpoint.RequestSchema.Data, "input"); err != nil {
			return nil, wrapValidationError(err)
		}
	}

	requestID, err := generateRequestID()
	if err != nil {
		return nil, err
	}
	startedAt := time.Now()
	invocation := &workflowAPIModels.WorkflowAPIInvocation{
		EndpointID:  auth.Endpoint.ID,
		APIKeyID:    &auth.Key.ID,
		RequestID:   requestID,
		Status:      "running",
		RequestBody: &shared.JSONB{Data: map[string]interface{}{"input": req.Input, "responseMode": req.ResponseMode}},
		StartedAt:   &startedAt,
	}
	if strings.TrimSpace(clientIP) != "" {
		invocation.ClientIP = &clientIP
	}
	if strings.TrimSpace(userAgent) != "" {
		invocation.UserAgent = &userAgent
	}
	if err := s.db.Create(invocation).Error; err != nil {
		return nil, err
	}

	responseMode := auth.Endpoint.ResponseMode
	if strings.TrimSpace(req.ResponseMode) != "" {
		responseMode = normalizeResponseMode(req.ResponseMode)
	}

	mappedInput := req.Input
	if auth.Endpoint.InputMapping != nil {
		mappedInput = applyContractMapping(req.Input, auth.Endpoint.InputMapping.Data)
	}

	execReq, err := s.buildExecutionRequest(&auth.Workflow, &auth.Endpoint, mappedInput, requestID)
	if err != nil {
		_ = s.failInvocation(invocation, err.Error())
		return nil, err
	}

	var taskID uint
	execReq.OnTaskCreated = func(id uint) {
		taskID = id
		_ = s.db.Model(&workflowAPIModels.WorkflowAPIInvocation{}).
			Where("id = ?", invocation.ID).
			Update("task_id", id).Error
	}

	if responseMode == "async" {
		go func() {
			execErr := s.executor.ExecuteWorkflowStreamConcurrent(context.Background(), execReq, func(string, string, bool, string, error) {})
			_, _ = s.finalizeInvocation(invocation.ID, taskID, execErr)
		}()
		return &PublicInvokeResponse{
			RequestID: requestID,
			Status:    "accepted",
		}, nil
	}

	timeoutSeconds := auth.Endpoint.WaitTimeoutSeconds
	if timeoutSeconds <= 0 {
		timeoutSeconds = 15
	}
	runCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()
	execErr := s.executor.ExecuteWorkflowStreamConcurrent(runCtx, execReq, func(string, string, bool, string, error) {})
	return s.finalizeInvocation(invocation.ID, taskID, execErr)
}

func (s *WorkflowAPIService) GetInvocation(slug string, rawKey string, requestID string) (*PublicInvokeResponse, error) {
	auth, err := s.authenticatePublishedEndpoint(slug, rawKey)
	if err != nil {
		return nil, err
	}
	invocation, err := s.getInvocationForEndpoint(auth.Endpoint.ID, requestID)
	if err != nil {
		return nil, err
	}
	return s.toPublicInvokeResponse(invocation)
}

func (s *WorkflowAPIService) ListInvocationArtifacts(slug string, rawKey string, requestID string) ([]ArtifactDTO, error) {
	auth, err := s.authenticatePublishedEndpoint(slug, rawKey)
	if err != nil {
		return nil, err
	}
	invocation, err := s.getInvocationForEndpoint(auth.Endpoint.ID, requestID)
	if err != nil {
		return nil, err
	}
	return s.loadInvocationArtifacts(&auth.Endpoint, invocation)
}

func (s *WorkflowAPIService) GetInvocationArtifact(slug string, rawKey string, requestID string, artifactID uint) (*artifactModels.Artifact, error) {
	auth, err := s.authenticatePublishedEndpoint(slug, rawKey)
	if err != nil {
		return nil, err
	}
	invocation, err := s.getInvocationForEndpoint(auth.Endpoint.ID, requestID)
	if err != nil {
		return nil, err
	}
	if invocation.TaskID == nil || *invocation.TaskID == 0 {
		return nil, ErrInvocationNotFound
	}
	artifact, err := s.artifactRepo.GetByID(artifactID)
	if err != nil {
		return nil, err
	}
	if artifact.TaskID == nil || *artifact.TaskID != *invocation.TaskID || artifact.UserID != auth.Endpoint.UserID {
		return nil, ErrInvocationNotFound
	}
	if !isArtifactExposed(&auth.Endpoint, artifact.NodeID) {
		return nil, ErrInvocationNotFound
	}
	return artifact, nil
}

func (s *WorkflowAPIService) GetDocs(baseURL string, slug string) (*PublicDocsResponse, error) {
	endpoint, workflow, err := s.getPublishedEndpointBySlug(slug)
	if err != nil {
		return nil, err
	}
	if err := s.ensureWorkflowName(endpoint, workflow); err != nil {
		return nil, err
	}

	requestExample := s.resolveRequestExample(endpoint)
	openBase := strings.TrimRight(baseURL, "/")
	return &PublicDocsResponse{
		Name:               endpoint.Name,
		Slug:               endpoint.Slug,
		Description:        endpoint.Description,
		Status:             endpoint.Status,
		ResponseMode:       endpoint.ResponseMode,
		ResultMode:         endpoint.ResultMode,
		RequestSchema:      jsonbValue(endpoint.RequestSchema),
		ResponseSchema:     jsonbValue(endpoint.ResponseSchema),
		InputMapping:       jsonbValue(endpoint.InputMapping),
		OutputMapping:      jsonbValue(endpoint.OutputMapping),
		ExposeArtifacts:    endpoint.ExposeArtifacts,
		ExposedArtifactIDs: jsonbValue(endpoint.ExposedArtifactIDs),
		WaitTimeoutSeconds: endpoint.WaitTimeoutSeconds,
		Auth: map[string]string{
			"type":   "apiKey",
			"header": "X-API-Key",
		},
		Endpoints: map[string]string{
			"invoke":    fmt.Sprintf("%s/open-api/v1/workflows/%s/invoke", openBase, endpoint.Slug),
			"status":    fmt.Sprintf("%s/open-api/v1/workflows/%s/invocations/{requestId}", openBase, endpoint.Slug),
			"artifacts": fmt.Sprintf("%s/open-api/v1/workflows/%s/invocations/{requestId}/artifacts", openBase, endpoint.Slug),
			"docsPage":  strings.TrimRight(config.FrontendURL, "/") + "/open-api-docs/" + endpoint.Slug,
		},
		RequestExample: requestExample,
		ResponseExamples: map[string]interface{}{
			"wait": map[string]interface{}{
				"requestId": "req_demo_123456",
				"status":    "completed",
				"result":    firstNonNil(jsonbValue(endpoint.ResponseExample), map[string]interface{}{}),
			},
			"async": map[string]interface{}{
				"requestId": "req_demo_123456",
				"status":    "accepted",
			},
		},
		Errors: []map[string]string{
			{"code": "401", "message": "Missing or invalid X-API-Key"},
			{"code": "404", "message": "Workflow API or requestId not found"},
			{"code": "500", "message": "Workflow execution failed"},
		},
	}, nil
}

func (s *WorkflowAPIService) finalizeInvocation(invocationID uint, taskID uint, execErr error) (*PublicInvokeResponse, error) {
	if execErr != nil {
		if errors.Is(execErr, context.DeadlineExceeded) {
			message := "workflow execution timed out"
			_ = s.failInvocationByID(invocationID, message)
			return &PublicInvokeResponse{
				RequestID: s.lookupRequestID(invocationID),
				Status:    "failed",
				Error:     &message,
			}, nil
		}
		_ = s.failInvocationByID(invocationID, execErr.Error())
		return nil, execErr
	}

	var invocation workflowAPIModels.WorkflowAPIInvocation
	if err := s.db.First(&invocation, invocationID).Error; err != nil {
		return nil, err
	}
	if taskID > 0 {
		invocation.TaskID = &taskID
	}

	if invocation.TaskID == nil || *invocation.TaskID == 0 {
		now := time.Now()
		invocation.Status = "completed"
		invocation.CompletedAt = &now
		if err := s.db.Save(&invocation).Error; err != nil {
			return nil, err
		}
		return s.toPublicInvokeResponse(&invocation)
	}

	task, err := s.taskRepo.GetTaskByID(*invocation.TaskID)
	if err != nil {
		return nil, err
	}

	status := mapTaskStatus(task.Status)
	now := time.Now()
	snapshot := map[string]interface{}{
		"taskId": task.ID,
		"status": task.Status,
		"result": jsonbValue(task.Result),
	}
	if task.ErrorMessage != nil {
		snapshot["error"] = *task.ErrorMessage
	}

	var endpoint workflowAPIModels.WorkflowAPIEndpoint
	if err := s.db.First(&endpoint, invocation.EndpointID).Error; err == nil {
		artifacts, loadErr := s.loadArtifactsByTaskID(&endpoint, task.ID, invocation.RequestID)
		if loadErr == nil {
			if len(artifacts) > 0 {
				snapshot["artifacts"] = artifacts
			}
		}

		mappedResult := snapshot["result"]
		if endpoint.OutputMapping != nil {
			mappedResult = applyContractMapping(map[string]interface{}{
				"result":    snapshot["result"],
				"artifacts": artifacts,
				"taskId":    task.ID,
				"status":    task.Status,
				"requestId": invocation.RequestID,
			}, endpoint.OutputMapping.Data)
		}
		if endpoint.ResponseSchema != nil && shouldValidateResponseSchema(status) {
			if err := validateContractSchema(mappedResult, endpoint.ResponseSchema.Data, "result"); err != nil {
				invocation.Status = "failed"
				invocation.CompletedAt = &now
				invocation.ErrorMessage = ptrString("response schema validation failed: " + err.Error())
				invocation.ResponseSnapshot = &shared.JSONB{Data: map[string]interface{}{
					"taskId": task.ID,
					"status": task.Status,
					"error":  *invocation.ErrorMessage,
				}}
				if saveErr := s.db.Save(&invocation).Error; saveErr != nil {
					return nil, saveErr
				}
				return s.toPublicInvokeResponse(&invocation)
			}
		}
		snapshot["result"] = mappedResult
	}
	invocation.Status = status
	invocation.CompletedAt = &now
	invocation.ResponseSnapshot = &shared.JSONB{Data: snapshot}
	if task.ErrorMessage != nil {
		invocation.ErrorMessage = task.ErrorMessage
	}
	if err := s.db.Save(&invocation).Error; err != nil {
		return nil, err
	}
	return s.toPublicInvokeResponse(&invocation)
}

func (s *WorkflowAPIService) buildExecutionRequest(workflow *workflowModels.Workflow, endpoint *workflowAPIModels.WorkflowAPIEndpoint, input interface{}, requestID string) (workflowServices.ExecutionRequest, error) {
	canvas, err := s.workflowSvc.GetWorkflowNodes(workflow.ID)
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
		UserID:       workflow.UserID,
		WorkflowID:   workflow.ID,
		RuntimeInput: input,
		RuntimeMeta: map[string]interface{}{
			"requestId": requestID,
			"source":    "open_api",
			"endpoint":  endpoint.Slug,
		},
	}, nil
}

func (s *WorkflowAPIService) getOwnedWorkflow(userID uint, workflowID uint) (*workflowModels.Workflow, error) {
	var workflow workflowModels.Workflow
	if err := s.db.Where("id = ? AND user_id = ?", workflowID, userID).First(&workflow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}
	return &workflow, nil
}

func (s *WorkflowAPIService) getEndpointForUser(userID uint, workflowID uint) (*workflowAPIModels.WorkflowAPIEndpoint, error) {
	workflow, err := s.getOwnedWorkflow(userID, workflowID)
	if err != nil {
		return nil, err
	}
	return s.findOrCreateEndpoint(workflow)
}

func (s *WorkflowAPIService) getExistingEndpointForUser(userID uint, workflowID uint) (*workflowAPIModels.WorkflowAPIEndpoint, error) {
	workflow, err := s.getOwnedWorkflow(userID, workflowID)
	if err != nil {
		return nil, err
	}

	var endpoint workflowAPIModels.WorkflowAPIEndpoint
	if err := s.db.Where("workflow_id = ?", workflow.ID).First(&endpoint).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEndpointNotFound
		}
		return nil, err
	}
	return &endpoint, nil
}

func (s *WorkflowAPIService) findOrCreateEndpoint(workflow *workflowModels.Workflow) (*workflowAPIModels.WorkflowAPIEndpoint, error) {
	var endpoint workflowAPIModels.WorkflowAPIEndpoint
	err := s.db.Where("workflow_id = ?", workflow.ID).First(&endpoint).Error
	if err == nil {
		return &endpoint, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	slug, err := s.ensureUniqueSlug(workflow.Name, 0)
	if err != nil {
		return nil, err
	}
	endpoint = workflowAPIModels.WorkflowAPIEndpoint{
		UserID:             workflow.UserID,
		ProjectID:          workflow.ProjectID,
		WorkflowID:         workflow.ID,
		Name:               workflow.Name,
		Description:        workflow.Description,
		Slug:               slug,
		Status:             "draft",
		ResponseMode:       "wait",
		ResultMode:         "json",
		ExposeArtifacts:    "all",
		WaitTimeoutSeconds: 15,
		RequestExample:     &shared.JSONB{Data: s.buildDefaultRequestExample(workflow)},
	}
	if err := s.db.Create(&endpoint).Error; err != nil {
		return nil, err
	}
	return &endpoint, nil
}

func (s *WorkflowAPIService) getPublishedEndpointBySlug(slug string) (*workflowAPIModels.WorkflowAPIEndpoint, *workflowModels.Workflow, error) {
	var endpoint workflowAPIModels.WorkflowAPIEndpoint
	if err := s.db.Where("slug = ? AND status = ?", slug, "published").First(&endpoint).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrEndpointNotFound
		}
		return nil, nil, err
	}

	var workflow workflowModels.Workflow
	if err := s.db.Where("id = ?", endpoint.WorkflowID).First(&workflow).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrWorkflowNotFound
		}
		return nil, nil, err
	}
	return &endpoint, &workflow, nil
}

func (s *WorkflowAPIService) authenticatePublishedEndpoint(slug string, rawKey string) (*authenticatedEndpoint, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return nil, ErrAPIKeyInvalid
	}

	endpoint, workflow, err := s.getPublishedEndpointBySlug(slug)
	if err != nil {
		return nil, err
	}

	prefix := rawKey
	if len(prefix) > 12 {
		prefix = prefix[:12]
	}

	var keys []workflowAPIModels.WorkflowAPIKey
	if err := s.db.Where("endpoint_id = ? AND key_prefix = ? AND status = ?", endpoint.ID, prefix, "active").Find(&keys).Error; err != nil {
		return nil, err
	}

	hash := s.hashAPIKey(rawKey)
	now := time.Now()
	for _, key := range keys {
		if key.KeyHash != hash {
			continue
		}
		if key.ExpiresAt != nil && key.ExpiresAt.Before(now) {
			continue
		}
		_ = s.db.Model(&workflowAPIModels.WorkflowAPIKey{}).Where("id = ?", key.ID).Update("last_used_at", now).Error
		return &authenticatedEndpoint{Endpoint: *endpoint, Key: key, Workflow: *workflow}, nil
	}
	return nil, ErrAPIKeyInvalid
}

func (s *WorkflowAPIService) ensureUniqueSlug(raw string, currentID uint) (string, error) {
	base := slugify(raw)
	if base == "" {
		base = "workflow-api"
	}

	candidate := base
	for i := 0; i < 50; i++ {
		var count int64
		query := s.db.Model(&workflowAPIModels.WorkflowAPIEndpoint{}).Where("slug = ?", candidate)
		if currentID > 0 {
			query = query.Where("id <> ?", currentID)
		}
		if err := query.Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, i+1)
	}
	return "", fmt.Errorf("failed to allocate unique slug")
}

func (s *WorkflowAPIService) hashAPIKey(raw string) string {
	pepper := config.OpenAPIKeyPepper
	if strings.TrimSpace(pepper) == "" {
		pepper = config.JWTSecret
	}
	sum := sha256.Sum256([]byte(pepper + ":" + raw))
	return hex.EncodeToString(sum[:])
}

func (s *WorkflowAPIService) failInvocation(invocation *workflowAPIModels.WorkflowAPIInvocation, message string) error {
	return s.failInvocationByID(invocation.ID, message)
}

func (s *WorkflowAPIService) failInvocationByID(invocationID uint, message string) error {
	now := time.Now()
	return s.db.Model(&workflowAPIModels.WorkflowAPIInvocation{}).
		Where("id = ?", invocationID).
		Updates(map[string]interface{}{
			"status":        "failed",
			"error_message": message,
			"completed_at":  now,
		}).Error
}

func (s *WorkflowAPIService) lookupRequestID(invocationID uint) string {
	var invocation workflowAPIModels.WorkflowAPIInvocation
	if err := s.db.Select("request_id").First(&invocation, invocationID).Error; err != nil {
		return ""
	}
	return invocation.RequestID
}

func (s *WorkflowAPIService) getInvocationForEndpoint(endpointID uint, requestID string) (*workflowAPIModels.WorkflowAPIInvocation, error) {
	var invocation workflowAPIModels.WorkflowAPIInvocation
	if err := s.db.Where("endpoint_id = ? AND request_id = ?", endpointID, requestID).First(&invocation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvocationNotFound
		}
		return nil, err
	}
	return &invocation, nil
}

func (s *WorkflowAPIService) toEndpointSummary(endpoint *workflowAPIModels.WorkflowAPIEndpoint) *EndpointSummary {
	return &EndpointSummary{
		ID:                 endpoint.ID,
		WorkflowID:         endpoint.WorkflowID,
		Name:               endpoint.Name,
		Slug:               endpoint.Slug,
		Description:        endpoint.Description,
		Status:             endpoint.Status,
		ResponseMode:       endpoint.ResponseMode,
		ResultMode:         endpoint.ResultMode,
		RequestSchema:      jsonbValue(endpoint.RequestSchema),
		InputMapping:       jsonbValue(endpoint.InputMapping),
		ResponseSchema:     jsonbValue(endpoint.ResponseSchema),
		OutputMapping:      jsonbValue(endpoint.OutputMapping),
		ExposeArtifacts:    endpoint.ExposeArtifacts,
		ExposedArtifactIDs: jsonbValue(endpoint.ExposedArtifactIDs),
		WaitTimeoutSeconds: endpoint.WaitTimeoutSeconds,
		RequestExample:     jsonbValue(endpoint.RequestExample),
		ResponseExample:    jsonbValue(endpoint.ResponseExample),
		PublishedAt:        endpoint.PublishedAt,
		InvokePath:         "/open-api/v1/workflows/" + endpoint.Slug + "/invoke",
		DocsPath:           "/open-api-docs/" + endpoint.Slug,
	}
}

func (s *WorkflowAPIService) toPublicInvokeResponse(invocation *workflowAPIModels.WorkflowAPIInvocation) (*PublicInvokeResponse, error) {
	response := &PublicInvokeResponse{
		RequestID: invocation.RequestID,
		Status:    invocation.Status,
		TaskID:    invocation.TaskID,
	}
	if invocation.ResponseSnapshot != nil {
		if snapshot, ok := invocation.ResponseSnapshot.Data.(map[string]interface{}); ok {
			response.Result = snapshot["result"]
		}
	}
	if invocation.ErrorMessage != nil {
		response.Error = invocation.ErrorMessage
	}

	var endpoint workflowAPIModels.WorkflowAPIEndpoint
	if err := s.db.First(&endpoint, invocation.EndpointID).Error; err == nil {
		if artifacts, loadErr := s.loadInvocationArtifacts(&endpoint, invocation); loadErr == nil {
			response.Artifacts = artifacts
		}
	}
	return response, nil
}

func (s *WorkflowAPIService) loadInvocationArtifacts(endpoint *workflowAPIModels.WorkflowAPIEndpoint, invocation *workflowAPIModels.WorkflowAPIInvocation) ([]ArtifactDTO, error) {
	if invocation.TaskID == nil || *invocation.TaskID == 0 {
		return []ArtifactDTO{}, nil
	}
	return s.loadArtifactsByTaskID(endpoint, *invocation.TaskID, invocation.RequestID)
}

func (s *WorkflowAPIService) loadArtifactsByTaskID(endpoint *workflowAPIModels.WorkflowAPIEndpoint, taskID uint, requestID string) ([]ArtifactDTO, error) {
	artifacts, _, err := s.artifactRepo.ListByTaskAdmin(taskID, 1, 100)
	if err != nil {
		return nil, err
	}
	filtered := filterArtifactsByExposure(artifacts, normalizeArtifactExposure(endpoint.ExposeArtifacts), toStringSet(jsonbValue(endpoint.ExposedArtifactIDs)))
	items := make([]ArtifactDTO, 0, len(filtered))
	for _, item := range filtered {
		items = append(items, ArtifactDTO{
			ID:          item.ID,
			NodeID:      item.NodeID,
			Name:        item.Name,
			Kind:        item.Kind,
			MimeType:    item.MimeType,
			Size:        item.Size,
			CreatedAt:   item.CreatedAt,
			Metadata:    jsonbValue(item.Metadata),
			DownloadURL: fmt.Sprintf("/open-api/v1/workflows/%s/invocations/%s/artifacts/%d/download", endpoint.Slug, requestID, item.ID),
		})
	}
	return items, nil
}

func jsonbFieldPtr(value interface{}) *shared.JSONB {
	if value == nil {
		return nil
	}
	return &shared.JSONB{Data: value}
}

func isArtifactExposed(endpoint *workflowAPIModels.WorkflowAPIEndpoint, nodeID string) bool {
	switch normalizeArtifactExposure(endpoint.ExposeArtifacts) {
	case "none":
		return false
	case "selected":
		_, ok := toStringSet(jsonbValue(endpoint.ExposedArtifactIDs))[nodeID]
		return ok
	default:
		return true
	}
}

func (s *WorkflowAPIService) ensureWorkflowName(endpoint *workflowAPIModels.WorkflowAPIEndpoint, workflow *workflowModels.Workflow) error {
	if endpoint.Name != "" {
		return nil
	}
	endpoint.Name = workflow.Name
	return s.db.Save(endpoint).Error
}

func (s *WorkflowAPIService) buildDefaultRequestExample(workflow *workflowModels.Workflow) interface{} {
	canvas, err := s.workflowSvc.GetWorkflowNodes(workflow.ID)
	if err != nil {
		return map[string]interface{}{"input": map[string]interface{}{"data": "example"}, "responseMode": "wait"}
	}
	for _, node := range canvas.Nodes {
		if node.Type != "start" || node.Data == nil {
			continue
		}
		rawConfig, ok := node.Data["config"].(map[string]interface{})
		if !ok {
			continue
		}
		rawInput, _ := rawConfig["inputData"].(string)
		if strings.TrimSpace(rawInput) == "" {
			continue
		}
		var parsed interface{}
		if err := json.Unmarshal([]byte(rawInput), &parsed); err == nil {
			return map[string]interface{}{"input": parsed, "responseMode": "wait"}
		}
		return map[string]interface{}{"input": map[string]interface{}{"data": rawInput}, "responseMode": "wait"}
	}
	return map[string]interface{}{"input": map[string]interface{}{"data": "example"}, "responseMode": "wait"}
}

func (s *WorkflowAPIService) validatePublishedEndpointCanvas(workflowID uint) error {
	canvas, err := s.workflowSvc.GetWorkflowNodes(workflowID)
	if err != nil {
		return err
	}

	hasAPIInput := false
	hasAPIOutput := false
	for _, node := range canvas.Nodes {
		if node.Type == "start" {
			rawConfig, _ := node.Data["config"].(map[string]interface{})
			if readNodeConfigString(rawConfig, "inputMode", "manual") == "api_input" {
				hasAPIInput = true
			}
		}
		if node.Type == "output" {
			rawConfig, _ := node.Data["config"].(map[string]interface{})
			if readNodeConfigString(rawConfig, "outputMode", "artifact_export") == "api_output" {
				hasAPIOutput = true
			}
		}
	}

	if !hasAPIInput {
		return fmt.Errorf("发布 API 前，工作流至少需要一个开始节点设置为 api_input 模式")
	}
	if !hasAPIOutput {
		return fmt.Errorf("发布 API 前，工作流至少需要一个输出节点设置为 api_output 模式")
	}
	return nil
}

func (s *WorkflowAPIService) resolveRequestExample(endpoint *workflowAPIModels.WorkflowAPIEndpoint) interface{} {
	if endpoint.RequestExample != nil && endpoint.RequestExample.Data != nil {
		return endpoint.RequestExample.Data
	}
	return map[string]interface{}{"input": map[string]interface{}{"data": "example"}, "responseMode": endpoint.ResponseMode}
}

func generateAPIKey() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "ylw_" + hex.EncodeToString(b), nil
}

func generateRequestID() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "req_" + hex.EncodeToString(b), nil
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = slugCleaner.ReplaceAllString(value, "-")
	return strings.Trim(value, "-")
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func readNodeConfigString(m map[string]interface{}, key string, fallback string) string {
	if m == nil {
		return fallback
	}
	value, ok := m[key]
	if !ok {
		return fallback
	}
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return fallback
	}
	return text
}

func ptrString(value string) *string {
	return &value
}

func firstNonNil(values ...interface{}) interface{} {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func normalizeEndpointStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "published":
		return "published"
	case "disabled":
		return "disabled"
	default:
		return "draft"
	}
}

func normalizeResponseMode(value string) string {
	if strings.ToLower(strings.TrimSpace(value)) == "async" {
		return "async"
	}
	return "wait"
}

func normalizeResultMode(value string) string {
	if strings.ToLower(strings.TrimSpace(value)) == "artifact" {
		return "artifact"
	}
	return "json"
}

func shouldValidatePublishedEndpointCanvas(previousStatus string, currentStatus string) bool {
	return previousStatus != "published" && currentStatus == "published"
}

func shouldValidateResponseSchema(status string) bool {
	return status == "completed"
}

func wrapValidationError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %s", ErrValidationFailed, err.Error())
}

func normalizeAPIKeyStatus(value string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "active":
		return "active", nil
	case "inactive":
		return "inactive", nil
	default:
		return "", ErrInvalidKeyStatus
	}
}

func validateAPIKeyExpiry(expiresAt *time.Time, now time.Time) error {
	if expiresAt == nil {
		return nil
	}
	if !expiresAt.After(now) {
		return ErrInvalidKeyExpiry
	}
	return nil
}

func mapTaskStatus(status string) string {
	switch status {
	case "completed":
		return "completed"
	case "failed", "cancelled", "timeout":
		return "failed"
	default:
		return "running"
	}
}

func jsonbValue(value *shared.JSONB) interface{} {
	if value == nil {
		return nil
	}
	return value.Data
}

func OpenArtifactContent(artifact *artifactModels.Artifact) ([]byte, error) {
	return artifactServices.ArtifactContent(artifact)
}
