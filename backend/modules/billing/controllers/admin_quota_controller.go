package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	billingModels "yaolight-workshop/backend/modules/billing/models"
	billingServices "yaolight-workshop/backend/modules/billing/services"
)

// AdminQuotaController 管理端配额（补救/赠送/流水）
type AdminQuotaController struct {
	service *billingServices.QuotaService
}

// NewAdminQuotaController 创建控制器
func NewAdminQuotaController() *AdminQuotaController {
	return &AdminQuotaController{
		service: billingServices.NewQuotaService(database.DB),
	}
}

// RecoverQuota 补救配额（支付失败补发）
// POST /api/admin/billing/quotas/recover
func (c *AdminQuotaController) RecoverQuota(ctx *gin.Context) {
	var body struct {
		OrderID    string `json:"order_id" binding:"required"`
		UserID     string `json:"user_id" binding:"required"` // 支持前端传字符串
		QuotaDelta int64  `json:"quota_delta" binding:"required,min=1"`
		Reason     string `json:"reason" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error(), "data": nil})
		return
	}
	userID, err := strconv.ParseUint(body.UserID, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "user_id 必须为有效数字", "data": nil})
		return
	}
	operatorID, _ := ctx.Get("userID")
	opID, _ := operatorID.(uint)
	if opID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未获取到操作人", "data": nil})
		return
	}

	req := &billingServices.RecoverQuotaRequest{
		OrderID:    body.OrderID,
		UserID:     uint(userID),
		QuotaDelta: body.QuotaDelta,
		Reason:     body.Reason,
	}
	entry, err := c.service.RecoverQuota(req, opID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": toLedgerResp(entry)})
}

// GrantQuota 管理员赠送配额
// POST /api/admin/billing/quotas/grant
func (c *AdminQuotaController) GrantQuota(ctx *gin.Context) {
	var body struct {
		UserID     string `json:"user_id" binding:"required"`
		QuotaDelta int64  `json:"quota_delta" binding:"required,min=1"`
		Remark     string `json:"remark" binding:"required"`
		CampaignID string `json:"campaign_id"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error(), "data": nil})
		return
	}
	userID, err := strconv.ParseUint(body.UserID, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "user_id 必须为有效数字", "data": nil})
		return
	}
	operatorID, _ := ctx.Get("userID")
	opID, _ := operatorID.(uint)
	if opID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未获取到操作人", "data": nil})
		return
	}

	req := &billingServices.GrantQuotaRequest{
		UserID:     uint(userID),
		QuotaDelta: body.QuotaDelta,
		Remark:     body.Remark,
		CampaignID: body.CampaignID,
	}
	entry, err := c.service.GrantQuota(req, opID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": toLedgerResp(entry)})
}

// GetQuotaLedger 配额流水分页
// GET /api/admin/billing/quotas/ledger?page=1&page_size=10&user_id=&source_type=
func (c *AdminQuotaController) GetQuotaLedger(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	sourceType := ctx.Query("source_type")
	startDate := ctx.Query("start_date")
	endDate := ctx.Query("end_date")

	var userID *uint
	if u := ctx.Query("user_id"); u != "" {
		parsed, err := strconv.ParseUint(u, 10, 32)
		if err == nil {
			id := uint(parsed)
			userID = &id
		}
	}

	p := billingServices.ListLedgerParams{
		Page:       page,
		PageSize:   pageSize,
		UserID:     userID,
		SourceType: sourceType,
		StartDate:  startDate,
		EndDate:    endDate,
	}
	list, total, err := c.service.ListLedger(p)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	items := make([]map[string]interface{}, 0, len(list))
	for i := range list {
		items = append(items, toLedgerResp(&list[i]))
	}
	ctx.JSON(http.StatusOK, gin.H{
		"code": 200, "message": "ok",
		"data": gin.H{
			"list":      items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// GetQuotaSummary 配额流水统计汇总
// GET /api/admin/billing/quotas/summary
func (c *AdminQuotaController) GetQuotaSummary(ctx *gin.Context) {
	summary, err := c.service.GetSummary()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data": gin.H{
			"recovery_count": summary.RecoveryCount,
			"gift_count":     summary.GiftCount,
			"total_count":    summary.TotalCount,
			"user_count":     summary.UserCount,
		},
	})
}

func toLedgerResp(e *billingModels.QuotaLedger) map[string]interface{} {
	return map[string]interface{}{
		"id":            e.ID,
		"user_id":       e.UserID,
		"user_display":  nil, // 可选：后续从 user 表 join 或查
		"delta":         e.Delta,
		"balance_after": e.BalanceAfter,
		"source_type":   e.SourceType,
		"source_id":     e.SourceID,
		"operator_id":   e.OperatorID,
		"operator_display": nil,
		"remark":        e.Remark,
		"created_at":    e.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
