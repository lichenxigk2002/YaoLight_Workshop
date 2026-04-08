package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

type AdminKnowledgeController struct {
	service *alkaidServices.AdminKnowledgeService
}

func NewAdminKnowledgeController() *AdminKnowledgeController {
	return &AdminKnowledgeController{
		service: alkaidServices.NewAdminKnowledgeService(database.DB),
	}
}

func (c *AdminKnowledgeController) GetSummary(ctx *gin.Context) {
	summary, err := c.service.GetSummary()
	if err != nil {
		adminKnowledgeInternalError(ctx, "failed to load knowledge summary", err)
		return
	}
	adminKnowledgeOK(ctx, "ok", summary)
}

func (c *AdminKnowledgeController) ListKnowledge(ctx *gin.Context) {
	var isActive *bool
	if raw := ctx.Query("is_active"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			adminKnowledgeBadRequest(ctx, "invalid is_active")
			return
		}
		isActive = &parsed
	}

	var userID *uint
	if raw := ctx.Query("user_id"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			adminKnowledgeBadRequest(ctx, "invalid user_id")
			return
		}
		value := uint(parsed)
		userID = &value
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	result, err := c.service.ListKnowledge(alkaidServices.AdminKnowledgeListQuery{
		Keyword:   ctx.Query("keyword"),
		Category:  ctx.Query("category"),
		Target:    ctx.Query("target"),
		IsActive:  isActive,
		Scope:     ctx.DefaultQuery("scope", "all"),
		UserID:    userID,
		Page:      page,
		PageSize:  pageSize,
		SortBy:    ctx.DefaultQuery("sort_by", "updated_at"),
		SortOrder: ctx.DefaultQuery("sort_order", "DESC"),
	})
	if err != nil {
		adminKnowledgeInternalError(ctx, "failed to list knowledge", err)
		return
	}

	adminKnowledgeOK(ctx, "ok", result)
}

func (c *AdminKnowledgeController) GetKnowledge(ctx *gin.Context) {
	id, ok := parseAdminKnowledgeID(ctx)
	if !ok {
		return
	}

	item, err := c.service.GetKnowledge(id)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to load knowledge")
		return
	}

	adminKnowledgeOK(ctx, "ok", item)
}

func (c *AdminKnowledgeController) CreateKnowledge(ctx *gin.Context) {
	var payload alkaidServices.AdminKnowledgePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		adminKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.CreateKnowledge(&payload)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to create knowledge")
		return
	}

	adminKnowledgeOK(ctx, "created", item)
}

func (c *AdminKnowledgeController) UpdateKnowledge(ctx *gin.Context) {
	id, ok := parseAdminKnowledgeID(ctx)
	if !ok {
		return
	}

	var payload alkaidServices.AdminKnowledgePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		adminKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.UpdateKnowledge(id, &payload)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to update knowledge")
		return
	}

	adminKnowledgeOK(ctx, "updated", item)
}

func (c *AdminKnowledgeController) DeleteKnowledge(ctx *gin.Context) {
	id, ok := parseAdminKnowledgeID(ctx)
	if !ok {
		return
	}

	if err := c.service.DeleteKnowledge(id); err != nil {
		c.handleServiceError(ctx, err, "failed to delete knowledge")
		return
	}

	adminKnowledgeOK(ctx, "deleted", gin.H{"id": id})
}

func (c *AdminKnowledgeController) SetKnowledgeStatus(ctx *gin.Context) {
	id, ok := parseAdminKnowledgeID(ctx)
	if !ok {
		return
	}

	var payload struct {
		IsActive bool `json:"is_active"`
	}
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		adminKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	if err := c.service.SetKnowledgeStatus(id, payload.IsActive); err != nil {
		c.handleServiceError(ctx, err, "failed to update knowledge status")
		return
	}

	adminKnowledgeOK(ctx, "updated", gin.H{"id": id, "is_active": payload.IsActive})
}

func (c *AdminKnowledgeController) SearchTest(ctx *gin.Context) {
	var payload struct {
		Query  string `json:"query"`
		UserID *uint  `json:"user_id"`
		Limit  int    `json:"limit"`
	}
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		adminKnowledgeBadRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	result, err := c.service.SearchTest(payload.Query, payload.UserID, payload.Limit)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to search knowledge")
		return
	}

	adminKnowledgeOK(ctx, "ok", result)
}

func (c *AdminKnowledgeController) handleServiceError(ctx *gin.Context, err error, message string) {
	switch {
	case errors.Is(err, alkaidServices.ErrKnowledgeNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "knowledge not found", "data": nil})
	case errors.Is(err, alkaidServices.ErrInvalidKnowledge):
		adminKnowledgeBadRequest(ctx, err.Error())
	default:
		adminKnowledgeInternalError(ctx, message, err)
	}
}

func parseAdminKnowledgeID(ctx *gin.Context) (uint, bool) {
	raw := ctx.Param("id")
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		adminKnowledgeBadRequest(ctx, "invalid id")
		return 0, false
	}
	return uint(id), true
}

func adminKnowledgeOK(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": message,
		"data":    data,
	})
}

func adminKnowledgeBadRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{
		"code":    400,
		"message": message,
		"data":    nil,
	})
}

func adminKnowledgeInternalError(ctx *gin.Context, message string, err error) {
	ctx.JSON(http.StatusInternalServerError, gin.H{
		"code":    500,
		"message": message + ": " + err.Error(),
		"data":    nil,
	})
}
