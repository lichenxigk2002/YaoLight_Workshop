package controllers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/database"
	systemRepos "yaolight-workshop/backend/modules/system/repositories"
	systemServices "yaolight-workshop/backend/modules/system/services"
)

type AdminOperationLogController struct {
	service *systemServices.AdminOperationLogService
}

func NewAdminOperationLogController() *AdminOperationLogController {
	repo := systemRepos.NewOperationLogRepository(database.DB)
	return &AdminOperationLogController{
		service: systemServices.NewAdminOperationLogService(repo),
	}
}

func (c *AdminOperationLogController) List(ctx *gin.Context) {
	var (
		userID     *uint
		resourceID *uint
		statusCode *int
	)

	if value, ok := parseOptionalUintQuery(ctx, "user_id"); ok {
		userID = value
	} else if ctx.Query("user_id") != "" {
		adminOperationLogBadRequest(ctx, "invalid user_id")
		return
	}

	if value, ok := parseOptionalUintQuery(ctx, "resource_id"); ok {
		resourceID = value
	} else if ctx.Query("resource_id") != "" {
		adminOperationLogBadRequest(ctx, "invalid resource_id")
		return
	}

	if value, ok := parseOptionalIntQuery(ctx, "status_code"); ok {
		statusCode = value
	} else if ctx.Query("status_code") != "" {
		adminOperationLogBadRequest(ctx, "invalid status_code")
		return
	}

	createdFrom, err := parseOptionalTime(ctx.Query("created_from"), false)
	if err != nil {
		adminOperationLogBadRequest(ctx, "invalid created_from")
		return
	}
	createdTo, err := parseOptionalTime(ctx.Query("created_to"), true)
	if err != nil {
		adminOperationLogBadRequest(ctx, "invalid created_to")
		return
	}

	result := strings.ToLower(strings.TrimSpace(ctx.Query("result")))
	if result != "" && result != "success" && result != "failed" {
		adminOperationLogBadRequest(ctx, "invalid result")
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	list, total, normalizedPage, normalizedPageSize, serviceErr := c.service.List(systemServices.AdminOperationLogListParams{
		Page:         page,
		PageSize:     pageSize,
		Keyword:      ctx.Query("keyword"),
		UserID:       userID,
		Action:       ctx.Query("action"),
		ResourceType: ctx.Query("resource_type"),
		ResourceID:   resourceID,
		Result:       result,
		StatusCode:   statusCode,
		CreatedFrom:  createdFrom,
		CreatedTo:    createdTo,
	})
	if serviceErr != nil {
		adminOperationLogInternalError(ctx, "failed to list operation logs", serviceErr)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data": gin.H{
			"list":      list,
			"total":     total,
			"page":      normalizedPage,
			"page_size": normalizedPageSize,
		},
	})
}

func (c *AdminOperationLogController) GetByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		adminOperationLogBadRequest(ctx, "invalid id")
		return
	}

	row, serviceErr := c.service.GetByID(uint(id))
	if serviceErr != nil {
		if serviceErr == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "operation log not found", "data": nil})
			return
		}
		adminOperationLogInternalError(ctx, "failed to load operation log", serviceErr)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": row})
}

func parseOptionalUintQuery(ctx *gin.Context, key string) (*uint, bool) {
	raw := strings.TrimSpace(ctx.Query(key))
	if raw == "" {
		return nil, true
	}
	value, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		return nil, false
	}
	parsed := uint(value)
	return &parsed, true
}

func parseOptionalIntQuery(ctx *gin.Context, key string) (*int, bool) {
	raw := strings.TrimSpace(ctx.Query(key))
	if raw == "" {
		return nil, true
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return nil, false
	}
	return &value, true
}

func parseOptionalTime(raw string, endOfDay bool) (*time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}

	layouts := []string{time.RFC3339, "2006-01-02"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err != nil {
			continue
		}
		if layout == "2006-01-02" && endOfDay {
			parsed = parsed.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		}
		return &parsed, nil
	}

	return nil, errors.New("invalid time")
}

func adminOperationLogBadRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": message, "data": nil})
}

func adminOperationLogInternalError(ctx *gin.Context, message string, err error) {
	ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": message + ": " + err.Error(), "data": nil})
}
