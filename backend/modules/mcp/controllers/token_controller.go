package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/mcp/services"
)

type TokenController struct {
	tokenService *services.TokenService
}

type createTokenRequest struct {
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes"`
	ExpiresAt *string  `json:"expires_at"`
	ExpiresIn *int     `json:"expires_in_days"`
}

func NewTokenController(db *gorm.DB) *TokenController {
	return &TokenController{tokenService: services.NewTokenService(db)}
}

func (c *TokenController) Create(ctx *gin.Context) {
	userID, ok := currentUserID(ctx)
	if !ok {
		unauthorized(ctx)
		return
	}
	settings := services.LoadAccessSettings(c.tokenService.DB())

	var req createTokenRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}

	expiresAt, err := parseExpiry(req.ExpiresAt, req.ExpiresIn, settings.DefaultExpiresInDays, settings.MaxExpiresInDays)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	scopes := req.Scopes
	if len(scopes) == 0 {
		scopes = settings.DefaultScopes
	}
	scopes = services.NormalizeScopes(scopes, settings.AllowExecutionTools)
	if len(scopes) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "当前 MCP 策略未允许任何权限范围", "data": nil})
		return
	}
	if settings.MaxTokensPerUser > 0 {
		count, err := c.tokenService.CountActive(userID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "检查 MCP Token 数量失败: " + err.Error(), "data": nil})
			return
		}
		if count >= int64(settings.MaxTokensPerUser) {
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": fmt.Sprintf("每个用户最多创建 %d 个可用 MCP Token", settings.MaxTokensPerUser), "data": nil})
			return
		}
	}

	created, err := c.tokenService.Create(userID, req.Name, scopes, expiresAt)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建 MCP Token 失败: " + err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "创建成功，请立即复制 token，关闭后将不再展示明文",
		"data": gin.H{
			"token":        created.PlainToken,
			"token_record": created.TokenRecord,
		},
	})
}

func (c *TokenController) List(ctx *gin.Context) {
	userID, ok := currentUserID(ctx)
	if !ok {
		unauthorized(ctx)
		return
	}

	tokens, err := c.tokenService.List(userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取 MCP Token 列表失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "获取成功", "data": tokens})
}

func (c *TokenController) Settings(ctx *gin.Context) {
	settings := services.LoadAccessSettings(c.tokenService.DB())
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "获取成功", "data": settings})
}

func (c *TokenController) Revoke(ctx *gin.Context) {
	userID, ok := currentUserID(ctx)
	if !ok {
		unauthorized(ctx)
		return
	}
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 Token ID", "data": nil})
		return
	}
	if err := c.tokenService.Revoke(userID, uint(id)); err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "MCP Token 不存在或已吊销", "data": nil})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "吊销 MCP Token 失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已吊销", "data": nil})
}

func (c *TokenController) DeleteRecord(ctx *gin.Context) {
	userID, ok := currentUserID(ctx)
	if !ok {
		unauthorized(ctx)
		return
	}
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 Token ID", "data": nil})
		return
	}
	if err := c.tokenService.DeleteRecord(userID, uint(id)); err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "只能删除已吊销或已过期的 MCP Token 记录", "data": nil})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "删除 MCP Token 记录失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已删除", "data": nil})
}

func currentUserID(ctx *gin.Context) (uint, bool) {
	raw, exists := ctx.Get("userID")
	if !exists {
		return 0, false
	}
	userID, ok := raw.(uint)
	return userID, ok
}

func unauthorized(ctx *gin.Context) {
	ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
}

func parseExpiry(expiresAt *string, expiresInDays *int, defaultDays int, maxDays int) (*time.Time, error) {
	if maxDays <= 0 {
		maxDays = 365
	}
	if expiresAt != nil && *expiresAt != "" {
		parsed, err := time.Parse(time.RFC3339, *expiresAt)
		if err != nil {
			return nil, err
		}
		if parsed.After(time.Now().AddDate(0, 0, maxDays)) {
			return nil, fmt.Errorf("expires_at must be within %d days", maxDays)
		}
		return &parsed, nil
	}
	if expiresInDays != nil {
		if *expiresInDays <= 0 || *expiresInDays > maxDays {
			return nil, fmt.Errorf("expires_in_days must be between 1 and %d", maxDays)
		}
		expires := time.Now().AddDate(0, 0, *expiresInDays)
		return &expires, nil
	}
	if defaultDays <= 0 || defaultDays > maxDays {
		defaultDays = maxDays
	}
	defaultExpiry := time.Now().AddDate(0, 0, defaultDays)
	return &defaultExpiry, nil
}
