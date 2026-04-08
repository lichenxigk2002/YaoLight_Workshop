package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/database"
	systemRepos "yaolight-workshop/backend/modules/system/repositories"
	systemServices "yaolight-workshop/backend/modules/system/services"
)

type AdminAppLogController struct {
	service *systemServices.AppLogService
}

func NewAdminAppLogController() *AdminAppLogController {
	repo := systemRepos.NewAppLogRepository(database.DB)
	return &AdminAppLogController{
		service: systemServices.NewAppLogService(repo),
	}
}

func (c *AdminAppLogController) List(ctx *gin.Context) {
	var code *int

	if value, ok := parseOptionalIntQuery(ctx, "code"); ok {
		code = value
	} else if ctx.Query("code") != "" {
		adminOperationLogBadRequest(ctx, "invalid code")
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

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	list, total, normalizedPage, normalizedPageSize, serviceErr := c.service.List(systemServices.AdminAppLogListParams{
		Page:        page,
		PageSize:    pageSize,
		Keyword:     ctx.Query("keyword"),
		Level:       strings.ToLower(strings.TrimSpace(ctx.Query("level"))),
		Owner:       strings.TrimSpace(ctx.Query("owner")),
		Code:        code,
		FilePath:    ctx.Query("file_path"),
		CreatedFrom: createdFrom,
		CreatedTo:   createdTo,
	})
	if serviceErr != nil {
		adminOperationLogInternalError(ctx, "failed to list app logs", serviceErr)
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

func (c *AdminAppLogController) GetByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		adminOperationLogBadRequest(ctx, "invalid id")
		return
	}

	row, serviceErr := c.service.GetByID(uint(id))
	if serviceErr != nil {
		if serviceErr == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "app log not found", "data": nil})
			return
		}
		adminOperationLogInternalError(ctx, "failed to load app log", serviceErr)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": row})
}

func (c *AdminAppLogController) DeleteByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		adminOperationLogBadRequest(ctx, "invalid id")
		return
	}

	if serviceErr := c.service.DeleteByID(uint(id)); serviceErr != nil {
		if serviceErr == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "app log not found", "data": nil})
			return
		}
		adminOperationLogInternalError(ctx, "failed to delete app log", serviceErr)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "deleted", "data": nil})
}

func (c *AdminAppLogController) DeleteAll(ctx *gin.Context) {
	deleted, serviceErr := c.service.DeleteAll()
	if serviceErr != nil {
		adminOperationLogInternalError(ctx, "failed to clear app logs", serviceErr)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "cleared",
		"data": gin.H{
			"deleted": deleted,
		},
	})
}
