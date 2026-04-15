package controllers

import (
	"errors"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/database"
	artifactRepos "yaolight-workshop/backend/modules/artifact/repositories"
	artifactServices "yaolight-workshop/backend/modules/artifact/services"
	"yaolight-workshop/backend/modules/task/repositories"
	"yaolight-workshop/backend/modules/task/services"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

type AdminTaskController struct {
	service *services.AdminTaskService
}

func NewAdminTaskController() *AdminTaskController {
	taskRepo := repositories.NewTaskRepository(database.DB)
	nodeExecutionRepo := repositories.NewTaskNodeExecutionRepository(database.DB)
	logRepo := repositories.NewTaskLogRepository(database.DB)
	taskService := services.NewTaskService(taskRepo, nodeExecutionRepo, logRepo)
	queryRepo := repositories.NewAdminTaskQueryRepository(database.DB)
	artifactRepo := artifactRepos.NewArtifactRepository(database.DB)
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	workflowService := workflowServices.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo)
	executor := workflowServices.NewWorkflowExecutor()

	return &AdminTaskController{
		service: services.NewAdminTaskService(queryRepo, taskService, nodeExecutionRepo, artifactRepo, workflowService, executor),
	}
}

func (c *AdminTaskController) ListTasks(ctx *gin.Context) {
	query, okQuery := parseAdminTaskListQuery(ctx)
	if !okQuery {
		return
	}

	result, err := c.service.ListTasks(query)
	if err != nil {
		internalError(ctx, "failed to list admin tasks", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) ListRunningTasks(ctx *gin.Context) {
	query, okQuery := parseAdminTaskListQuery(ctx)
	if !okQuery {
		return
	}

	result, err := c.service.ListRunningTasks(query)
	if err != nil {
		internalError(ctx, "failed to list running admin tasks", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) ListFailureTasks(ctx *gin.Context) {
	query, okQuery := parseAdminTaskListQuery(ctx)
	if !okQuery {
		return
	}
	query.ErrorKeyword = ctx.Query("error_keyword")
	query.NodeType = ctx.Query("node_type")

	result, err := c.service.ListFailureTasks(query)
	if err != nil {
		internalError(ctx, "failed to list failure admin tasks", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) GetFailureStats(ctx *gin.Context) {
	query, okQuery := parseAdminTaskListQuery(ctx)
	if !okQuery {
		return
	}
	query.ErrorKeyword = ctx.Query("error_keyword")
	query.NodeType = ctx.Query("node_type")

	result, err := c.service.GetFailureStats(query)
	if err != nil {
		internalError(ctx, "failed to load failure stats", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) GetSummary(ctx *gin.Context) {
	result, err := c.service.GetSummary()
	if err != nil {
		internalError(ctx, "failed to load task summary", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) GetTaskDetail(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	result, err := c.service.GetTaskDetail(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "record not found") {
			notFound(ctx, "task not found")
			return
		}
		internalError(ctx, "failed to load task detail", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) GetTaskNodeExecutions(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	result, err := c.service.GetTaskNodeExecutions(id)
	if err != nil {
		internalError(ctx, "failed to load task node executions", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) GetTaskNodeExecutionDetail(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}
	executionID, okExecutionID := parseUintParam(ctx, "executionId")
	if !okExecutionID {
		return
	}

	result, err := c.service.GetTaskNodeExecutionDetail(id, executionID)
	if err != nil {
		internalError(ctx, "failed to load task node execution detail", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) GetTaskLogs(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	page := parseIntDefault(ctx.Query("page"), 1)
	pageSize := parseIntDefault(ctx.Query("page_size"), 100)

	result, err := c.service.GetTaskLogs(repositories.AdminTaskLogQuery{
		TaskID:   id,
		Level:    ctx.Query("level"),
		NodeID:   ctx.Query("node_id"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		internalError(ctx, "failed to load task logs", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) ListTaskArtifacts(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	page := parseIntDefault(ctx.Query("page"), 1)
	pageSize := parseIntDefault(ctx.Query("page_size"), 20)

	result, err := c.service.ListTaskArtifacts(id, page, pageSize)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "record not found") {
			notFound(ctx, "task not found")
			return
		}
		internalError(ctx, "failed to load task artifacts", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) CancelTask(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	userIDAny, exists := ctx.Get("userID")
	if !exists {
		badRequest(ctx, "missing operator user id")
		return
	}

	result, err := c.service.CancelTask(id, userIDAny.(uint))
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound), strings.Contains(strings.ToLower(err.Error()), "record not found"):
			notFound(ctx, "task not found")
		case errors.Is(err, services.ErrAdminTaskActionNotAllowed):
			badRequest(ctx, "task cannot be cancelled in current status")
		default:
			internalError(ctx, "failed to cancel task", err)
		}
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) RetryTask(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	result, err := c.service.RetryTask(id)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound), strings.Contains(strings.ToLower(err.Error()), "record not found"):
			notFound(ctx, "task not found")
		case errors.Is(err, services.ErrAdminTaskRetryNotAllowed):
			badRequest(ctx, "task cannot be retried in current status")
		default:
			internalError(ctx, "failed to retry task", err)
		}
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminTaskController) DownloadArtifact(ctx *gin.Context) {
	artifactID, okID := parseUintParam(ctx, "artifactId")
	if !okID {
		return
	}

	info, err := c.service.GetArtifactDownloadInfo(artifactID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "record not found") {
			notFound(ctx, "artifact not found")
			return
		}
		internalError(ctx, "failed to load artifact", err)
		return
	}

	switch info.Storage {
	case "local":
		if _, statErr := os.Stat(info.LocalPath); statErr != nil {
			notFound(ctx, "artifact file not found")
			return
		}
		ctx.Header("Content-Type", info.MimeType)
		ctx.Header("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(filepath.Base(info.Name)))
		ctx.File(info.LocalPath)
	case "cos":
		// 管理端任务制品下载：为避免浏览器在 XHR/fetch 中跟随 302 重定向到 COS 域名触发 CORS，
		// 这里不再跳转到 COS 预签名 URL，而是由后端从 COS 拉取文件内容并直接返回。
		artifact := info.Artifact
		if artifact == nil {
			internalError(ctx, "failed to load artifact", errors.New("artifact model is nil for cos storage"))
			return
		}
		content, err := artifactServices.ArtifactContent(artifact)
		if err != nil {
			internalError(ctx, "failed to read artifact content", err)
			return
		}
		ctx.Header("Content-Type", info.MimeType)
		ctx.Header("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(filepath.Base(info.Name)))
		ctx.Header("Content-Length", strconv.FormatInt(int64(len(content)), 10))
		ctx.Writer.WriteHeader(http.StatusOK)
		if _, err := ctx.Writer.Write(content); err != nil {
			// 写回客户端失败，仅记录错误
			return
		}
	default:
		internalError(ctx, "failed to load artifact", errors.New("unsupported artifact storage"))
	}
}

func parseDateQuery(raw string, endOfDay bool) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}

	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return &parsed, nil
	}

	parsed, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return nil, err
	}
	if endOfDay {
		value := parsed.Add(24*time.Hour - time.Nanosecond)
		return &value, nil
	}
	return &parsed, nil
}

func parseUintString(raw string) (uint, error) {
	value, err := strconv.ParseUint(raw, 10, 32)
	return uint(value), err
}

func parseIntDefault(raw string, defaultValue int) int {
	if raw == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return defaultValue
	}
	if value <= 0 {
		return defaultValue
	}
	return value
}

func parseAdminTaskListQuery(ctx *gin.Context) (repositories.AdminTaskListQuery, bool) {
	var query repositories.AdminTaskListQuery

	if raw := ctx.Query("user_id"); raw != "" {
		value, err := parseUintString(raw)
		if err != nil {
			badRequest(ctx, "invalid user_id")
			return query, false
		}
		query.UserID = &value
	}

	if raw := ctx.Query("workflow_id"); raw != "" {
		value, err := parseUintString(raw)
		if err != nil {
			badRequest(ctx, "invalid workflow_id")
			return query, false
		}
		query.WorkflowID = &value
	}

	startedFrom, err := parseDateQuery(ctx.Query("started_from"), false)
	if err != nil {
		badRequest(ctx, "invalid started_from")
		return query, false
	}
	startedTo, err := parseDateQuery(ctx.Query("started_to"), true)
	if err != nil {
		badRequest(ctx, "invalid started_to")
		return query, false
	}

	query.Keyword = ctx.Query("keyword")
	query.Status = ctx.Query("status")
	query.StartedFrom = startedFrom
	query.StartedTo = startedTo
	query.Page = parseIntDefault(ctx.Query("page"), 1)
	query.PageSize = parseIntDefault(ctx.Query("page_size"), 20)
	query.SortBy = ctx.DefaultQuery("sort_by", "created_at")
	query.SortOrder = ctx.DefaultQuery("sort_order", "DESC")

	return query, true
}
