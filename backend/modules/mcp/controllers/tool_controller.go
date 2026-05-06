package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiServices "yaolight-workshop/backend/modules/ai/services"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
	artifactRepos "yaolight-workshop/backend/modules/artifact/repositories"
	artifactServices "yaolight-workshop/backend/modules/artifact/services"
	mcpMiddleware "yaolight-workshop/backend/modules/mcp/middleware"
	mcpModels "yaolight-workshop/backend/modules/mcp/models"
	mcpServices "yaolight-workshop/backend/modules/mcp/services"
	projectModels "yaolight-workshop/backend/modules/project/models"
	taskModels "yaolight-workshop/backend/modules/task/models"
	taskRepos "yaolight-workshop/backend/modules/task/repositories"
	taskServices "yaolight-workshop/backend/modules/task/services"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

type ToolController struct {
	db               *gorm.DB
	workflowService  *workflowServices.WorkflowService
	taskService      *taskServices.TaskService
	artifactRepo     artifactRepos.ArtifactRepository
	projectArtifacts *artifactServices.ProjectArtifactQueryService
	knowledgeService *alkaidServices.ProjectKnowledgeService
	aiService        *aiServices.AIService
	executor         *workflowServices.WorkflowExecutor
}

func NewToolController(db *gorm.DB) *ToolController {
	workflowRepo := workflowRepos.NewWorkflowRepository(db)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(db)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(db)
	taskRepo := taskRepos.NewTaskRepository(db)
	nodeExecutionRepo := taskRepos.NewTaskNodeExecutionRepository(db)
	logRepo := taskRepos.NewTaskLogRepository(db)
	modelRepo := aiRepos.NewAIModelRepository(db)
	templateRepo := aiRepos.NewProviderTemplateRepository(db)
	pricingRepo := aiRepos.NewPricingConfigRepository(db)
	capabilityRepo := aiRepos.NewCapabilityConfigRepository(db)

	return &ToolController{
		db:               db,
		workflowService:  workflowServices.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo),
		taskService:      taskServices.NewTaskService(taskRepo, nodeExecutionRepo, logRepo),
		artifactRepo:     artifactRepos.NewArtifactRepository(db),
		projectArtifacts: artifactServices.NewProjectArtifactQueryService(db),
		knowledgeService: alkaidServices.NewProjectKnowledgeService(db),
		aiService:        aiServices.NewAIService(modelRepo, templateRepo, pricingRepo, capabilityRepo),
		executor:         workflowServices.NewWorkflowExecutor(),
	}
}

func (c *ToolController) ListTools(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": []gin.H{
			{"name": "get_current_user", "scope": "", "method": "GET", "path": "/api/mcp/tools/current-user"},
			{"name": "list_projects", "scope": "projects:read", "method": "GET", "path": "/api/mcp/tools/projects"},
			{"name": "get_project", "scope": "projects:read", "method": "GET", "path": "/api/mcp/tools/projects/:id"},
			{"name": "list_workflows", "scope": "workflows:read", "method": "GET", "path": "/api/mcp/tools/workflows"},
			{"name": "get_workflow", "scope": "workflows:read", "method": "GET", "path": "/api/mcp/tools/workflows/:id"},
			{"name": "get_workflow_nodes", "scope": "workflows:read", "method": "GET", "path": "/api/mcp/tools/workflows/:id/nodes"},
			{"name": "get_task", "scope": "tasks:read", "method": "GET", "path": "/api/mcp/tools/tasks/:id"},
			{"name": "get_task_logs", "scope": "tasks:read", "method": "GET", "path": "/api/mcp/tools/tasks/:id/logs"},
			{"name": "get_task_node_executions", "scope": "tasks:read", "method": "GET", "path": "/api/mcp/tools/tasks/:id/node-executions"},
			{"name": "list_task_artifacts", "scope": "artifacts:read", "method": "GET", "path": "/api/mcp/tools/tasks/:id/artifacts"},
			{"name": "list_project_artifacts", "scope": "artifacts:read", "method": "GET", "path": "/api/mcp/tools/projects/:id/artifacts"},
			{"name": "search_project_knowledge", "scope": "knowledge:read", "method": "GET", "path": "/api/mcp/tools/projects/:id/knowledge/search"},
			{"name": "list_available_models", "scope": "models:read", "method": "GET", "path": "/api/mcp/tools/models"},
			{"name": "run_workflow", "scope": "workflows:execute", "method": "POST", "path": "/api/mcp/tools/workflows/:id/run"},
			{"name": "cancel_task", "scope": "tasks:write", "method": "POST", "path": "/api/mcp/tools/tasks/:id/cancel"},
			{"name": "retry_task", "scope": "tasks:write", "method": "POST", "path": "/api/mcp/tools/tasks/:id/retry"},
		},
	})
}

func (c *ToolController) GetCurrentUser(ctx *gin.Context) {
	start := time.Now()
	userID, _ := currentUserID(ctx)
	var user userModels.User
	if err := c.db.Select("id, user_no, username, email, role, status, created_at, updated_at").First(&user, userID).Error; err != nil {
		c.failTool(ctx, "get_current_user", "", "", start, http.StatusInternalServerError, err.Error())
		return
	}
	c.succeedTool(ctx, "get_current_user", "", "", start, user)
}

func (c *ToolController) ListProjects(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "projects:read") {
		c.failTool(ctx, "list_projects", "", "", start, http.StatusForbidden, "missing scope projects:read")
		return
	}
	userID, _ := currentUserID(ctx)
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}

	var total int64
	query := c.db.Model(&projectModels.Project{}).Where("user_id = ? AND deleted_at IS NULL", userID)
	if err := query.Count(&total).Error; err != nil {
		c.failTool(ctx, "list_projects", "", "", start, http.StatusInternalServerError, err.Error())
		return
	}
	var projects []projectModels.Project
	if err := query.Order("updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&projects).Error; err != nil {
		c.failTool(ctx, "list_projects", "", "", start, http.StatusInternalServerError, err.Error())
		return
	}
	c.succeedTool(ctx, "list_projects", "", "", start, gin.H{"list": projects, "total": total, "page": page, "pageSize": pageSize})
}

func (c *ToolController) GetProject(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "projects:read") {
		c.failTool(ctx, "get_project", "project", ctx.Param("id"), start, http.StatusForbidden, "missing scope projects:read")
		return
	}
	userID, _ := currentUserID(ctx)
	id, ok := parseUintParam(ctx, "id")
	if !ok {
		c.failTool(ctx, "get_project", "project", ctx.Param("id"), start, http.StatusBadRequest, "invalid project id")
		return
	}
	var project projectModels.Project
	if err := c.db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).First(&project).Error; err != nil {
		c.failTool(ctx, "get_project", "project", ctx.Param("id"), start, http.StatusNotFound, "project not found")
		return
	}
	c.succeedTool(ctx, "get_project", "project", fmt.Sprint(id), start, project)
}

func (c *ToolController) ListWorkflows(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "workflows:read") {
		c.failTool(ctx, "list_workflows", "", "", start, http.StatusForbidden, "missing scope workflows:read")
		return
	}
	userID, _ := currentUserID(ctx)
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}

	query := c.db.Model(&workflowModels.Workflow{}).Where("user_id = ? AND deleted_at IS NULL", userID)
	if projectID := ctx.Query("projectId"); projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.failTool(ctx, "list_workflows", "", "", start, http.StatusInternalServerError, err.Error())
		return
	}
	var workflows []workflowModels.Workflow
	if err := query.Order("updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&workflows).Error; err != nil {
		c.failTool(ctx, "list_workflows", "", "", start, http.StatusInternalServerError, err.Error())
		return
	}
	c.succeedTool(ctx, "list_workflows", "", "", start, gin.H{"list": workflows, "total": total, "page": page, "pageSize": pageSize})
}

func (c *ToolController) GetWorkflow(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "workflows:read") {
		c.failTool(ctx, "get_workflow", "workflow", ctx.Param("id"), start, http.StatusForbidden, "missing scope workflows:read")
		return
	}
	workflow, ok := c.ownedWorkflow(ctx, start, "get_workflow")
	if !ok {
		return
	}
	c.succeedTool(ctx, "get_workflow", "workflow", fmt.Sprint(workflow.ID), start, workflow)
}

func (c *ToolController) GetWorkflowNodes(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "workflows:read") {
		c.failTool(ctx, "get_workflow_nodes", "workflow", ctx.Param("id"), start, http.StatusForbidden, "missing scope workflows:read")
		return
	}
	workflow, ok := c.ownedWorkflow(ctx, start, "get_workflow_nodes")
	if !ok {
		return
	}
	nodes, err := c.workflowService.GetWorkflowNodes(workflow.ID)
	if err != nil {
		c.failTool(ctx, "get_workflow_nodes", "workflow", fmt.Sprint(workflow.ID), start, http.StatusInternalServerError, err.Error())
		return
	}
	c.succeedTool(ctx, "get_workflow_nodes", "workflow", fmt.Sprint(workflow.ID), start, nodes)
}

func (c *ToolController) GetTask(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "tasks:read") {
		c.failTool(ctx, "get_task", "task", ctx.Param("id"), start, http.StatusForbidden, "missing scope tasks:read")
		return
	}
	task, ok := c.ownedTask(ctx, start, "get_task")
	if !ok {
		return
	}
	c.succeedTool(ctx, "get_task", "task", fmt.Sprint(task.ID), start, task)
}

func (c *ToolController) GetTaskLogs(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "tasks:read") {
		c.failTool(ctx, "get_task_logs", "task", ctx.Param("id"), start, http.StatusForbidden, "missing scope tasks:read")
		return
	}
	task, ok := c.ownedTask(ctx, start, "get_task_logs")
	if !ok {
		return
	}
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	limit := parsePositiveInt(ctx.DefaultQuery("limit", "100"), 100)
	level := ctx.Query("level")
	logs, err := c.taskService.GetTaskLogs(task.ID, level, page, limit)
	if err != nil {
		c.failTool(ctx, "get_task_logs", "task", fmt.Sprint(task.ID), start, http.StatusInternalServerError, err.Error())
		return
	}
	c.succeedTool(ctx, "get_task_logs", "task", fmt.Sprint(task.ID), start, logs)
}

func (c *ToolController) GetTaskNodeExecutions(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "tasks:read") {
		c.failTool(ctx, "get_task_node_executions", "task", ctx.Param("id"), start, http.StatusForbidden, "missing scope tasks:read")
		return
	}
	task, ok := c.ownedTask(ctx, start, "get_task_node_executions")
	if !ok {
		return
	}
	result, err := c.taskService.GetTaskNodeExecutions(task.ID)
	if err != nil {
		c.failTool(ctx, "get_task_node_executions", "task", fmt.Sprint(task.ID), start, http.StatusInternalServerError, err.Error())
		return
	}
	c.succeedTool(ctx, "get_task_node_executions", "task", fmt.Sprint(task.ID), start, result)
}

func (c *ToolController) ListTaskArtifacts(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "artifacts:read") {
		c.failTool(ctx, "list_task_artifacts", "task", ctx.Param("id"), start, http.StatusForbidden, "missing scope artifacts:read")
		return
	}
	userID, _ := currentUserID(ctx)
	task, ok := c.ownedTask(ctx, start, "list_task_artifacts")
	if !ok {
		return
	}
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "20"), 20)
	list, total, err := c.artifactRepo.ListByTask(userID, task.ID, page, pageSize)
	if err != nil {
		c.failTool(ctx, "list_task_artifacts", "task", fmt.Sprint(task.ID), start, http.StatusInternalServerError, err.Error())
		return
	}
	c.succeedTool(ctx, "list_task_artifacts", "task", fmt.Sprint(task.ID), start, gin.H{"list": list, "total": total, "page": page, "pageSize": pageSize})
}

func (c *ToolController) ListProjectArtifacts(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "artifacts:read") {
		c.failTool(ctx, "list_project_artifacts", "project", ctx.Param("id"), start, http.StatusForbidden, "missing scope artifacts:read")
		return
	}
	userID, _ := currentUserID(ctx)
	projectID, ok := parseUintParam(ctx, "id")
	if !ok {
		c.failTool(ctx, "list_project_artifacts", "project", ctx.Param("id"), start, http.StatusBadRequest, "invalid project id")
		return
	}
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "20"), 20)
	result, err := c.projectArtifacts.ListByProject(userID, projectID, artifactServices.ProjectArtifactListQuery{
		Keyword:  ctx.Query("keyword"),
		Kind:     ctx.Query("kind"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		c.failTool(ctx, "list_project_artifacts", "project", fmt.Sprint(projectID), start, http.StatusForbidden, err.Error())
		return
	}
	c.succeedTool(ctx, "list_project_artifacts", "project", fmt.Sprint(projectID), start, result)
}

func (c *ToolController) SearchProjectKnowledge(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "knowledge:read") {
		c.failTool(ctx, "search_project_knowledge", "project", ctx.Param("id"), start, http.StatusForbidden, "missing scope knowledge:read")
		return
	}
	userID, _ := currentUserID(ctx)
	projectID, ok := parseUintParam(ctx, "id")
	if !ok {
		c.failTool(ctx, "search_project_knowledge", "project", ctx.Param("id"), start, http.StatusBadRequest, "invalid project id")
		return
	}
	query := ctx.Query("query")
	if query == "" {
		query = ctx.Query("q")
	}
	limit := parsePositiveInt(ctx.DefaultQuery("limit", "5"), 5)
	result, err := c.knowledgeService.SearchTest(userID, projectID, query, limit)
	if err != nil {
		c.failTool(ctx, "search_project_knowledge", "project", fmt.Sprint(projectID), start, http.StatusBadRequest, err.Error())
		return
	}
	c.succeedTool(ctx, "search_project_knowledge", "project", fmt.Sprint(projectID), start, result)
}

func (c *ToolController) ListAvailableModels(ctx *gin.Context) {
	start := time.Now()
	if !requireScope(ctx, "models:read") {
		c.failTool(ctx, "list_available_models", "", "", start, http.StatusForbidden, "missing scope models:read")
		return
	}
	userID, _ := currentUserID(ctx)
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "50"), 50)
	if pageSize > 100 {
		pageSize = 100
	}
	userModels, total, err := c.aiService.GetModelsByUserID(userID, page, pageSize)
	if err != nil {
		c.failTool(ctx, "list_available_models", "", "", start, http.StatusInternalServerError, err.Error())
		return
	}
	systemModels := c.aiService.GetSystemPresetModels()
	c.succeedTool(ctx, "list_available_models", "", "", start, gin.H{
		"userModels":   userModels,
		"systemModels": systemModels,
		"total":        total,
		"page":         page,
		"pageSize":     pageSize,
	})
}

type confirmedRequest struct {
	Confirmed bool `json:"confirmed"`
}

type runWorkflowRequest struct {
	Confirmed    bool        `json:"confirmed"`
	RuntimeInput interface{} `json:"runtimeInput"`
}

func (c *ToolController) RunWorkflow(ctx *gin.Context) {
	start := time.Now()
	if !c.executionToolsAllowed(ctx, "run_workflow", "workflow", ctx.Param("id"), start) {
		return
	}
	if !requireScope(ctx, "workflows:execute") {
		c.failTool(ctx, "run_workflow", "workflow", ctx.Param("id"), start, http.StatusForbidden, "missing scope workflows:execute")
		return
	}
	userID, _ := currentUserID(ctx)
	workflow, ok := c.ownedWorkflow(ctx, start, "run_workflow")
	if !ok {
		return
	}
	var payload runWorkflowRequest
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		c.failTool(ctx, "run_workflow", "workflow", fmt.Sprint(workflow.ID), start, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}
	if !payload.Confirmed {
		c.failTool(ctx, "run_workflow", "workflow", fmt.Sprint(workflow.ID), start, http.StatusBadRequest, "confirmed=true is required before running workflow")
		return
	}

	req, err := c.buildExecutionRequest(userID, workflow.ID, payload.RuntimeInput)
	if err != nil {
		c.failTool(ctx, "run_workflow", "workflow", fmt.Sprint(workflow.ID), start, http.StatusInternalServerError, err.Error())
		return
	}
	if err := c.executor.ValidateExecutionRequest(req); err != nil {
		c.failTool(ctx, "run_workflow", "workflow", fmt.Sprint(workflow.ID), start, http.StatusBadRequest, err.Error())
		return
	}

	taskIDCh := make(chan uint, 1)
	req.OnTaskCreated = func(taskID uint) {
		select {
		case taskIDCh <- taskID:
		default:
		}
	}

	go func() {
		_ = c.executor.ExecuteWorkflowStreamConcurrent(context.Background(), req, func(string, string, bool, string, error) {})
	}()

	var taskID uint
	select {
	case taskID = <-taskIDCh:
	case <-time.After(2 * time.Second):
	}

	c.succeedTool(ctx, "run_workflow", "workflow", fmt.Sprint(workflow.ID), start, gin.H{
		"workflowId": workflow.ID,
		"taskId":     taskID,
		"status":     "started",
	})
}

func (c *ToolController) CancelTask(ctx *gin.Context) {
	start := time.Now()
	if !c.executionToolsAllowed(ctx, "cancel_task", "task", ctx.Param("id"), start) {
		return
	}
	if !requireScope(ctx, "tasks:write") {
		c.failTool(ctx, "cancel_task", "task", ctx.Param("id"), start, http.StatusForbidden, "missing scope tasks:write")
		return
	}
	userID, _ := currentUserID(ctx)
	task, ok := c.ownedTask(ctx, start, "cancel_task")
	if !ok {
		return
	}
	var payload confirmedRequest
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		c.failTool(ctx, "cancel_task", "task", fmt.Sprint(task.ID), start, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}
	if !payload.Confirmed {
		c.failTool(ctx, "cancel_task", "task", fmt.Sprint(task.ID), start, http.StatusBadRequest, "confirmed=true is required before cancelling task")
		return
	}
	result, err := c.taskService.CancelTask(task.ID, userID)
	if err != nil {
		c.failTool(ctx, "cancel_task", "task", fmt.Sprint(task.ID), start, http.StatusBadRequest, err.Error())
		return
	}
	c.succeedTool(ctx, "cancel_task", "task", fmt.Sprint(task.ID), start, result)
}

func (c *ToolController) RetryTask(ctx *gin.Context) {
	start := time.Now()
	if !c.executionToolsAllowed(ctx, "retry_task", "task", ctx.Param("id"), start) {
		return
	}
	if !requireScope(ctx, "tasks:write") {
		c.failTool(ctx, "retry_task", "task", ctx.Param("id"), start, http.StatusForbidden, "missing scope tasks:write")
		return
	}
	userID, _ := currentUserID(ctx)
	task, ok := c.ownedTask(ctx, start, "retry_task")
	if !ok {
		return
	}
	var payload confirmedRequest
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		c.failTool(ctx, "retry_task", "task", fmt.Sprint(task.ID), start, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}
	if !payload.Confirmed {
		c.failTool(ctx, "retry_task", "task", fmt.Sprint(task.ID), start, http.StatusBadRequest, "confirmed=true is required before retrying task")
		return
	}
	switch task.Status {
	case "failed", "timeout", "cancelled":
	default:
		c.failTool(ctx, "retry_task", "task", fmt.Sprint(task.ID), start, http.StatusBadRequest, "task retry not allowed for current status")
		return
	}

	req, err := c.buildExecutionRequest(userID, task.WorkflowID, nil)
	if err != nil {
		c.failTool(ctx, "retry_task", "task", fmt.Sprint(task.ID), start, http.StatusInternalServerError, err.Error())
		return
	}
	if err := c.executor.ValidateExecutionRequest(req); err != nil {
		c.failTool(ctx, "retry_task", "task", fmt.Sprint(task.ID), start, http.StatusBadRequest, err.Error())
		return
	}
	taskIDCh := make(chan uint, 1)
	req.OnTaskCreated = func(taskID uint) {
		select {
		case taskIDCh <- taskID:
		default:
		}
	}
	go func() {
		_ = c.executor.ExecuteWorkflowStreamConcurrent(context.Background(), req, func(string, string, bool, string, error) {})
	}()

	var newTaskID uint
	select {
	case newTaskID = <-taskIDCh:
	case <-time.After(2 * time.Second):
	}
	c.succeedTool(ctx, "retry_task", "task", fmt.Sprint(task.ID), start, gin.H{
		"sourceTaskId": task.ID,
		"newTaskId":    newTaskID,
		"status":       "retry_started",
	})
}

func (c *ToolController) buildExecutionRequest(userID uint, workflowID uint, runtimeInput interface{}) (workflowServices.ExecutionRequest, error) {
	workflowNodes, err := c.workflowService.GetWorkflowNodes(workflowID)
	if err != nil {
		return workflowServices.ExecutionRequest{}, fmt.Errorf("load workflow nodes failed: %w", err)
	}

	req := workflowServices.ExecutionRequest{
		UserID:       userID,
		WorkflowID:   workflowID,
		RuntimeInput: runtimeInput,
		RuntimeMeta:  map[string]interface{}{"source": "mcp"},
		Nodes:        make([]workflowServices.NodeConfig, len(workflowNodes.Nodes)),
		Edges:        make([]workflowServices.EdgeConfig, len(workflowNodes.Edges)),
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
	return req, nil
}

func (c *ToolController) ownedWorkflow(ctx *gin.Context, start time.Time, toolName string) (*workflowModels.Workflow, bool) {
	userID, _ := currentUserID(ctx)
	id, ok := parseUintParam(ctx, "id")
	if !ok {
		c.failTool(ctx, toolName, "workflow", ctx.Param("id"), start, http.StatusBadRequest, "invalid workflow id")
		return nil, false
	}
	var workflow workflowModels.Workflow
	if err := c.db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).First(&workflow).Error; err != nil {
		c.failTool(ctx, toolName, "workflow", fmt.Sprint(id), start, http.StatusNotFound, "workflow not found")
		return nil, false
	}
	return &workflow, true
}

func (c *ToolController) ownedTask(ctx *gin.Context, start time.Time, toolName string) (*taskModels.Task, bool) {
	userID, _ := currentUserID(ctx)
	id, ok := parseUintParam(ctx, "id")
	if !ok {
		c.failTool(ctx, toolName, "task", ctx.Param("id"), start, http.StatusBadRequest, "invalid task id")
		return nil, false
	}
	var task taskModels.Task
	if err := c.db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).First(&task).Error; err != nil {
		c.failTool(ctx, toolName, "task", fmt.Sprint(id), start, http.StatusNotFound, "task not found")
		return nil, false
	}
	return &task, true
}

func (c *ToolController) succeedTool(ctx *gin.Context, toolName, resourceType, resourceID string, start time.Time, data any) {
	c.recordCall(ctx, toolName, resourceType, resourceID, "success", "", start)
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "获取成功", "data": data})
}

func (c *ToolController) failTool(ctx *gin.Context, toolName, resourceType, resourceID string, start time.Time, statusCode int, message string) {
	c.recordCall(ctx, toolName, resourceType, resourceID, "error", message, start)
	ctx.JSON(statusCode, gin.H{"code": statusCode, "message": message, "data": nil})
}

func (c *ToolController) recordCall(ctx *gin.Context, toolName, resourceType, resourceID, status, errorMessage string, start time.Time) {
	userID, _ := currentUserID(ctx)
	var tokenID *uint
	if raw, ok := ctx.Get(mcpMiddleware.ContextTokenID); ok {
		if id, ok := raw.(uint); ok {
			tokenID = &id
		}
	}
	ip := ctx.ClientIP()
	ua := ctx.Request.UserAgent()
	log := mcpModels.MCPCallLog{
		UserID:    userID,
		TokenID:   tokenID,
		ToolName:  toolName,
		Status:    status,
		LatencyMS: time.Since(start).Milliseconds(),
		IP:        &ip,
		UserAgent: &ua,
	}
	if resourceType != "" {
		log.ResourceType = &resourceType
	}
	if resourceID != "" {
		log.ResourceID = &resourceID
	}
	if errorMessage != "" {
		log.ErrorMessage = &errorMessage
	}
	summary := requestSummary(ctx)
	if summary != "" {
		log.RequestSummary = &summary
	}
	_ = c.db.Create(&log).Error
}

func (c *ToolController) executionToolsAllowed(ctx *gin.Context, toolName, resourceType, resourceID string, start time.Time) bool {
	if mcpServices.LoadAccessSettings(c.db).AllowExecutionTools {
		return true
	}
	c.failTool(ctx, toolName, resourceType, resourceID, start, http.StatusForbidden, "MCP execution tools are disabled by administrator")
	return false
}

func requireScope(ctx *gin.Context, scope string) bool {
	return mcpMiddleware.HasScope(ctx, scope)
}

func parseUintParam(ctx *gin.Context, name string) (uint, bool) {
	id, err := strconv.ParseUint(ctx.Param(name), 10, 32)
	if err != nil {
		return 0, false
	}
	return uint(id), true
}

func requestSummary(ctx *gin.Context) string {
	query := ctx.Request.URL.RawQuery
	if query == "" {
		return ""
	}
	if len(query) > 500 {
		query = query[:500]
	}
	return query
}
