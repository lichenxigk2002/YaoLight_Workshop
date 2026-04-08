package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	projectServices "yaolight-workshop/backend/modules/project/services"
	projectSupport "yaolight-workshop/backend/modules/project/support"
)

type ProjectWebsiteSourceController struct {
	service *projectServices.ProjectWebsiteSourceService
}

func NewProjectWebsiteSourceController() *ProjectWebsiteSourceController {
	return &ProjectWebsiteSourceController{
		service: projectServices.NewProjectWebsiteSourceService(database.DB),
	}
}

func (c *ProjectWebsiteSourceController) ListSources(ctx *gin.Context) {
	userID, ok := getProjectAssetUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectAssetProjectID(ctx)
	if !ok {
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	result, err := c.service.ListSources(userID, projectID, projectServices.WebsiteSourceListQuery{
		Keyword:  ctx.Query("keyword"),
		Status:   ctx.Query("status"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		c.handleWebsiteSourceError(ctx, err, "failed to list website sources")
		return
	}
	projectAssetOK(ctx, "ok", result)
}

func (c *ProjectWebsiteSourceController) GetSource(ctx *gin.Context) {
	userID, ok := getProjectAssetUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectAssetProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectAssetID(ctx)
	if !ok {
		return
	}
	item, err := c.service.GetSource(userID, projectID, id)
	if err != nil {
		c.handleWebsiteSourceError(ctx, err, "failed to get website source")
		return
	}
	projectAssetOK(ctx, "ok", item)
}

func (c *ProjectWebsiteSourceController) CreateSource(ctx *gin.Context) {
	userID, ok := getProjectAssetUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectAssetProjectID(ctx)
	if !ok {
		return
	}

	var payload projectServices.WebsiteSourcePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		projectAssetBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}
	item, err := c.service.CreateSource(userID, projectID, &payload)
	if err != nil {
		c.handleWebsiteSourceError(ctx, err, "failed to create website source")
		return
	}
	projectAssetOK(ctx, "created", item)
}

func (c *ProjectWebsiteSourceController) UpdateSource(ctx *gin.Context) {
	userID, ok := getProjectAssetUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectAssetProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectAssetID(ctx)
	if !ok {
		return
	}

	var payload projectServices.WebsiteSourcePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		projectAssetBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}
	item, err := c.service.UpdateSource(userID, projectID, id, &payload)
	if err != nil {
		c.handleWebsiteSourceError(ctx, err, "failed to update website source")
		return
	}
	projectAssetOK(ctx, "updated", item)
}

func (c *ProjectWebsiteSourceController) DeleteSource(ctx *gin.Context) {
	userID, ok := getProjectAssetUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectAssetProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectAssetID(ctx)
	if !ok {
		return
	}
	if err := c.service.DeleteSource(userID, projectID, id); err != nil {
		c.handleWebsiteSourceError(ctx, err, "failed to delete website source")
		return
	}
	projectAssetOK(ctx, "deleted", gin.H{"id": id})
}

func (c *ProjectWebsiteSourceController) SetSourceStatus(ctx *gin.Context) {
	userID, ok := getProjectAssetUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectAssetProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectAssetID(ctx)
	if !ok {
		return
	}
	var payload struct {
		Status string `json:"status"`
	}
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		projectAssetBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}
	if err := c.service.SetSourceStatus(userID, projectID, id, payload.Status); err != nil {
		c.handleWebsiteSourceError(ctx, err, "failed to set website source status")
		return
	}
	projectAssetOK(ctx, "updated", gin.H{"id": id, "status": payload.Status})
}

func (c *ProjectWebsiteSourceController) CheckSource(ctx *gin.Context) {
	userID, ok := getProjectAssetUserID(ctx)
	if !ok {
		return
	}
	projectID, ok := parseProjectAssetProjectID(ctx)
	if !ok {
		return
	}
	id, ok := parseProjectAssetID(ctx)
	if !ok {
		return
	}
	result, err := c.service.CheckSource(userID, projectID, id)
	if err != nil {
		c.handleWebsiteSourceError(ctx, err, "failed to check website source")
		return
	}
	projectAssetOK(ctx, "ok", result)
}

func (c *ProjectWebsiteSourceController) handleWebsiteSourceError(ctx *gin.Context, err error, message string) {
	switch {
	case errors.Is(err, projectServices.ErrWebsiteSourceNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "website source not found", "data": nil})
	case errors.Is(err, projectServices.ErrInvalidWebsiteSource):
		projectAssetBadRequest(ctx, err.Error())
	case errors.Is(err, projectSupport.ErrProjectAccessDenied), errors.Is(err, projectSupport.ErrWorkflowAccessDenied):
		ctx.JSON(http.StatusForbidden, gin.H{"code": 403, "message": err.Error(), "data": nil})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": message + ": " + err.Error(), "data": nil})
	}
}

func getProjectAssetUserID(ctx *gin.Context) (uint, bool) {
	value, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return 0, false
	}
	return value.(uint), true
}

func parseProjectAssetProjectID(ctx *gin.Context) (uint, bool) {
	raw := ctx.Param("projectId")
	if raw == "" {
		raw = ctx.Param("id")
	}
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id == 0 {
		projectAssetBadRequest(ctx, "invalid projectId")
		return 0, false
	}
	return uint(id), true
}

func parseProjectAssetID(ctx *gin.Context) (uint, bool) {
	raw := ctx.Param("sourceId")
	if raw == "" {
		raw = ctx.Param("id")
	}
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id == 0 {
		projectAssetBadRequest(ctx, "invalid id")
		return 0, false
	}
	return uint(id), true
}

func projectAssetOK(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": message,
		"data":    data,
	})
}

func projectAssetBadRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{
		"code":    400,
		"message": message,
		"data":    nil,
	})
}
