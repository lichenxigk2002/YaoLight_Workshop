package controllers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/cache"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	userModels "yaolight-workshop/backend/modules/user/models"
	"yaolight-workshop/backend/modules/user/repositories"
	"yaolight-workshop/backend/modules/user/services"
)

// AuthController 认证控制器
type AuthController struct {
	authService *services.AuthService
}

// NewAuthController 创建认证控制器（内部创建 authService）
func NewAuthController() *AuthController {
	userRepo := repositories.NewUserRepository(database.DB)
	oauthBindingRepo := repositories.NewOAuthBindingRepository(database.DB)
	return NewAuthControllerWithService(services.NewAuthService(userRepo, oauthBindingRepo))
}

// NewAuthControllerWithService 使用已有 authService 创建认证控制器（供 OAuth 等共用）
func NewAuthControllerWithService(authService *services.AuthService) *AuthController {
	return &AuthController{authService: authService}
}

// Register 用户注册
// @Summary 用户注册
// @Description 注册新用户
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.RegisterRequest true "注册信息"
// @Success 200 {object} map[string]interface{} "注册成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 409 {object} map[string]interface{} "用户已存在"
// @Router /api/auth/register [post]
func (c *AuthController) Register(ctx *gin.Context) {
	var req services.RegisterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	user, err := c.authService.Register(&req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		code := 500
		message := "注册失败"

		if err == services.ErrUserExists {
			statusCode = http.StatusConflict
			code = 409
			message = "用户名或邮箱已存在"
		} else if err == services.ErrPasswordTooShort {
			statusCode = http.StatusBadRequest
			code = 400
			message = "密码长度至少6位"
		} else {
			// 记录未知错误
			log.Printf("注册失败: %v", err)
			message = "注册失败: " + err.Error()
		}

		ctx.JSON(statusCode, gin.H{
			"code":    code,
			"message": message,
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "注册成功",
		"data":    user,
	})
}

// Login 用户登录
// @Summary 用户登录
// @Description 用户登录获取 Token
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.LoginRequest true "登录信息"
// @Success 200 {object} map[string]interface{} "登录成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "用户名或密码错误"
// @Router /api/auth/login [post]
func (c *AuthController) Login(ctx *gin.Context) {
	var req services.LoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	response, err := c.authService.Login(&req)
	if err != nil {
		statusCode := http.StatusUnauthorized
		code := 401
		message := "用户名或密码错误"

		if err == services.ErrUserNotFound {
			message = "用户不存在"
		} else if err == services.ErrInvalidPassword {
			message = "密码错误"
		}

		ctx.JSON(statusCode, gin.H{
			"code":    code,
			"message": message,
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "登录成功",
		"data":    response,
	})
}

// GetCurrentUser 获取当前用户信息
// @Summary 获取当前用户信息
// @Description 获取当前登录用户的信息
// @Tags 认证
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/users/current [get]
func (c *AuthController) GetCurrentUser(ctx *gin.Context) {
	// 从中间件获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	user, err := c.authService.GetUserByID(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "用户不存在",
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    user,
	})
}

// GetOAuthBindings 获取当前用户 GitHub/Google 绑定状态
func (c *AuthController) GetOAuthBindings(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	githubBound, googleBound, err := c.authService.GetOAuthBindings(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"code": 200, "message": "ok",
		"data": gin.H{"github": githubBound, "google": googleBound},
	})
}

// RequestOAuthBind 发起绑定第三方：生成一次性 state，返回跳转 URL（前端跳转到该 URL 完成授权）
func (c *AuthController) RequestOAuthBind(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var req struct {
		Provider string `json:"provider" binding:"required,oneof=github google"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "provider 必填且为 github 或 google", "data": nil})
		return
	}
	token, err := cache.GetOAuthBindCache().CreateToken(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "生成绑定 token 失败", "data": nil})
		return
	}
	scheme := "http"
	if ctx.Request.TLS != nil {
		scheme = "https"
	}
	if ctx.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	base := scheme + "://" + ctx.Request.Host + "/api/auth"
	redirectURL := base + "/" + req.Provider + "?state=bind_" + token
	ctx.JSON(http.StatusOK, gin.H{
		"code": 200, "message": "ok",
		"data": gin.H{"redirectUrl": redirectURL},
	})
}

// UnbindOAuth 解绑指定第三方
func (c *AuthController) UnbindOAuth(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	provider := ctx.Param("provider")
	if provider != "github" && provider != "google" {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "provider 为 github 或 google", "data": nil})
		return
	}
	if err := c.authService.UnbindOAuth(userID.(uint), provider); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已解绑", "data": nil})
}

// SendDeactivateCode 发送账号注销验证码（发到当前用户邮箱）
func (c *AuthController) SendDeactivateCode(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	if err := c.authService.SendDeactivateCode(userID.(uint)); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "验证码已发送到您的邮箱", "data": nil})
}

// ConfirmDeactivate 校验验证码与确认文案后注销账号（需输入当前用户名确认）
func (c *AuthController) ConfirmDeactivate(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var req struct {
		Code        string `json:"code" binding:"required,len=6"`
		ConfirmText string `json:"confirmText" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请填写验证码和确认内容（当前用户名）", "data": nil})
		return
	}
	if err := c.authService.ConfirmDeactivate(userID.(uint), req.Code, strings.TrimSpace(req.ConfirmText)); err != nil {
		if err == services.ErrInvalidCode {
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "验证码错误或已过期", "data": nil})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "账号已注销", "data": nil})
}

// SendEmailBindCode 发送绑定邮箱验证码（发到新邮箱，当前未绑定时使用）
func (c *AuthController) SendEmailBindCode(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var req struct {
		NewEmail string `json:"newEmail" binding:"required,email"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请填写有效的新邮箱", "data": nil})
		return
	}
	if err := c.authService.SendEmailBindCode(userID.(uint), req.NewEmail); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "验证码已发送到该邮箱", "data": nil})
}

// SendEmailChangeCodeToNew 发送换绑验证码到新邮箱（换绑时向新邮箱发验证码）
func (c *AuthController) SendEmailChangeCodeToNew(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var req struct {
		NewEmail string `json:"newEmail" binding:"required,email"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请填写有效的新邮箱", "data": nil})
		return
	}
	if err := c.authService.SendEmailChangeCodeToNew(userID.(uint), req.NewEmail); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "验证码已发送到该邮箱", "data": nil})
}

// ConfirmEmailChange 校验验证码后换绑为新邮箱
func (c *AuthController) ConfirmEmailChange(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var req struct {
		Code     string `json:"code" binding:"required,len=6"`
		NewEmail string `json:"newEmail" binding:"required,email"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请填写验证码和新邮箱", "data": nil})
		return
	}
	if err := c.authService.ConfirmEmailChange(userID.(uint), req.Code, req.NewEmail); err != nil {
		if err == services.ErrInvalidCode {
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "验证码错误或已过期", "data": nil})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "邮箱已更换", "data": nil})
}

// SendEmailUnbindCode 发送解绑邮箱验证码（发到当前邮箱）
func (c *AuthController) SendEmailUnbindCode(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	if err := c.authService.SendEmailUnbindCode(userID.(uint)); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "验证码已发送到当前邮箱", "data": nil})
}

// ConfirmEmailUnbind 校验验证码后解绑邮箱
func (c *AuthController) ConfirmEmailUnbind(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var req struct {
		Code string `json:"code" binding:"required,len=6"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请填写验证码", "data": nil})
		return
	}
	if err := c.authService.ConfirmEmailUnbind(userID.(uint), req.Code); err != nil {
		if err == services.ErrInvalidCode {
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "验证码错误或已过期", "data": nil})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "邮箱已解绑", "data": nil})
}

// GetTokenTransactions 获取当前用户Token计费清单
// @Summary 获取当前用户Token计费清单
// @Description 获取当前登录用户的Token消耗与金额流水
// @Tags 用户
// @Security BearerAuth
// @Produce json
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(20)
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/users/token-transactions [get]
func (c *AuthController) GetTokenTransactions(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var total int64
	if err := database.DB.Model(&userModels.TokenTransaction{}).
		Where("user_id = ?", userID.(uint)).
		Count(&total).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取计费清单失败",
			"data":    nil,
		})
		return
	}

	var list []userModels.TokenTransaction
	offset := (page - 1) * pageSize
	if err := database.DB.
		Where("user_id = ?", userID.(uint)).
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&list).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取计费清单失败",
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": gin.H{
			"list":     list,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// SendVerificationCode 发送邮箱验证码
// @Summary 发送邮箱验证码
// @Description 向指定邮箱发送登录验证码
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.SendCodeRequest true "邮箱"
// @Success 200 {object} map[string]interface{} "发送成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 429 {object} map[string]interface{} "发送太频繁"
// @Router /api/auth/send-code [post]
func (c *AuthController) SendVerificationCode(ctx *gin.Context) {
	var req services.SendCodeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	err := c.authService.SendVerificationCode(&req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		code := 500
		message := err.Error()

		// 根据错误类型返回不同状态码
		if err == services.ErrSendTooFrequent {
			statusCode = http.StatusTooManyRequests
			code = 429
		}

		ctx.JSON(statusCode, gin.H{
			"code":    code,
			"message": message,
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "验证码已发送，请查收邮件",
		"data":    nil,
	})
}

// EmailLogin 邮箱验证码登录
// @Summary 邮箱验证码登录
// @Description 使用邮箱和验证码登录
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.EmailLoginRequest true "邮箱和验证码"
// @Success 200 {object} map[string]interface{} "登录成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "验证码错误"
// @Router /api/auth/email-login [post]
func (c *AuthController) EmailLogin(ctx *gin.Context) {
	var req services.EmailLoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	response, err := c.authService.EmailLogin(&req)
	if err != nil {
		statusCode := http.StatusUnauthorized
		code := 401
		message := "验证码错误或已过期"

		if err == services.ErrUserNotFound {
			message = "该邮箱未注册"
		} else if err == services.ErrInvalidCode {
			message = "验证码错误或已过期"
		}

		ctx.JSON(statusCode, gin.H{
			"code":    code,
			"message": message,
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "登录成功",
		"data":    response,
	})
}

// SendRegisterCode 发送注册验证码
// @Summary 发送注册验证码
// @Description 向指定邮箱发送注册验证码
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.SendCodeRequest true "邮箱"
// @Success 200 {object} map[string]interface{} "发送成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Router /api/auth/send-register-code [post]
func (c *AuthController) SendRegisterCode(ctx *gin.Context) {
	var req services.SendCodeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	err := c.authService.SendRegisterCode(&req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "验证码已发送，请查收邮件",
		"data":    nil,
	})
}

// EmailRegister 邮箱验证码注册
// @Summary 邮箱验证码注册
// @Description 使用邮箱和验证码注册并自动登录
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.EmailLoginRequest true "邮箱和验证码"
// @Success 200 {object} map[string]interface{} "注册成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Router /api/auth/email-register [post]
func (c *AuthController) EmailRegister(ctx *gin.Context) {
	var req services.EmailLoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	response, err := c.authService.EmailRegister(&req)
	if err != nil {
		statusCode := http.StatusBadRequest
		code := 400
		message := err.Error()

		if err == services.ErrUserExists {
			message = "该邮箱已注册"
		} else if err == services.ErrInvalidCode {
			statusCode = http.StatusUnauthorized
			code = 401
			message = "验证码错误或已过期"
		}

		ctx.JSON(statusCode, gin.H{
			"code":    code,
			"message": message,
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "注册成功",
		"data":    response,
	})
}

// UpdateUsername 修改用户名
// @Summary 修改用户名
// @Description 修改当前登录用户的用户名
// @Tags 用户
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body map[string]string true "新用户名"
// @Success 200 {object} map[string]interface{} "修改成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Router /api/users/username [put]
func (c *AuthController) UpdateUsername(ctx *gin.Context) {
	// 从中间件获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	var req struct {
		Username string `json:"username" binding:"required,min=3,max=50"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	err := c.authService.UpdateUsername(userID.(uint), req.Username)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "用户名修改成功",
		"data":    nil,
	})
}

// GetNotificationPreferences 获取通知偏好
func (c *AuthController) GetNotificationPreferences(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	prefs, err := c.authService.GetNotificationPreferences(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": prefs})
}

// UpdateNotificationPreferences 更新通知偏好
func (c *AuthController) UpdateNotificationPreferences(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var prefs map[string]bool
	if err := ctx.ShouldBindJSON(&prefs); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误", "data": nil})
		return
	}
	if err := c.authService.UpdateNotificationPreferences(userID.(uint), prefs); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "修改成功", "data": nil})
}

// UploadAvatar 上传头像
// @Summary 上传头像
// @Description 上传用户头像文件
// @Tags 用户
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param avatar formData file true "头像文件"
// @Success 200 {object} map[string]interface{} "上传成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/users/avatar [post]
func (c *AuthController) UploadAvatar(ctx *gin.Context) {
	// 从中间件获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	// 获取上传的文件
	file, err := ctx.FormFile("avatar")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请选择要上传的头像文件",
			"data":    nil,
		})
		return
	}

	// 验证文件类型（只允许图片）
	allowedTypes := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
	}
	ext := filepath.Ext(file.Filename)
	if !allowedTypes[ext] {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "不支持的文件类型，仅支持 jpg、jpeg、png、gif、webp",
			"data":    nil,
		})
		return
	}

	// 验证文件大小（限制为 5MB）
	if file.Size > 5*1024*1024 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "文件大小不能超过 5MB",
			"data":    nil,
		})
		return
	}

	// 创建上传目录
	uploadDir := filepath.Join(config.UploadPath, "avatars")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("创建上传目录失败: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建上传目录失败",
			"data":    nil,
		})
		return
	}

	// 生成唯一文件名：用户ID_时间戳_随机数.扩展名
	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("%d_%d%s", userID.(uint), timestamp, ext)
	filePath := filepath.Join(uploadDir, filename)

	// 保存文件
	if err := ctx.SaveUploadedFile(file, filePath); err != nil {
		log.Printf("保存文件失败: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "保存文件失败",
			"data":    nil,
		})
		return
	}

	// 生成相对路径（用于存储到数据库）
	relativePath := filepath.Join("avatars", filename)

	// 更新用户头像路径
	err = c.authService.UpdateAvatar(userID.(uint), relativePath)
	if err != nil {
		// 如果更新失败，删除已上传的文件
		os.Remove(filePath)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "更新头像失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 返回文件路径
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "头像上传成功",
		"data": gin.H{
			"url": relativePath,
		},
	})
}
