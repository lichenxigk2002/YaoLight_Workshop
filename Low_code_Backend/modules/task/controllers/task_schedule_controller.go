package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/modules/task/services"
)

type TaskScheduleController struct {
	service *services.TaskScheduleService
}

func NewTaskScheduleController(service *services.TaskScheduleService) *TaskScheduleController {
	return &TaskScheduleController{service: service}
}

func (c *TaskScheduleController) ListSchedules(ctx *gin.Context) {
	userID, okUser := ctx.Get("userID")
	if !okUser {
		badRequest(ctx, "missing user id")
		return
	}

	query := services.TaskScheduleListQuery{
		TriggerType: ctx.Query("triggerType"),
		Page:        parseIntDefault(ctx.Query("page"), 1),
		PageSize:    parseIntDefault(ctx.Query("pageSize"), 20),
	}
	if rawWorkflowID := strings.TrimSpace(ctx.Query("workflowId")); rawWorkflowID != "" {
		parsed, err := strconv.ParseUint(rawWorkflowID, 10, 32)
		if err != nil {
			badRequest(ctx, "invalid workflowId")
			return
		}
		workflowID := uint(parsed)
		query.WorkflowID = &workflowID
	}

	data, err := c.service.ListSchedules(userID.(uint), query, buildBaseURL(ctx))
	if err != nil {
		internalError(ctx, "failed to list task schedules", err)
		return
	}

	ok(ctx, "ok", data)
}

func (c *TaskScheduleController) CreateSchedule(ctx *gin.Context) {
	userID, okUser := ctx.Get("userID")
	if !okUser {
		badRequest(ctx, "missing user id")
		return
	}

	var req services.CreateTaskScheduleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, err.Error())
		return
	}

	data, err := c.service.CreateSchedule(userID.(uint), req, buildBaseURL(ctx))
	if err != nil {
		c.writeError(ctx, err, "failed to create task schedule")
		return
	}

	ok(ctx, "ok", data)
}

func (c *TaskScheduleController) UpdateSchedule(ctx *gin.Context) {
	userID, okUser := ctx.Get("userID")
	if !okUser {
		badRequest(ctx, "missing user id")
		return
	}

	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var req services.UpdateTaskScheduleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, err.Error())
		return
	}

	data, err := c.service.UpdateSchedule(userID.(uint), id, req, buildBaseURL(ctx))
	if err != nil {
		c.writeError(ctx, err, "failed to update task schedule")
		return
	}

	ok(ctx, "ok", data)
}

func (c *TaskScheduleController) CancelSchedule(ctx *gin.Context) {
	userID, okUser := ctx.Get("userID")
	if !okUser {
		badRequest(ctx, "missing user id")
		return
	}

	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	data, err := c.service.CancelSchedule(userID.(uint), id, buildBaseURL(ctx))
	if err != nil {
		c.writeError(ctx, err, "failed to cancel task schedule")
		return
	}

	ok(ctx, "ok", data)
}

func (c *TaskScheduleController) TriggerNow(ctx *gin.Context) {
	userID, okUser := ctx.Get("userID")
	if !okUser {
		badRequest(ctx, "missing user id")
		return
	}

	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var req services.TriggerNowRequest
	if err := ctx.ShouldBindJSON(&req); err != nil && !strings.Contains(strings.ToLower(err.Error()), "eof") {
		badRequest(ctx, err.Error())
		return
	}

	data, err := c.service.TriggerNow(userID.(uint), id, req)
	if err != nil {
		c.writeError(ctx, err, "failed to trigger task schedule")
		return
	}

	ok(ctx, "ok", data)
}

func (c *TaskScheduleController) ListRuns(ctx *gin.Context) {
	userID, okUser := ctx.Get("userID")
	if !okUser {
		badRequest(ctx, "missing user id")
		return
	}

	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	data, err := c.service.ListRuns(
		userID.(uint),
		id,
		parseIntDefault(ctx.Query("page"), 1),
		parseIntDefault(ctx.Query("pageSize"), 10),
	)
	if err != nil {
		c.writeError(ctx, err, "failed to list task schedule runs")
		return
	}

	ok(ctx, "ok", data)
}

func (c *TaskScheduleController) InvokeWebhook(ctx *gin.Context) {
	rawBody, err := ctx.GetRawData()
	if err != nil {
		badRequest(ctx, "failed to read request body")
		return
	}

	var input interface{}
	if len(rawBody) > 0 {
		if err := json.Unmarshal(rawBody, &input); err != nil {
			badRequest(ctx, "invalid json body")
			return
		}
	}

	data, err := c.service.InvokeWebhook(
		ctx.Request.Context(),
		ctx.Param("token"),
		rawBody,
		input,
		ctx.GetHeader("X-Request-Id"),
		ctx.GetHeader("X-Trigger-Signature"),
		ctx.ClientIP(),
		ctx.Request.UserAgent(),
	)
	if err != nil {
		c.writeWebhookError(ctx, err)
		return
	}

	ctx.JSON(http.StatusAccepted, gin.H{
		"code":    202,
		"message": "accepted",
		"data":    data,
	})
}

func (c *TaskScheduleController) writeError(ctx *gin.Context, err error, message string) {
	switch {
	case errors.Is(err, services.ErrTaskScheduleNotFound):
		notFound(ctx, "task schedule not found")
	case errors.Is(err, services.ErrTaskScheduleReplayBlocked):
		ctx.JSON(http.StatusConflict, gin.H{"code": 409, "message": err.Error(), "data": nil})
	default:
		internalError(ctx, message, err)
	}
}

func (c *TaskScheduleController) writeWebhookError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrTaskScheduleNotFound):
		notFound(ctx, "trigger not found")
	case errors.Is(err, services.ErrTaskScheduleReplayBlocked):
		ctx.JSON(http.StatusConflict, gin.H{"code": 409, "message": err.Error(), "data": nil})
	case errors.Is(err, services.ErrTaskScheduleBadSignature):
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": err.Error(), "data": nil})
	case errors.Is(err, services.ErrTaskScheduleForbiddenIP):
		ctx.JSON(http.StatusForbidden, gin.H{"code": 403, "message": err.Error(), "data": nil})
	default:
		internalError(ctx, "failed to invoke trigger", err)
	}
}

func buildBaseURL(ctx *gin.Context) string {
	scheme := "http"
	if ctx.Request.TLS != nil {
		scheme = "https"
	}
	if forwardedProto := ctx.GetHeader("X-Forwarded-Proto"); forwardedProto != "" {
		scheme = forwardedProto
	}
	return scheme + "://" + ctx.Request.Host
}
