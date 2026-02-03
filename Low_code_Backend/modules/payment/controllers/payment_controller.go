package controllers

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/modules/payment/services"
)

// PaymentController 支付控制器
type PaymentController struct {
	paymentService *services.PaymentService
}

// NewPaymentController 创建支付控制器
func NewPaymentController() *PaymentController {
	return &PaymentController{
		paymentService: services.NewPaymentService(),
	}
}

// GetPackages 获取套餐列表
// @Summary 获取充值套餐列表
// @Description 获取所有可用的星尘充值套餐
// @Tags 支付
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "套餐列表"
// @Router /api/payment/packages [get]
func (c *PaymentController) GetPackages(ctx *gin.Context) {
	packages := c.paymentService.GetPackages()
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    packages,
	})
}

// CreateOrderRequest 创建订单请求
type CreateOrderRequest struct {
	PackageID string `json:"packageId" binding:"required"` // 支持驼峰命名
	Method    string `json:"method"`                       // alipay_pc, alipay_qr, mock
}

// CreateOrder 创建支付订单
// @Summary 创建支付订单
// @Description 创建充值订单并返回支付链接
// @Tags 支付
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateOrderRequest true "订单信息"
// @Success 200 {object} map[string]interface{} "订单信息"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/payment/orders [post]
func (c *PaymentController) CreateOrder(ctx *gin.Context) {
	// 获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	var req services.CreateOrderRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 创建订单
	response, err := c.paymentService.CreateOrder(userID.(uint), &req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建订单失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 调试日志：输出返回的数据
	log.Printf("📤 返回创建订单响应: orderId=%s, payUrl=%v, qrCode=%v", 
		response.OrderID, 
		response.PayURL != nil, 
		response.QRCode != nil)
	if response.QRCode != nil {
		log.Printf("📤 二维码内容: %s", *response.QRCode)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    response,
	})
}

// GetOrderStatus 获取订单状态
// @Summary 获取订单状态
// @Description 根据订单号查询订单状态
// @Tags 支付
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orderId path string true "订单号"
// @Success 200 {object} map[string]interface{} "订单状态"
// @Failure 404 {object} map[string]interface{} "订单不存在"
// @Router /api/payment/orders/:orderId/status [get]
func (c *PaymentController) GetOrderStatus(ctx *gin.Context) {
	orderID := ctx.Param("orderId")
	if orderID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "订单号不能为空",
			"data":    nil,
		})
		return
	}

	order, err := c.paymentService.GetOrderStatus(orderID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "订单不存在",
			"data":    nil,
		})
		return
	}

	// 构建响应
	statusResponse := gin.H{
		"orderId": order.OrderID,
		"status":  string(order.Status),
		"amount":  order.Amount,
		"currency": "CNY",
		"stardust": order.Stardust,
	}
	if order.PaidAt != nil {
		statusResponse["paidAt"] = order.PaidAt.Format("2006-01-02T15:04:05Z07:00")
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    statusResponse,
	})
}

// HandleAlipayNotify 处理支付宝异步通知
// @Summary 支付宝异步通知
// @Description 接收支付宝支付成功后的异步通知
// @Tags 支付
// @Accept application/x-www-form-urlencoded
// @Produce text/plain
// @Param params formData map[string]string true "支付宝通知参数"
// @Success 200 {string} string "success"
// @Failure 400 {string} string "验证失败"
// @Router /api/payment/alipay/notify [post]
func (c *PaymentController) HandleAlipayNotify(ctx *gin.Context) {
	// 获取所有参数
	params := make(map[string]string)
	ctx.Request.ParseForm()
	for k, v := range ctx.Request.PostForm {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}

	// 处理通知
	if err := c.paymentService.HandleAlipayNotify(params); err != nil {
		ctx.String(http.StatusBadRequest, "fail")
		return
	}

	// 返回success表示处理成功
	ctx.String(http.StatusOK, "success")
}

// HandleAlipayReturn 处理支付宝同步跳转
// @Summary 支付宝同步跳转
// @Description 用户支付完成后跳转回网站
// @Tags 支付
// @Accept json
// @Produce json
// @Param params query map[string]string true "支付宝返回参数"
// @Success 200 {object} map[string]interface{} "跳转信息"
// @Router /payment/callback [get]
func (c *PaymentController) HandleAlipayReturn(ctx *gin.Context) {
	// 获取所有参数
	params := make(map[string]string)
	for k, v := range ctx.Request.URL.Query() {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}

	// 验证签名（可选，因为同步跳转可能被用户修改）
	orderID := params["out_trade_no"]
	if orderID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "订单号为空",
			"data":    nil,
		})
		return
	}

	// 查询订单状态
	order, err := c.paymentService.GetOrderStatus(orderID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "订单不存在",
			"data":    nil,
		})
		return
	}

	// 返回订单状态（前端可以根据状态跳转）
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data": gin.H{
			"orderId": order.OrderID,
			"status":  string(order.Status),
			"amount":  order.Amount,
			"stardust": order.Stardust,
		},
	})
}

// MockPay 模拟支付（仅开发环境）
// @Summary 模拟支付
// @Description 模拟支付成功，用于开发测试
// @Tags 支付
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orderId path string true "订单号"
// @Success 200 {object} map[string]interface{} "支付成功"
// @Router /api/payment/orders/:orderId/mock-pay [post]
func (c *PaymentController) MockPay(ctx *gin.Context) {
	orderID := ctx.Param("orderId")
	if orderID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "订单号不能为空",
			"data":    nil,
		})
		return
	}

	// 获取订单
	order, err := c.paymentService.GetOrderStatus(orderID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "订单不存在",
			"data":    nil,
		})
		return
	}

	// 检查订单状态
	if order.IsPaid() {
		ctx.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "订单已支付",
			"data":    nil,
		})
		return
	}

	// 模拟支付成功通知
	mockParams := map[string]string{
		"out_trade_no": order.OrderID,
		"trade_no":     "MOCK_" + strconv.FormatInt(time.Now().Unix(), 10),
		"total_amount": strconv.FormatFloat(order.Amount, 'f', 2, 64),
		"trade_status": "TRADE_SUCCESS",
	}

	if err := c.paymentService.HandleAlipayNotify(mockParams); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "模拟支付失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "模拟支付成功",
		"data":    nil,
	})
}

