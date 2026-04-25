package controllers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/mcp/models"
	"yaolight-workshop/backend/modules/mcp/services"
)

type AdminController struct {
	db *gorm.DB
}

func NewAdminController(db *gorm.DB) *AdminController {
	return &AdminController{db: db}
}

func (c *AdminController) ListTokens(ctx *gin.Context) {
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}

	query := c.db.Table("mcp_tokens AS mt").
		Select("mt.*, u.username AS username, u.email AS email").
		Joins("LEFT JOIN users AS u ON u.id = mt.user_id").
		Where("mt.deleted_at IS NULL")
	if raw := ctx.Query("userId"); raw != "" {
		query = query.Where("mt.user_id = ?", raw)
	}
	if status := ctx.Query("status"); status != "" {
		switch status {
		case "active":
			query = query.Where("mt.revoked_at IS NULL AND (mt.expires_at IS NULL OR mt.expires_at > ?)", time.Now())
		case "revoked":
			query = query.Where("mt.revoked_at IS NOT NULL")
		case "expired":
			query = query.Where("mt.revoked_at IS NULL AND mt.expires_at IS NOT NULL AND mt.expires_at <= ?", time.Now())
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	var rows []struct {
		models.MCPToken
		Username *string `json:"username"`
		Email    *string `json:"email"`
	}
	if err := query.Order("mt.created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "获取成功", "data": gin.H{
		"list":     rows,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	}})
}

func (c *AdminController) RevokeToken(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil || id == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid token id", "data": nil})
		return
	}
	now := time.Now()
	if err := c.db.Model(&models.MCPToken{}).Where("id = ?", uint(id)).Update("revoked_at", now).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已吊销", "data": nil})
}

func (c *AdminController) RevokeUserTokens(ctx *gin.Context) {
	userID, err := strconv.ParseUint(ctx.Param("userId"), 10, 32)
	if err != nil || userID == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid user id", "data": nil})
		return
	}
	now := time.Now()
	if err := c.db.Model(&models.MCPToken{}).
		Where("user_id = ? AND revoked_at IS NULL", uint(userID)).
		Update("revoked_at", now).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已禁用用户 MCP Token", "data": nil})
}

func (c *AdminController) ListCallLogs(ctx *gin.Context) {
	page := parsePositiveInt(ctx.DefaultQuery("page", "1"), 1)
	pageSize := parsePositiveInt(ctx.DefaultQuery("pageSize", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}
	query := c.db.Table("mcp_call_logs AS ml").
		Select("ml.*, u.username AS username, u.email AS email").
		Joins("LEFT JOIN users AS u ON u.id = ml.user_id").
		Where("ml.deleted_at IS NULL")
	if raw := ctx.Query("userId"); raw != "" {
		query = query.Where("ml.user_id = ?", raw)
	}
	if tool := ctx.Query("toolName"); tool != "" {
		query = query.Where("ml.tool_name = ?", tool)
	}
	if status := ctx.Query("status"); status != "" {
		query = query.Where("ml.status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	var rows []struct {
		models.MCPCallLog
		Username *string `json:"username"`
		Email    *string `json:"email"`
	}
	if err := query.Order("ml.created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "获取成功", "data": gin.H{
		"list":     rows,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	}})
}

func (c *AdminController) GetSettings(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "获取成功", "data": services.LoadAccessSettings(c.db)})
}

func (c *AdminController) UpdateSettings(ctx *gin.Context) {
	var payload services.AccessSettings
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid settings payload", "data": nil})
		return
	}
	saved, err := services.SaveAccessSettings(c.db, payload)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已保存", "data": saved})
}
