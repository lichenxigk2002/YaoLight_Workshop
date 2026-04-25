package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/mcp/models"
)

type CallLogController struct {
	db *gorm.DB
}

func NewCallLogController(db *gorm.DB) *CallLogController {
	return &CallLogController{db: db}
}

func (c *CallLogController) List(ctx *gin.Context) {
	userID, ok := currentUserID(ctx)
	if !ok {
		unauthorized(ctx)
		return
	}

	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}

	query := c.db.Model(&models.MCPCallLog{}).Where("user_id = ? AND deleted_at IS NULL", userID)
	if tool := ctx.Query("tool_name"); tool != "" {
		query = query.Where("tool_name = ?", tool)
	}
	if status := ctx.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取 MCP 调用日志失败: " + err.Error(), "data": nil})
		return
	}

	var logs []models.MCPCallLog
	if err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&logs).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取 MCP 调用日志失败: " + err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": gin.H{
			"list":     logs,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func parsePositiveInt(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
