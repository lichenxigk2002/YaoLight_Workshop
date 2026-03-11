package controllers

import (
	"context"
	"errors"
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
	"yaolight-workshop/backend/infrastructure/storage"
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
	avatarHistoryRepo := repositories.NewAvatarHistoryRepository(database.DB)
	return NewAuthControllerWithService(services.NewAuthService(userRepo, oauthBindingRepo, avatarHistoryRepo))
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

// GetTokenTransactions 获取当前用户流水（分页，可选时间范围）
// @Summary 获取当前用户流水
// @Description 获取当前登录用户的 Token 流水明细，支持 start_date/end_date 筛选
// @Tags 用户
// @Security BearerAuth
// @Produce json
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(20)
// @Param start_date query string false "开始日期 YYYY-MM-DD"
// @Param end_date query string false "结束日期 YYYY-MM-DD"
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

	db := database.DB.Model(&userModels.TokenTransaction{}).Where("user_id = ?", userID.(uint))
	if startDate := ctx.Query("start_date"); startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			db = db.Where("created_at >= ?", t)
		}
	}
	if endDate := ctx.Query("end_date"); endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			endOfDay := t.Add(24*time.Hour - time.Nanosecond)
			db = db.Where("created_at <= ?", endOfDay)
		}
	}
	if provider := ctx.Query("provider"); provider != "" {
		db = db.Where("provider = ?", provider)
	}
	if model := ctx.Query("model"); model != "" {
		db = db.Where("model_name = ?", model)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取流水失败",
			"data":    nil,
		})
		return
	}

	var list []userModels.TokenTransaction
	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取流水失败",
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

// GetBillSummary 获取当前用户指定周期账单汇总
// @Summary 获取账单汇总
// @Description 按日/月/季/年汇总流水，返回收入、支出、笔数
// @Tags 用户
// @Security BearerAuth
// @Produce json
// @Param period query string true "周期 day|month|quarter|year"
// @Param year query int true "年"
// @Param month query int false "月(1-12)，day/month 必填；quarter 时为 1-4 表示第几季"
// @Param day query int false "日(1-31)，period=day 时必填"
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/users/bills/summary [get]
func (c *AuthController) GetBillSummary(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	period := ctx.DefaultQuery("period", "month")
	year, _ := strconv.Atoi(ctx.Query("year"))
	month, _ := strconv.Atoi(ctx.Query("month"))
	day, _ := strconv.Atoi(ctx.Query("day"))

	if year <= 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "参数 year 必填且有效",
			"data":    nil,
		})
		return
	}
	req := &services.BillSummaryRequest{Period: period, Year: year, Month: month, Day: day}

	billingSvc := services.NewBillingService()
	sum, err := billingSvc.GetBillSummary(userID.(uint), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidBillPeriod) || errors.Is(err, services.ErrInvalidBillParams) {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": err.Error(),
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取账单失败",
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    sum,
	})
}

// GetBillsExport 导出指定周期账单为 PDF
// @Summary 导出账单 PDF
// @Description 按日/月/季/年导出账单，包含汇总与流水明细
// @Tags 用户
// @Security BearerAuth
// @Produce application/pdf
// @Param period query string true "周期 day|month|quarter|year"
// @Param year query int true "年"
// @Param month query int false "月(1-12)；quarter 时为 1-4"
// @Param day query int false "日(1-31)，period=day 时必填"
// @Success 200 {file} binary "PDF 文件"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/users/bills/export [get]
func (c *AuthController) GetBillsExport(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code": 401, "message": "未授权", "data": nil,
		})
		return
	}
	uid := userID.(uint)

	period := ctx.DefaultQuery("period", "month")
	year, _ := strconv.Atoi(ctx.Query("year"))
	month, _ := strconv.Atoi(ctx.Query("month"))
	day, _ := strconv.Atoi(ctx.Query("day"))
	if year <= 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code": 400, "message": "参数 year 必填且有效", "data": nil,
		})
		return
	}
	req := &services.BillSummaryRequest{Period: period, Year: year, Month: month, Day: day}

	billingSvc := services.NewBillingService()
	sum, err := billingSvc.GetBillSummary(uid, req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidBillPeriod) || errors.Is(err, services.ErrInvalidBillParams) {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"code": 400, "message": err.Error(), "data": nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code": 500, "message": "获取账单失败", "data": nil,
		})
		return
	}

	transactions, err := billingSvc.GetTransactionsInRange(uid, sum.StartAt, sum.EndAt, 500)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code": 500, "message": "获取流水失败", "data": nil,
		})
		return
	}

	var u userModels.User
	if err := database.DB.Select("user_no", "username").First(&u, uid).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code": 500, "message": "获取用户信息失败", "data": nil,
		})
		return
	}
	pdfUser := &services.BillPDFUser{UserNo: u.UserNo, Username: u.Username}

	pdfBytes, err := services.GenerateBillPDF(sum, transactions, pdfUser, time.Now())
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code": 500, "message": "生成 PDF 失败", "data": nil,
		})
		return
	}

	filename := "stardust-bill-" + sum.StartAt.Format("2006-01-02") + ".pdf"
	if period == "month" {
		filename = "stardust-bill-" + sum.StartAt.Format("2006-01") + ".pdf"
	} else if period == "quarter" {
		y, m := sum.StartAt.Year(), int(sum.StartAt.Month())
		q := (m-1)/3 + 1
		filename = fmt.Sprintf("stardust-bill-%d-Q%d.pdf", y, q)
	} else if period == "year" {
		filename = "stardust-bill-" + sum.StartAt.Format("2006") + ".pdf"
	}
	ctx.Header("Content-Disposition", "attachment; filename="+filename)
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
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

// SendForgotPasswordCode 发送忘记密码验证码（仅已注册邮箱）
// @Summary 发送忘记密码验证码
// @Description 向已注册邮箱发送验证码，用于重置密码
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.SendCodeRequest true "邮箱"
// @Router /api/auth/send-forgot-password-code [post]
func (c *AuthController) SendForgotPasswordCode(ctx *gin.Context) {
	var req services.SendCodeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	if err := c.authService.SendForgotPasswordCode(&req); err != nil {
		msg := err.Error()
		code := 400
		if strings.Contains(msg, "太频繁") {
			code = 429
		}
		ctx.JSON(http.StatusOK, gin.H{"code": code, "message": msg, "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "验证码已发送，请查收邮件", "data": nil})
}

// ResetPasswordByEmail 通过邮箱验证码重置密码（忘记密码）
// @Summary 重置密码
// @Description 使用邮箱和验证码设置新密码
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body services.ResetPasswordByEmailRequest true "邮箱、验证码、新密码"
// @Router /api/auth/reset-password [post]
func (c *AuthController) ResetPasswordByEmail(ctx *gin.Context) {
	var req services.ResetPasswordByEmailRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	if err := c.authService.ResetPasswordByEmail(&req); err != nil {
		msg := err.Error()
		code := 400
		if err == services.ErrInvalidCode {
			msg = "验证码错误或已过期"
			code = 401
		} else if err == services.ErrUserNotFound {
			msg = "该邮箱未注册"
		} else if err == services.ErrPasswordTooShort {
			msg = "新密码至少 6 位"
		}
		ctx.JSON(http.StatusOK, gin.H{"code": code, "message": msg, "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "密码已重置，请使用新密码登录", "data": nil})
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

// ChangePassword 修改密码或设置密码（邮箱注册未设置密码时仅需新密码）
// @Summary 修改/设置密码
// @Description 已设置过密码的用户需传旧密码；邮箱验证码注册未设置密码的用户仅传新密码即可
// @Tags 用户
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object true "oldPassword(可选), newPassword(必填)"
// @Router /api/users/change-password [post]
func (c *AuthController) ChangePassword(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var req services.ChangePasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	if err := c.authService.ChangePassword(userID.(uint), &req); err != nil {
		if err == services.ErrUserNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在", "data": nil})
			return
		}
		if err == services.ErrInvalidPassword {
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "当前密码错误", "data": nil})
			return
		}
		if err == services.ErrPasswordTooShort {
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "新密码至少 6 位", "data": nil})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "密码已更新", "data": nil})
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
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	uid := userID.(uint)

	file, err := ctx.FormFile("avatar")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请选择要上传的头像文件", "data": nil})
		return
	}
	allowedTypes := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	ext := filepath.Ext(file.Filename)
	if !allowedTypes[ext] {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "不支持的文件类型，仅支持 jpg、jpeg、png、gif、webp", "data": nil})
		return
	}
	if file.Size > 5*1024*1024 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "文件大小不能超过 5MB", "data": nil})
		return
	}

	user, err := c.authService.GetUserByID(uid)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取用户失败", "data": nil})
		return
	}

	var avatarURL string
	if config.COSEnabled {
		f, _ := file.Open()
		defer f.Close()
		contentType := file.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "image/jpeg"
		}
		filename := fmt.Sprintf("%d_%d%s", uid, time.Now().Unix(), ext)
		avatarURL, err = storage.UploadAvatar(context.Background(), f, file.Size, user.UserNo, filename, contentType)
		if err != nil {
			log.Printf("COS upload failed: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "上传到存储失败", "data": nil})
			return
		}
	} else {
		uploadDir := filepath.Join(config.UploadPath, "avatars")
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			log.Printf("创建上传目录失败: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建上传目录失败", "data": nil})
			return
		}
		filename := fmt.Sprintf("%d_%d%s", uid, time.Now().Unix(), ext)
		filePath := filepath.Join(uploadDir, filename)
		if err := ctx.SaveUploadedFile(file, filePath); err != nil {
			log.Printf("保存文件失败: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "保存文件失败", "data": nil})
			return
		}
		avatarURL = filepath.Join("avatars", filename)
	}

	if err := c.authService.AddAvatarHistory(uid, avatarURL); err != nil {
		log.Printf("AddAvatarHistory failed: %v", err)
	}
	if err := c.authService.UpdateAvatar(uid, avatarURL); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新头像失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "头像上传成功", "data": gin.H{"url": avatarURL}})
}

// GetAvatarHistory 获取当前用户头像历史列表（像 QQ 一样可查看/重新应用/删除）
func (c *AuthController) GetAvatarHistory(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	list, err := c.authService.ListAvatarHistory(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": list})
}

// UseAvatar 将历史中的某张设为当前头像
func (c *AuthController) UseAvatar(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var body struct {
		HistoryID uint `json:"history_id"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil || body.HistoryID == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请提供 history_id", "data": nil})
		return
	}
	if err := c.authService.SetCurrentAvatar(userID.(uint), body.HistoryID); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已切换为该头像", "data": nil})
}

// DeleteAvatarHistory 删除一条头像历史
func (c *AuthController) DeleteAvatarHistory(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 id", "data": nil})
		return
	}
	if err := c.authService.DeleteAvatarHistory(userID.(uint), uint(id)); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已删除", "data": nil})
}
