package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
	projectSupport "yaolight-workshop/backend/modules/project/support"
)

type ProjectKnowledgeController struct {
	service *alkaidServices.ProjectKnowledgeService
}

func NewProjectKnowledgeController() *ProjectKnowledgeController {
	return &ProjectKnowledgeController{
		service: alkaidServices.NewProjectKnowledgeService(database.DB),
	}
}

func (c *ProjectKnowledgeController) ListKnowledge(ctx *gin.Context) {
	userID, ok := getProjectKnowledgeUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectKnowledgeProjectID(ctx)
	if !ok {
		return
	}

	var isActive *bool
	if raw := ctx.Query("is_active"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			projectKnowledgeBadRequest(ctx, "invalid is_active")
			return
		}
		isActive = &parsed
	}

	var workflowID *uint
	if raw := ctx.Query("workflow_id"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			projectKnowledgeBadRequest(ctx, "invalid workflow_id")
			return
		}
		value := uint(parsed)
		workflowID = &value
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	result, err := c.service.ListKnowledge(userID, projectID, alkaidServices.ProjectKnowledgeListQuery{
		Keyword:    ctx.Query("keyword"),
		Category:   ctx.Query("category"),
		Target:     ctx.Query("target"),
		IsActive:   isActive,
		WorkflowID: workflowID,
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		c.handleProjectKnowledgeError(ctx, err, "failed to list project knowledge")
		return
	}

	projectKnowledgeOK(ctx, "ok", result)
}

func (c *ProjectKnowledgeController) GetKnowledge(ctx *gin.Context) {
	userID, ok := getProjectKnowledgeUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectKnowledgeProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectKnowledgeID(ctx)
	if !ok {
		return
	}

	item, err := c.service.GetKnowledge(userID, projectID, id)
	if err != nil {
		c.handleProjectKnowledgeError(ctx, err, "failed to get project knowledge")
		return
	}

	projectKnowledgeOK(ctx, "ok", item)
}

func (c *ProjectKnowledgeController) CreateKnowledge(ctx *gin.Context) {
	userID, ok := getProjectKnowledgeUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectKnowledgeProjectID(ctx)
	if !ok {
		return
	}

	var payload alkaidServices.ProjectKnowledgePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		projectKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.CreateKnowledge(userID, projectID, &payload)
	if err != nil {
		c.handleProjectKnowledgeError(ctx, err, "failed to create project knowledge")
		return
	}

	projectKnowledgeOK(ctx, "created", item)
}

func (c *ProjectKnowledgeController) UpdateKnowledge(ctx *gin.Context) {
	userID, ok := getProjectKnowledgeUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectKnowledgeProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectKnowledgeID(ctx)
	if !ok {
		return
	}

	var payload alkaidServices.ProjectKnowledgePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		projectKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.UpdateKnowledge(userID, projectID, id, &payload)
	if err != nil {
		c.handleProjectKnowledgeError(ctx, err, "failed to update project knowledge")
		return
	}

	projectKnowledgeOK(ctx, "updated", item)
}

func (c *ProjectKnowledgeController) DeleteKnowledge(ctx *gin.Context) {
	userID, ok := getProjectKnowledgeUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectKnowledgeProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectKnowledgeID(ctx)
	if !ok {
		return
	}

	if err := c.service.DeleteKnowledge(userID, projectID, id); err != nil {
		c.handleProjectKnowledgeError(ctx, err, "failed to delete project knowledge")
		return
	}

	projectKnowledgeOK(ctx, "deleted", gin.H{"id": id})
}

func (c *ProjectKnowledgeController) SetKnowledgeStatus(ctx *gin.Context) {
	userID, ok := getProjectKnowledgeUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectKnowledgeProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectKnowledgeID(ctx)
	if !ok {
		return
	}

	var payload struct {
		IsActive bool `json:"isActive"`
	}
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		projectKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	if err := c.service.SetKnowledgeStatus(userID, projectID, id, payload.IsActive); err != nil {
		c.handleProjectKnowledgeError(ctx, err, "failed to set project knowledge status")
		return
	}

	projectKnowledgeOK(ctx, "updated", gin.H{"id": id, "isActive": payload.IsActive})
}

func (c *ProjectKnowledgeController) SearchTest(ctx *gin.Context) {
	userID, ok := getProjectKnowledgeUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectKnowledgeProjectID(ctx)
	if !ok {
		return
	}

	var payload struct {
		Query string `json:"query"`
		Limit int    `json:"limit"`
	}
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		projectKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	result, err := c.service.SearchTest(userID, projectID, payload.Query, payload.Limit)
	if err != nil {
		c.handleProjectKnowledgeError(ctx, err, "failed to search project knowledge")
		return
	}

	projectKnowledgeOK(ctx, "ok", result)
}

func (c *ProjectKnowledgeController) handleProjectKnowledgeError(ctx *gin.Context, err error, message string) {
	switch {
	case errors.Is(err, alkaidServices.ErrProjectKnowledgeNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "project knowledge not found", "data": nil})
	case errors.Is(err, alkaidServices.ErrInvalidProjectKnowledge):
		projectKnowledgeBadRequest(ctx, err.Error())
	case errors.Is(err, projectSupport.ErrProjectAccessDenied), errors.Is(err, projectSupport.ErrWorkflowAccessDenied):
		ctx.JSON(http.StatusForbidden, gin.H{"code": 403, "message": err.Error(), "data": nil})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": message + ": " + err.Error(), "data": nil})
	}
}

func getProjectKnowledgeUserID(ctx *gin.Context) (uint, bool) {
	value, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return 0, false
	}
	return value.(uint), true
}

func parseProjectKnowledgeProjectID(ctx *gin.Context) (uint, bool) {
	raw := ctx.Param("projectId")
	if raw == "" {
		raw = ctx.Param("id")
	}
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id == 0 {
		projectKnowledgeBadRequest(ctx, "invalid projectId")
		return 0, false
	}
	return uint(id), true
}

func parseProjectKnowledgeID(ctx *gin.Context) (uint, bool) {
	raw := ctx.Param("knowledgeId")
	if raw == "" {
		raw = ctx.Param("id")
	}
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id == 0 {
		projectKnowledgeBadRequest(ctx, "invalid id")
		return 0, false
	}
	return uint(id), true
}

func projectKnowledgeOK(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": message,
		"data":    data,
	})
}

func projectKnowledgeBadRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{
		"code":    400,
		"message": message,
		"data":    nil,
	})
}
