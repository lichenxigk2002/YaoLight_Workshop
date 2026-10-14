package controllers

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/config"
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
	packages, err := c.paymentService.GetPackages(packageLocale(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取套餐列表失败: " + err.Error(),
			"data":    nil,
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    packages,
	})
}

func packageLocale(ctx *gin.Context) string {
	if locale := strings.TrimSpace(ctx.Query("locale")); locale != "" {
		return locale
	}
	return strings.TrimSpace(ctx.GetHeader("Accept-Language"))
}

func (c *PaymentController) AdminListPackages(ctx *gin.Context) {
	result, err := c.paymentService.ListAdminPackages()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取套餐列表失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": result})
}

func (c *PaymentController) AdminCreatePackage(ctx *gin.Context) {
	var req services.SavePackageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	pkg, err := c.paymentService.CreatePackage(req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "创建套餐失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": pkg})
}

func (c *PaymentController) AdminUpdatePackage(ctx *gin.Context) {
	var req services.SavePackageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	pkg, err := c.paymentService.UpdatePackage(ctx.Param("id"), req)
	if err != nil {
		status := http.StatusBadRequest
		if err == services.ErrPackageNotFound {
			status = http.StatusNotFound
		}
		ctx.JSON(status, gin.H{"code": status, "message": "更新套餐失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": pkg})
}

func (c *PaymentController) AdminUpdatePackageStatus(ctx *gin.Context) {
	var req services.UpdatePackageStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	pkg, err := c.paymentService.UpdatePackageStatus(ctx.Param("id"), req.Status)
	if err != nil {
		status := http.StatusBadRequest
		if err == services.ErrPackageNotFound {
			status = http.StatusNotFound
		}
		ctx.JSON(status, gin.H{"code": status, "message": "更新套餐状态失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": pkg})
}

func (c *PaymentController) AdminDeletePackage(ctx *gin.Context) {
	if err := c.paymentService.DeletePackage(ctx.Param("id")); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "删除套餐失败: " + err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": gin.H{"id": ctx.Param("id")}})
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
		"orderId":  order.OrderID,
		"status":   string(order.Status),
		"amount":   order.Amount,
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

// ListUserOrders 获取当前用户的订单列表
// @Summary 获取当前用户的订单列表
// @Description 按创建时间倒序返回当前登录用户的充值订单
// @Tags 支付
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param page query int false "页码，从 1 开始，默认 1"
// @Param pageSize query int false "每页数量，默认 20，最大 100"
// @Success 200 {object} map[string]interface{} "订单列表"
// @Router /api/payment/orders [get]
func (c *PaymentController) ListUserOrders(ctx *gin.Context) {
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

	pageStr := ctx.DefaultQuery("page", "1")
	pageSizeStr := ctx.DefaultQuery("pageSize", "20")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page <= 0 {
		page = 1
	}
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 {
		pageSize = 20
	}

	result, err := c.paymentService.ListUserOrders(userID.(uint), page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取订单列表失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    result,
	})
}

// GetOrderDetail 获取当前用户的订单详情（含支付链接，仅待支付时返回）
// @Router /api/payment/orders/:orderId/detail [get]
func (c *PaymentController) GetOrderDetail(ctx *gin.Context) {
	orderID := ctx.Param("orderId")
	if orderID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "订单号不能为空", "data": nil})
		return
	}
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	detail, err := c.paymentService.GetOrderDetailForUser(orderID, userID.(uint))
	if err != nil {
		if err == services.ErrOrderNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "订单不存在", "data": nil})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": detail})
}

// CancelOrder 取消订单（仅待支付可取消）
// @Router /api/payment/orders/:orderId/cancel [post]
func (c *PaymentController) CancelOrder(ctx *gin.Context) {
	orderID := ctx.Param("orderId")
	if orderID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "订单号不能为空", "data": nil})
		return
	}
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	if err := c.paymentService.CancelOrder(orderID, userID.(uint)); err != nil {
		if err == services.ErrOrderNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "订单不存在", "data": nil})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已取消订单", "data": nil})
}

// DeleteOrder 删除订单（仅待支付或已取消可删，软删除）
// @Router /api/payment/orders/:orderId [delete]
func (c *PaymentController) DeleteOrder(ctx *gin.Context) {
	orderID := ctx.Param("orderId")
	if orderID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "订单号不能为空", "data": nil})
		return
	}
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	if err := c.paymentService.DeleteOrder(orderID, userID.(uint)); err != nil {
		if err == services.ErrOrderNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "订单不存在", "data": nil})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已删除", "data": nil})
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
	// 重定向到前端充值页面
	redirectBase := strings.TrimRight(config.FrontendURL, "/")
	callbackQuery := url.Values{}
	callbackQuery.Set("status", string(order.Status))
	callbackQuery.Set("orderId", order.OrderID)
	ctx.Redirect(http.StatusFound, redirectBase+"/payment/callback?"+callbackQuery.Encode())
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
