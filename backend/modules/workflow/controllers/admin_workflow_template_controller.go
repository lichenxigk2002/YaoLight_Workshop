package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

type AdminWorkflowTemplateController struct {
	service         *workflowServices.AdminWorkflowTemplateService
	workflowService *workflowServices.WorkflowService
}

func NewAdminWorkflowTemplateController() *AdminWorkflowTemplateController {
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	return &AdminWorkflowTemplateController{
		service:         workflowServices.NewAdminWorkflowTemplateService(database.DB),
		workflowService: workflowServices.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo),
	}
}

func (c *AdminWorkflowTemplateController) GetSummary(ctx *gin.Context) {
	summary, err := c.service.GetSummary()
	if err != nil {
		adminWorkflowTemplateInternalError(ctx, "failed to load workflow template summary", err)
		return
	}
	adminWorkflowTemplateOK(ctx, "ok", summary)
}

func (c *AdminWorkflowTemplateController) ListTemplates(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	var isPublic *bool
	if raw := ctx.Query("is_public"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			adminWorkflowTemplateBadRequest(ctx, "invalid is_public")
			return
		}
		isPublic = &parsed
	}

	list, total, err := c.service.ListTemplates(workflowServices.AdminWorkflowTemplateListQuery{
		Keyword:  ctx.Query("keyword"),
		Status:   ctx.Query("status"),
		Category: ctx.Query("category"),
		IsPublic: isPublic,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		adminWorkflowTemplateInternalError(ctx, "failed to list workflow templates", err)
		return
	}

	adminWorkflowTemplateOK(ctx, "ok", gin.H{
		"list":      list,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (c *AdminWorkflowTemplateController) ListSourceWorkflows(ctx *gin.Context) {
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	list, err := c.service.ListSourceWorkflows(workflowServices.AdminWorkflowTemplateSourceWorkflowQuery{
		Keyword:  ctx.Query("keyword"),
		PageSize: pageSize,
	})
	if err != nil {
		adminWorkflowTemplateInternalError(ctx, "failed to list source workflows", err)
		return
	}
	adminWorkflowTemplateOK(ctx, "ok", gin.H{"list": list})
}

func (c *AdminWorkflowTemplateController) GetTemplate(ctx *gin.Context) {
	id, ok := parseAdminWorkflowTemplateID(ctx)
	if !ok {
		return
	}

	item, err := c.service.GetTemplateDetail(id)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to load workflow template")
		return
	}
	adminWorkflowTemplateOK(ctx, "ok", item)
}

func (c *AdminWorkflowTemplateController) GetCanvas(ctx *gin.Context) {
	id, ok := parseAdminWorkflowTemplateID(ctx)
	if !ok {
		return
	}
	if err := c.service.EnsureTemplateExists(id); err != nil {
		c.handleServiceError(ctx, err, "failed to load workflow template canvas")
		return
	}

	canvas, err := c.workflowService.GetWorkflowNodes(id)
	if err != nil {
		adminWorkflowTemplateInternalError(ctx, "failed to load workflow template canvas", err)
		return
	}
	adminWorkflowTemplateOK(ctx, "ok", canvas)
}

func (c *AdminWorkflowTemplateController) SaveCanvas(ctx *gin.Context) {
	id, ok := parseAdminWorkflowTemplateID(ctx)
	if !ok {
		return
	}
	if err := c.service.EnsureTemplateExists(id); err != nil {
		c.handleServiceError(ctx, err, "failed to save workflow template canvas")
		return
	}

	var payload workflowServices.SaveWorkflowNodesRequest
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		adminWorkflowTemplateBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}
	if err := c.workflowService.SaveWorkflowNodes(id, &payload); err != nil {
		adminWorkflowTemplateInternalError(ctx, "failed to save workflow template canvas", err)
		return
	}
	adminWorkflowTemplateOK(ctx, "saved", gin.H{"id": id})
}

func (c *AdminWorkflowTemplateController) CreateTemplate(ctx *gin.Context) {
	operatorID, ok := adminWorkflowTemplateCurrentUserID(ctx)
	if !ok {
		return
	}

	var payload workflowServices.AdminWorkflowTemplatePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		adminWorkflowTemplateBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.CreateTemplate(operatorID, payload)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to create workflow template")
		return
	}
	adminWorkflowTemplateOK(ctx, "created", item)
}

func (c *AdminWorkflowTemplateController) UpdateTemplate(ctx *gin.Context) {
	id, ok := parseAdminWorkflowTemplateID(ctx)
	if !ok {
		return
	}

	var payload workflowServices.AdminWorkflowTemplatePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		adminWorkflowTemplateBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.UpdateTemplate(id, payload)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to update workflow template")
		return
	}
	adminWorkflowTemplateOK(ctx, "updated", item)
}

func (c *AdminWorkflowTemplateController) SyncTemplate(ctx *gin.Context) {
	id, ok := parseAdminWorkflowTemplateID(ctx)
	if !ok {
		return
	}

	var payload workflowServices.AdminWorkflowTemplateSyncPayload
	if err := ctx.ShouldBindJSON(&payload); err != nil && err.Error() != "EOF" {
		adminWorkflowTemplateBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.SyncTemplate(id, payload)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to sync workflow template")
		return
	}
	adminWorkflowTemplateOK(ctx, "synced", item)
}

func (c *AdminWorkflowTemplateController) DeleteTemplate(ctx *gin.Context) {
	id, ok := parseAdminWorkflowTemplateID(ctx)
	if !ok {
		return
	}

	if err := c.service.DeleteTemplate(id); err != nil {
		c.handleServiceError(ctx, err, "failed to delete workflow template")
		return
	}
	adminWorkflowTemplateOK(ctx, "deleted", gin.H{"id": id})
}

func (c *AdminWorkflowTemplateController) handleServiceError(ctx *gin.Context, err error, fallback string) {
	switch {
	case errors.Is(err, workflowServices.ErrAdminWorkflowTemplateNotFound),
		errors.Is(err, workflowServices.ErrAdminWorkflowTemplateSourceNotFound):
		adminWorkflowTemplateNotFound(ctx, err.Error())
	case errors.Is(err, workflowServices.ErrAdminWorkflowTemplateNameRequired),
		errors.Is(err, workflowServices.ErrAdminWorkflowTemplateSourceRequired),
		errors.Is(err, workflowServices.ErrAdminWorkflowTemplateSourceInvalid),
		errors.Is(err, workflowServices.ErrAdminWorkflowTemplateSourceEmpty),
		errors.Is(err, workflowServices.ErrAdminWorkflowTemplateStatusInvalid):
		adminWorkflowTemplateBadRequest(ctx, err.Error())
	default:
		adminWorkflowTemplateInternalError(ctx, fallback, err)
	}
}

func parseAdminWorkflowTemplateID(ctx *gin.Context) (uint, bool) {
	raw := ctx.Param("id")
	parsed, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		adminWorkflowTemplateBadRequest(ctx, "invalid id")
		return 0, false
	}
	return uint(parsed), true
}

func adminWorkflowTemplateCurrentUserID(ctx *gin.Context) (uint, bool) {
	raw, exists := ctx.Get("userID")
	if !exists {
		adminWorkflowTemplateBadRequest(ctx, "missing current user")
		return 0, false
	}
	userID, ok := raw.(uint)
	if !ok || userID == 0 {
		adminWorkflowTemplateBadRequest(ctx, "invalid current user")
		return 0, false
	}
	return userID, true
}

func adminWorkflowTemplateOK(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": message, "data": data})
}

func adminWorkflowTemplateBadRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": message, "data": nil})
}

func adminWorkflowTemplateNotFound(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": message, "data": nil})
}

func adminWorkflowTemplateInternalError(ctx *gin.Context, message string, err error) {
	ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": message, "error": err.Error(), "data": nil})
}
