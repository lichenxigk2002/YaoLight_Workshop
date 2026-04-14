package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/modules/notification/services"
	userModels "yaolight-workshop/backend/modules/user/models"
)

type AdminNotificationController struct {
	service *services.AdminNotificationService
}

func NewAdminNotificationController(service *services.AdminNotificationService) *AdminNotificationController {
	return &AdminNotificationController{service: service}
}

func (c *AdminNotificationController) GetSummary(ctx *gin.Context) {
	summary, err := c.service.GetSummary()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": summary})
}

func (c *AdminNotificationController) ListRecipientOptions(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "20"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}

	db := database.DB.Model(&userModels.User{})
	keyword := strings.TrimSpace(ctx.Query("keyword"))
	if keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		db = db.Where(
			"LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR CAST(id AS TEXT) LIKE ? OR CAST(user_no AS TEXT) LIKE ?",
			like, like, like, like,
		)
	}

	var users []userModels.User
	if err := db.Select(
		"id",
		"user_no",
		"username",
		"email",
		"avatar_url",
		"role",
		"status",
		"login_count",
		"last_login_at",
	).
		Order("created_at DESC").
		Limit(limit).
		Find(&users).Error; err != nil {
		adminInternalError(ctx, "failed to load recipient options", err)
		return
	}

	items := make([]gin.H, 0, len(users))
	for _, user := range users {
		items = append(items, gin.H{
			"id":            user.ID,
			"user_no":       user.UserNo,
			"username":      user.Username,
			"email":         user.Email,
			"avatar_url":    user.AvatarURL,
			"role":          user.Role,
			"status":        user.Status,
			"login_count":   user.LoginCount,
			"last_login_at": user.LastLoginAt,
		})
	}

	adminOK(ctx, "ok", items)
}

func (c *AdminNotificationController) List(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	var (
		userID *uint
		isRead *bool
	)
	if raw := ctx.Query("user_id"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			adminBadRequest(ctx, "invalid user_id")
			return
		}
		value := uint(parsed)
		userID = &value
	}
	if raw := ctx.Query("is_read"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			adminBadRequest(ctx, "invalid is_read")
			return
		}
		isRead = &parsed
	}

	list, total, err := c.service.List(services.AdminNotificationListParams{
		Page:     page,
		PageSize: pageSize,
		Keyword:  ctx.Query("keyword"),
		Type:     ctx.Query("type"),
		Category: ctx.Query("category"),
		UserID:   userID,
		IsRead:   isRead,
	})
	if err != nil {
		adminInternalError(ctx, "failed to list notifications", err)
		return
	}
	adminOK(ctx, "ok", gin.H{"list": list, "total": total, "page": page, "page_size": pageSize})
}

func (c *AdminNotificationController) ListJobs(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	var templateID *uint
	if raw := ctx.Query("template_id"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			adminBadRequest(ctx, "invalid template_id")
			return
		}
		value := uint(parsed)
		templateID = &value
	}

	list, total, err := c.service.ListJobs(services.AdminNotificationJobListParams{
		Page:       page,
		PageSize:   pageSize,
		Keyword:    ctx.Query("keyword"),
		Status:     ctx.Query("status"),
		TemplateID: templateID,
	})
	if err != nil {
		adminInternalError(ctx, "failed to list notification jobs", err)
		return
	}
	adminOK(ctx, "ok", gin.H{"list": list, "total": total, "page": page, "page_size": pageSize})
}

func (c *AdminNotificationController) ListDeliveries(ctx *gin.Context) {
	jobID, okID := adminParseUintParam(ctx, "id")
	if !okID {
		return
	}
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	list, total, err := c.service.ListDeliveries(services.AdminNotificationDeliveryListParams{
		SendJobID: jobID,
		Status:    ctx.Query("status"),
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		adminInternalError(ctx, "failed to list notification deliveries", err)
		return
	}
	adminOK(ctx, "ok", gin.H{"list": list, "total": total, "page": page, "page_size": pageSize})
}

func (c *AdminNotificationController) ListTemplates(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	var isActive *bool
	if raw := ctx.Query("is_active"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			adminBadRequest(ctx, "invalid is_active")
			return
		}
		isActive = &parsed
	}

	list, total, err := c.service.ListTemplates(services.AdminNotificationTemplateListParams{
		Page:     page,
		PageSize: pageSize,
		Keyword:  ctx.Query("keyword"),
		IsActive: isActive,
	})
	if err != nil {
		adminInternalError(ctx, "failed to list notification templates", err)
		return
	}
	adminOK(ctx, "ok", gin.H{"list": list, "total": total, "page": page, "page_size": pageSize})
}

func (c *AdminNotificationController) ListTemplateOptions(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "100"))
	if limit <= 0 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}

	var isActive *bool
	if raw := ctx.Query("is_active"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			adminBadRequest(ctx, "invalid is_active")
			return
		}
		isActive = &parsed
	}

	list, _, err := c.service.ListTemplates(services.AdminNotificationTemplateListParams{
		Page:     1,
		PageSize: limit,
		Keyword:  ctx.Query("keyword"),
		IsActive: isActive,
	})
	if err != nil {
		adminInternalError(ctx, "failed to list notification template options", err)
		return
	}

	adminOK(ctx, "ok", list)
}

func (c *AdminNotificationController) CreateTemplate(ctx *gin.Context) {
	operatorID, ok := adminCurrentUserID(ctx)
	if !ok {
		return
	}

	var body services.AdminNotificationTemplatePayload
	if err := ctx.ShouldBindJSON(&body); err != nil {
		adminBadRequest(ctx, "invalid request body")
		return
	}

	row, err := c.service.CreateTemplate(operatorID, body)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrAdminNotificationTemplateNameMissing),
			errors.Is(err, services.ErrAdminNotificationTemplateTitleMiss):
			adminBadRequest(ctx, err.Error())
		default:
			adminInternalError(ctx, "failed to create notification template", err)
		}
		return
	}
	adminOK(ctx, "created", row)
}

func (c *AdminNotificationController) UpdateTemplate(ctx *gin.Context) {
	operatorID, ok := adminCurrentUserID(ctx)
	if !ok {
		return
	}
	templateID, okID := adminParseUintParam(ctx, "id")
	if !okID {
		return
	}

	var body services.AdminNotificationTemplatePayload
	if err := ctx.ShouldBindJSON(&body); err != nil {
		adminBadRequest(ctx, "invalid request body")
		return
	}

	row, err := c.service.UpdateTemplate(operatorID, templateID, body)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrAdminNotificationTemplateNotFound):
			adminNotFound(ctx, err.Error())
		case errors.Is(err, services.ErrAdminNotificationTemplateNameMissing),
			errors.Is(err, services.ErrAdminNotificationTemplateTitleMiss):
			adminBadRequest(ctx, err.Error())
		default:
			adminInternalError(ctx, "failed to update notification template", err)
		}
		return
	}
	adminOK(ctx, "updated", row)
}

func (c *AdminNotificationController) GetAnalytics(ctx *gin.Context) {
	payload, err := c.service.GetAnalytics()
	if err != nil {
		adminInternalError(ctx, "failed to get notification analytics", err)
		return
	}
	adminOK(ctx, "ok", payload)
}

func (c *AdminNotificationController) Send(ctx *gin.Context) {
	operatorID, ok := adminCurrentUserID(ctx)
	if !ok {
		return
	}

	var body struct {
		Name              *string         `json:"name"`
		RecipientIDs      []uint          `json:"recipient_ids" binding:"required"`
		TemplateID        *uint           `json:"template_id"`
		TemplateVariables json.RawMessage `json:"template_variables"`
		Title             string          `json:"title"`
		Content           *string         `json:"content"`
		Type              string          `json:"type"`
		Category          *string         `json:"category"`
		ActionURL         *string         `json:"action_url"`
		ExpiresAt         *string         `json:"expires_at"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		adminBadRequest(ctx, "invalid request body")
		return
	}

	templateVariables, err := services.DecodeTemplateVariables(body.TemplateVariables)
	if err != nil {
		adminBadRequest(ctx, err.Error())
		return
	}

	var expiresAt *time.Time
	if body.ExpiresAt != nil && *body.ExpiresAt != "" {
		parsed, parseErr := time.Parse(time.RFC3339, *body.ExpiresAt)
		if parseErr != nil {
			adminBadRequest(ctx, "invalid expires_at")
			return
		}
		expiresAt = &parsed
	}

	result, err := c.service.Send(services.AdminNotificationSendInput{
		OperatorID:        operatorID,
		Name:              body.Name,
		RecipientIDs:      body.RecipientIDs,
		TemplateID:        body.TemplateID,
		TemplateVariables: templateVariables,
		Title:             body.Title,
		Content:           body.Content,
		Type:              body.Type,
		Category:          body.Category,
		ActionURL:         body.ActionURL,
		ExpiresAt:         expiresAt,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrAdminNotificationNoRecipients),
			errors.Is(err, services.ErrAdminNotificationTitleRequired),
			errors.Is(err, services.ErrAdminNotificationTitleTooLong),
			errors.Is(err, services.ErrAdminNotificationTooManyTargets),
			errors.Is(err, services.ErrAdminNotificationInvalidExpiry),
			errors.Is(err, services.ErrAdminNotificationTemplateNotFound),
			errors.Is(err, services.ErrAdminNotificationInvalidTemplateVars):
			adminBadRequest(ctx, err.Error())
		default:
			adminInternalError(ctx, "failed to send notifications", err)
		}
		return
	}

	adminOK(ctx, "ok", result)
}

func adminParseUintParam(ctx *gin.Context, name string) (uint, bool) {
	raw := ctx.Param(name)
	parsed, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		adminBadRequest(ctx, "invalid "+name)
		return 0, false
	}
	return uint(parsed), true
}

func adminCurrentUserID(ctx *gin.Context) (uint, bool) {
	value, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return 0, false
	}

	switch v := value.(type) {
	case uint:
		return v, true
	case int:
		return uint(v), true
	case float64:
		return uint(v), true
	default:
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return 0, false
	}
}

func adminOK(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": message, "data": data})
}

func adminBadRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": message, "data": nil})
}

func adminNotFound(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": message, "data": nil})
}

func adminInternalError(ctx *gin.Context, message string, err error) {
	ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": message + ": " + err.Error(), "data": nil})
}
