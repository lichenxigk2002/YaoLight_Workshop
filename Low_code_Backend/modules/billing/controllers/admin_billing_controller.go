package controllers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	paymentModels "yaolight-workshop/backend/modules/payment/models"
	userModels "yaolight-workshop/backend/modules/user/models"
)

// AdminBillingController 管理端订单与 Token 流水视图
type AdminBillingController struct{}

// NewAdminBillingController 创建控制器
func NewAdminBillingController() *AdminBillingController {
	return &AdminBillingController{}
}

// ListUserOptions returns lightweight user options for billing actions.
// GET /api/admin/billing/users/options
func (c *AdminBillingController) ListUserOptions(ctx *gin.Context) {
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
	if err := db.Select("id", "user_no", "username", "email", "avatar_url", "role", "status", "token_balance").
		Order("created_at DESC").
		Limit(limit).
		Find(&users).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "failed to load billing users", "data": nil})
		return
	}

	items := make([]map[string]interface{}, 0, len(users))
	for _, user := range users {
		items = append(items, map[string]interface{}{
			"id":            user.ID,
			"user_no":       user.UserNo,
			"username":      user.Username,
			"email":         user.Email,
			"avatar_url":    user.AvatarURL,
			"role":          user.Role,
			"status":        user.Status,
			"token_balance": user.TokenBalance,
		})
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data":    items,
	})
}

// ListOrders 管理端查询订单列表（分页）
// GET /api/admin/billing/orders
func (c *AdminBillingController) ListOrders(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	db := database.DB.Model(&paymentModels.Order{})
	if orderID := ctx.Query("order_id"); orderID != "" {
		db = db.Where("order_id = ?", orderID)
	}
	if userID := ctx.Query("user_id"); userID != "" {
		if id, err := strconv.ParseUint(userID, 10, 32); err == nil {
			db = db.Where("user_id = ?", uint(id))
		}
	}
	if status := ctx.Query("status"); status != "" {
		db = db.Where("status = ?", status)
	}
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

	var total int64
	if err := db.Count(&total).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "failed to count orders", "data": nil})
		return
	}

	var list []paymentModels.Order
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "failed to load orders", "data": nil})
		return
	}

	// 组装用户信息（用户名等）
	userIDs := make([]uint, 0, len(list))
	seen := make(map[uint]struct{})
	for _, o := range list {
		if _, ok := seen[o.UserID]; !ok {
			seen[o.UserID] = struct{}{}
			userIDs = append(userIDs, o.UserID)
		}
	}

	userMap := make(map[uint]userModels.User)
	if len(userIDs) > 0 {
		var users []userModels.User
		if err := database.DB.Where("id IN ?", userIDs).Find(&users).Error; err == nil {
			for _, u := range users {
				userMap[u.ID] = u
			}
		}
	}

	items := make([]map[string]interface{}, 0, len(list))
	for _, o := range list {
		u := userMap[o.UserID]
		item := map[string]interface{}{
			"id":              o.ID,
			"order_id":        o.OrderID,
			"user_id":         o.UserID,
			"user_username":   u.Username,
			"user_email":      u.Email,
			"user_no":         u.UserNo,
			"package_id":      o.PackageID,
			"package_name":    o.PackageName,
			"amount":          o.Amount,
			"stardust":        o.Stardust,
			"status":          o.Status,
			"payment_method":  o.PaymentMethod,
			"alipay_trade_no": o.AlipayTradeNo,
			"created_at":      o.CreatedAt,
			"paid_at":         o.PaidAt,
		}
		items = append(items, item)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data": gin.H{
			"list":      items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// ListTokenTransactions 管理端查看全站 Token 流水（分页）
// GET /api/admin/billing/token-transactions
func (c *AdminBillingController) ListTokenTransactions(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	db := database.DB.Model(&userModels.TokenTransaction{})
	if userID := ctx.Query("user_id"); userID != "" {
		if id, err := strconv.ParseUint(userID, 10, 32); err == nil {
			db = db.Where("user_id = ?", uint(id))
		}
	}
	// scope: usage | balance，用于前端区分「模型消耗」和「充值/赠送」
	switch ctx.Query("scope") {
	case "usage":
		db = db.Where("type IN ?", []string{"consumption", "usage_record"})
	case "balance":
		db = db.Where("type IN ?", []string{"recharge", "bonus"})
	default:
		if txType := ctx.Query("type"); txType != "" {
			db = db.Where("type = ?", txType)
		}
	}
	if provider := ctx.Query("provider"); provider != "" {
		db = db.Where("provider = ?", provider)
	}
	if model := ctx.Query("model_name"); model != "" {
		db = db.Where("model_name = ?", model)
	}
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

	var total int64
	if err := db.Count(&total).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "failed to count token transactions", "data": nil})
		return
	}

	var list []userModels.TokenTransaction
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "failed to load token transactions", "data": nil})
		return
	}

	userIDs := make([]uint, 0, len(list))
	seen := make(map[uint]struct{})
	for _, tx := range list {
		if _, ok := seen[tx.UserID]; !ok {
			seen[tx.UserID] = struct{}{}
			userIDs = append(userIDs, tx.UserID)
		}
	}
	userMap := make(map[uint]userModels.User)
	if len(userIDs) > 0 {
		var users []userModels.User
		if err := database.DB.Where("id IN ?", userIDs).Find(&users).Error; err == nil {
			for _, u := range users {
				userMap[u.ID] = u
			}
		}
	}

	items := make([]map[string]interface{}, 0, len(list))
	for _, tx := range list {
		u := userMap[tx.UserID]
		item := map[string]interface{}{
			"id":                 tx.ID,
			"user_id":            tx.UserID,
			"user_username":      u.Username,
			"user_email":         u.Email,
			"user_no":            u.UserNo,
			"amount":             tx.Amount,
			"type":               tx.Type,
			"related_id":         tx.RelatedID,
			"description":        tx.Description,
			"provider":           tx.Provider,
			"model_name":         tx.ModelName,
			"model_mode":         tx.ModelMode,
			"model_id":           tx.ModelID,
			"prompt_tokens":      tx.PromptTokens,
			"completion_tokens":  tx.CompletionTokens,
			"total_tokens":       tx.TotalTokens,
			"cache_read_tokens":  tx.CacheReadTokens,
			"cache_write_tokens": tx.CacheWriteTokens,
			"audio_tokens":       tx.AudioTokens,
			"cost":               tx.Cost,
			"currency":           tx.Currency,
			"created_at":         tx.CreatedAt,
		}
		items = append(items, item)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data": gin.H{
			"list":      items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}
