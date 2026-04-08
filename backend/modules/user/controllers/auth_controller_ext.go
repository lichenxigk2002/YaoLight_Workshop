package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/modules/user/services"
)

// GetTransactionOptions 获取筛选选项
// @Summary 获取筛选选项
// @Description 获取用户已使用的 Provider 和 Model 列表
// @Tags 用户
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/users/token-transactions/options [get]
func (c *AuthController) GetTransactionOptions(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	billingSvc := services.NewBillingService()
	options, err := billingSvc.GetTransactionOptions(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取选项失败",
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    options,
	})
}

// GetTokenStats 获取 Token 统计数据
// @Summary 获取 Token 统计数据
// @Description 获取今日和累计的 Token 统计数据，包含模型维度
// @Tags 用户
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/users/token-transactions/stats [get]
func (c *AuthController) GetTokenStats(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	billingSvc := services.NewBillingService()
	stats, err := billingSvc.GetTokenStats(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取统计失败",
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    stats,
	})
}
