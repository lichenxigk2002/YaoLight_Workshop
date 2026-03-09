package services

import (
	"bytes"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	paymentModels "yaolight-workshop/backend/modules/payment/models"
	"yaolight-workshop/backend/modules/payment/repositories"
	userModels "yaolight-workshop/backend/modules/user/models"
	userRepos "yaolight-workshop/backend/modules/user/repositories"
)

var (
	ErrPackageNotFound = errors.New("套餐不存在")
	ErrOrderNotFound   = errors.New("订单不存在")
	ErrOrderPaid       = errors.New("订单已支付")
	ErrInvalidAmount   = errors.New("金额不匹配")
)

// PaymentService 支付服务
type PaymentService struct {
	orderRepo repositories.OrderRepository
	userRepo  repository.UserRepository
}

// NewPaymentService 创建支付服务实例
func NewPaymentService() *PaymentService {
	return &PaymentService{
		orderRepo: repositories.NewOrderRepository(),
		userRepo:  userRepos.NewUserRepository(database.DB),
	}
}

// GetPackages 获取套餐列表
func (s *PaymentService) GetPackages() []paymentModels.StardustPackage {
	return paymentModels.GetDefaultPackages()
}

// CreateOrderRequest 创建订单请求
type CreateOrderRequest struct {
	PackageID string `json:"packageId" binding:"required"` // 支持驼峰命名
	Method    string `json:"method"`                       // alipay_pc, alipay_qr, mock
}

// CreateOrderResponse 创建订单响应
type CreateOrderResponse struct {
	OrderID string  `json:"orderId"`          // 订单号
	PayURL  *string `json:"payUrl,omitempty"` // PC支付跳转链接
	QRCode  *string `json:"qrCode,omitempty"` // 扫码支付二维码
}

// CreateOrder 创建支付订单
func (s *PaymentService) CreateOrder(userID uint, req *CreateOrderRequest) (*CreateOrderResponse, error) {
	// 1. 查找套餐
	packages := paymentModels.GetDefaultPackages()
	var pkg *paymentModels.StardustPackage
	for i := range packages {
		if packages[i].ID == req.PackageID {
			pkg = &packages[i]
			break
		}
	}
	if pkg == nil {
		return nil, ErrPackageNotFound
	}

	// 2. 生成订单号
	orderID := fmt.Sprintf("ORD_%d_%s", time.Now().Unix(), generateRandomString(8))

	// 3. 确定支付方式
	paymentMethod := paymentModels.PaymentMethodAlipayPC
	if req.Method == "alipay_qr" {
		paymentMethod = paymentModels.PaymentMethodAlipayQR
	} else if req.Method == "mock" {
		paymentMethod = paymentModels.PaymentMethodMock
	}

	// 4. 设置订单过期时间（30分钟）
	expiresAt := time.Now().Add(30 * time.Minute)

	// 5. 创建订单
	order := &paymentModels.Order{
		OrderID:       orderID,
		UserID:        userID,
		PackageID:     pkg.ID,
		PackageName:   pkg.Name,
		Amount:        pkg.Price,
		Stardust:      pkg.Stardust,
		Status:        paymentModels.OrderStatusPending,
		PaymentMethod: paymentMethod,
		ExpiresAt:     &expiresAt,
	}

	if err := s.orderRepo.Create(order); err != nil {
		return nil, fmt.Errorf("创建订单失败: %w", err)
	}

	// 6. 根据支付方式生成支付链接或二维码
	response := &CreateOrderResponse{
		OrderID: orderID,
	}

	if paymentMethod == paymentModels.PaymentMethodMock {
		// 模拟支付，直接返回
		return response, nil
	}

	// 7. 调用支付宝接口生成支付链接
	payURL, qrCode, err := s.generateAlipayPayment(order)
	if err != nil {
		return nil, fmt.Errorf("生成支付链接失败: %w", err)
	}

	if payURL != nil {
		order.PayURL = *payURL
		response.PayURL = payURL
	}
	if qrCode != nil {
		order.QRCode = *qrCode
		response.QRCode = qrCode
	}

	// 更新订单
	if err := s.orderRepo.Update(order); err != nil {
		log.Printf("更新订单支付链接失败: %v", err)
	}

	return response, nil
}

// generateAlipayPayment 生成支付宝支付链接
func (s *PaymentService) generateAlipayPayment(order *paymentModels.Order) (*string, *string, error) {
	log.Println("=== 开始生成支付宝支付链接 ===")
	log.Printf("订单号: %s", order.OrderID)
	log.Printf("支付方式: %s", order.PaymentMethod)

	// 检查配置
	if config.AlipayAppID == "" {
		log.Println("❌ 错误: 支付宝APPID未配置")
		return nil, nil, errors.New("支付宝APPID未配置，请检查 ALIPAY_APP_ID 环境变量")
	}
	if config.AlipayPrivateKey == "" {
		log.Println("❌ 错误: 支付宝私钥未配置")
		return nil, nil, errors.New("支付宝私钥未配置，请检查 ALIPAY_PRIVATE_KEY 环境变量")
	}

	log.Printf("✅ 配置检查通过")
	log.Printf("APP_ID: %s", config.AlipayAppID)
	log.Printf("私钥长度: %d 字符", len(config.AlipayPrivateKey))

	// 检查必要的配置
	if config.AlipayNotifyURL == "" {
		log.Printf("⚠️  警告: ALIPAY_NOTIFY_URL 未配置，支付回调可能失败")
	}
	if order.PaymentMethod != paymentModels.PaymentMethodAlipayQR && config.AlipayReturnURL == "" {
		log.Printf("⚠️  警告: ALIPAY_RETURN_URL 未配置，PC支付跳转可能失败")
	}

	// 构建请求参数
	params := make(map[string]string)
	params["app_id"] = config.AlipayAppID
	params["method"] = "alipay.trade.page.pay" // PC网站支付
	if order.PaymentMethod == paymentModels.PaymentMethodAlipayQR {
		params["method"] = "alipay.trade.precreate" // 扫码支付
	}
	params["charset"] = config.AlipayCharset
	params["sign_type"] = config.AlipaySignType
	params["timestamp"] = time.Now().Format("2006-01-02 15:04:05")
	params["version"] = "1.0"
	params["notify_url"] = config.AlipayNotifyURL
	// 扫码支付不需要return_url，PC支付需要
	if order.PaymentMethod != paymentModels.PaymentMethodAlipayQR {
		params["return_url"] = config.AlipayReturnURL
	}

	// 业务参数
	var bizContent string
	if order.PaymentMethod == paymentModels.PaymentMethodAlipayQR {
		// 扫码支付不需要product_code，但需要设置超时时间（30分钟）
		bizContent = fmt.Sprintf(`{
			"out_trade_no":"%s",
			"total_amount":"%.2f",
			"subject":"%s",
			"timeout_express":"30m"
		}`, order.OrderID, order.Amount, order.PackageName)
	} else {
		// PC网站支付需要product_code
		bizContent = fmt.Sprintf(`{
			"out_trade_no":"%s",
			"product_code":"FAST_INSTANT_TRADE_PAY",
			"total_amount":"%.2f",
			"subject":"%s"
		}`, order.OrderID, order.Amount, order.PackageName)
	}

	params["biz_content"] = bizContent

	// 签名
	log.Println("--- 开始签名参数 ---")
	log.Printf("待签名参数数量: %d", len(params))
	sign, err := s.signParams(params)
	if err != nil {
		log.Printf("❌ 签名失败: %v", err)
		return nil, nil, fmt.Errorf("签名失败: %w", err)
	}
	log.Printf("✅ 签名成功，签名长度: %d 字符", len(sign))
	params["sign"] = sign

	// 构建支付URL
	gateway := config.AlipayGateway
	if gateway == "" {
		gateway = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	}

	payURL := fmt.Sprintf("%s?%s", gateway, s.buildQueryString(params))
	log.Printf("📤 生成的PC支付URL长度: %d 字符", len(payURL))
	if len(payURL) > 500 {
		log.Printf("📤 PC支付URL前500字符: %s...", payURL[:500])
	} else {
		log.Printf("📤 PC支付URL: %s", payURL)
	}

	// 如果是扫码支付，需要调用预创建接口获取二维码
	if order.PaymentMethod == paymentModels.PaymentMethodAlipayQR {
		log.Println("--- 调用支付宝预创建接口获取二维码 ---")
		qrCode, err := s.callAlipayPrecreateAPI(params, gateway)
		if err != nil {
			log.Printf("❌ 调用支付宝预创建接口失败: %v", err)
			return nil, nil, fmt.Errorf("获取二维码失败: %w", err)
		}
		log.Printf("✅ 成功获取二维码，二维码长度: %d 字符", len(qrCode))
		return nil, &qrCode, nil
	}

	return &payURL, nil, nil
}

// callAlipayPrecreateAPI 调用支付宝预创建接口获取二维码
func (s *PaymentService) callAlipayPrecreateAPI(params map[string]string, gateway string) (string, error) {
	// 构建请求体（form-data格式）
	queryString := s.buildQueryString(params)
	log.Printf("请求参数: %s", queryString)

	// 创建HTTP请求
	req, err := http.NewRequest("POST", gateway, bytes.NewBufferString(queryString))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")

	// 发送请求
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	log.Printf("发送请求到: %s", gateway)

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	log.Printf("响应状态码: %d", resp.StatusCode)
	log.Printf("响应内容长度: %d 字节", len(body))
	if len(body) > 500 {
		log.Printf("响应内容前500字符: %s...", string(body[:500]))
	} else {
		log.Printf("响应内容: %s", string(body))
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("支付宝API返回错误状态码: %d, 响应: %s", resp.StatusCode, string(body))
	}

	// 解析响应（支付宝返回的是JSON格式）
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析响应JSON失败: %w, 响应内容: %s", err, string(body))
	}

	// 提取响应数据
	precreateResponse, ok := result["alipay_trade_precreate_response"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("响应格式错误，未找到 alipay_trade_precreate_response，完整响应: %+v", result)
	}

	// 检查是否有错误
	if code, ok := precreateResponse["code"].(string); ok && code != "10000" {
		msg := precreateResponse["msg"].(string)
		subMsg := ""
		if subMsgVal, ok := precreateResponse["sub_msg"]; ok {
			subMsg = subMsgVal.(string)
		}
		return "", fmt.Errorf("支付宝API返回错误: code=%s, msg=%s, sub_msg=%s", code, msg, subMsg)
	}

	// 获取二维码
	qrCode, ok := precreateResponse["qr_code"].(string)
	if !ok || qrCode == "" {
		log.Printf("❌ 响应中未找到二维码，完整响应: %+v", precreateResponse)
		return "", fmt.Errorf("响应中未找到二维码，响应: %+v", precreateResponse)
	}

	// 验证二维码URL格式
	if !strings.HasPrefix(qrCode, "http://") && !strings.HasPrefix(qrCode, "https://") {
		log.Printf("⚠️  警告：二维码格式可能不正确: %s", qrCode)
	}

	log.Printf("✅ 成功提取二维码: %s", qrCode)
	log.Printf("📝 提示：支付宝二维码通常有2-5分钟有效期，请尽快扫码支付")
	return qrCode, nil
}

// signParams 对参数进行RSA2签名
func (s *PaymentService) signParams(params map[string]string) (string, error) {
	log.Println("  [签名步骤1] 参数排序")
	// 1. 参数排序
	keys := make([]string, 0, len(params))
	for k := range params {
		if k != "sign" && params[k] != "" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	log.Printf("  [签名步骤1] 排序后的参数键: %v", keys)

	log.Println("  [签名步骤2] 构建待签名字符串")
	// 2. 构建待签名字符串
	var signStr strings.Builder
	for i, k := range keys {
		if i > 0 {
			signStr.WriteString("&")
		}
		signStr.WriteString(k)
		signStr.WriteString("=")
		// 注意：支付宝要求对参数值进行URL编码，但签名时使用原始值
		// 这里直接使用原始值进行签名
		signStr.WriteString(params[k])
	}
	signString := signStr.String()
	log.Printf("  [签名步骤2] 待签名字符串长度: %d", len(signString))
	if len(signString) > 200 {
		log.Printf("  [签名步骤2] 待签名字符串前200字符: %s...", signString[:200])
	} else {
		log.Printf("  [签名步骤2] 待签名字符串: %s", signString)
	}

	log.Println("  [签名步骤3] 解析私钥")
	// 3. 读取私钥
	privateKey, err := s.parsePrivateKey(config.AlipayPrivateKey)
	if err != nil {
		log.Printf("  [签名步骤3] ❌ 解析私钥失败: %v", err)
		return "", fmt.Errorf("解析私钥失败: %w", err)
	}
	log.Printf("  [签名步骤3] ✅ 私钥解析成功，密钥大小: %d 位", privateKey.N.BitLen())

	log.Println("  [签名步骤4] 计算SHA256哈希并签名")
	// 4. 签名
	hash := sha256.Sum256([]byte(signString))
	log.Printf("  [签名步骤4] SHA256哈希值长度: %d 字节", len(hash))
	signature, err := rsa.SignPKCS1v15(nil, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		log.Printf("  [签名步骤4] ❌ 签名计算失败: %v", err)
		return "", fmt.Errorf("签名计算失败: %w", err)
	}
	log.Printf("  [签名步骤4] ✅ 签名计算成功，签名长度: %d 字节", len(signature))

	log.Println("  [签名步骤5] Base64编码")
	// 5. Base64编码
	encodedSign := base64.StdEncoding.EncodeToString(signature)
	log.Printf("  [签名步骤5] ✅ Base64编码完成，编码后长度: %d 字符", len(encodedSign))
	return encodedSign, nil
}

// filterBase64Chars 过滤掉所有非Base64字符，只保留有效的Base64字符
func filterBase64Chars(s string) string {
	var result strings.Builder
	for _, r := range s {
		// Base64有效字符: A-Z, a-z, 0-9, +, /, =
		if (r >= 'A' && r <= 'Z') ||
			(r >= 'a' && r <= 'z') ||
			(r >= '0' && r <= '9') ||
			r == '+' || r == '/' || r == '=' {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// parsePrivateKey 解析私钥
func (s *PaymentService) parsePrivateKey(keyStr string) (*rsa.PrivateKey, error) {
	log.Println("🔍 [DEBUG] 开始解析私钥...")
	log.Printf("🔍 [DEBUG] 私钥原始长度: %d 字符", len(keyStr))

	if keyStr == "" {
		log.Println("❌ [DEBUG] 私钥为空")
		return nil, errors.New("私钥为空")
	}

	// 显示私钥的前100个字符和后50个字符（用于调试）
	if len(keyStr) > 150 {
		log.Printf("🔍 [DEBUG] 私钥前100字符: %s...", keyStr[:100])
		log.Printf("🔍 [DEBUG] 私钥后50字符: ...%s", keyStr[len(keyStr)-50:])
	} else {
		log.Printf("🔍 [DEBUG] 私钥内容: %s", keyStr)
	}

	// 处理换行符：支持 \n 和实际换行符
	originalKeyStr := keyStr
	keyStr = strings.ReplaceAll(keyStr, "\\n", "\n")
	if keyStr != originalKeyStr {
		log.Println("🔍 [DEBUG] 已替换 \\n 为实际换行符")
	}

	// 检查是否包含 PEM 标记
	hasBegin := strings.Contains(keyStr, "BEGIN")
	hasEnd := strings.Contains(keyStr, "END")
	log.Printf("🔍 [DEBUG] 包含 BEGIN 标记: %v, 包含 END 标记: %v", hasBegin, hasEnd)

	// 如果私钥没有包含 PEM 头尾标记，尝试添加
	if !hasBegin {
		log.Println("⚠️  [DEBUG] 私钥没有 BEGIN 标记，尝试添加...")
		keyStr = "-----BEGIN PRIVATE KEY-----\n" + keyStr + "\n-----END PRIVATE KEY-----"
		log.Println("🔍 [DEBUG] 已添加 PEM 标记")
	}

	// 确保换行符正确
	keyStr = strings.ReplaceAll(keyStr, "\r\n", "\n")
	keyStr = strings.ReplaceAll(keyStr, "\r", "\n")

	// 检查换行符数量
	newlineCount := strings.Count(keyStr, "\n")
	log.Printf("🔍 [DEBUG] 私钥中的换行符数量: %d", newlineCount)

	// 如果换行符太少，说明私钥内容可能被压缩成一行了，需要重新格式化
	if hasBegin && hasEnd && newlineCount < 5 {
		log.Println("⚠️  [DEBUG] 检测到私钥内容缺少换行符，尝试重新格式化...")
		log.Printf("🔍 [DEBUG] 当前换行符数量: %d (正常应该>20)", newlineCount)

		// 提取私钥内容部分（去掉BEGIN和END标记）
		beginMarker := "-----BEGIN PRIVATE KEY-----"
		endMarker := "-----END PRIVATE KEY-----"
		beginIdx := strings.Index(keyStr, beginMarker)
		endIdx := strings.Index(keyStr, endMarker)

		if beginIdx >= 0 && endIdx > beginIdx {
			// 提取内容部分
			contentStart := beginIdx + len(beginMarker)
			contentEnd := endIdx
			content := strings.TrimSpace(keyStr[contentStart:contentEnd])

			log.Printf("🔍 [DEBUG] 提取的原始内容长度: %d 字符", len(content))

			// 移除所有空白字符（包括换行符和空格）
			originalContent := content
			content = strings.ReplaceAll(content, "\n", "")
			content = strings.ReplaceAll(content, " ", "")
			content = strings.ReplaceAll(content, "\r", "")
			content = strings.ReplaceAll(content, "\t", "")

			if len(content) != len(originalContent) {
				log.Printf("🔍 [DEBUG] 已移除空白字符，清理后长度: %d 字符 (移除了 %d 个字符)", len(content), len(originalContent)-len(content))
			}

			// 过滤掉所有非Base64字符
			beforeFilter := content
			content = filterBase64Chars(content)
			if len(content) != len(beforeFilter) {
				log.Printf("🔍 [DEBUG] 已过滤非Base64字符，过滤后长度: %d 字符 (移除了 %d 个非法字符)", len(content), len(beforeFilter)-len(content))
				// 显示被移除的字符（用于调试）
				removedChars := make(map[rune]int)
				for _, r := range beforeFilter {
					if !((r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '+' || r == '/' || r == '=') {
						removedChars[r]++
					}
				}
				if len(removedChars) > 0 {
					log.Printf("🔍 [DEBUG] 被移除的非法字符: %v", removedChars)
				}
			}

			// 验证是否为有效的Base64字符串
			if _, err := base64.StdEncoding.DecodeString(content); err != nil {
				log.Printf("⚠️  [DEBUG] 警告：内容不是有效的Base64字符串: %v", err)
				// 显示错误位置附近的字符
				if len(content) > 1624 {
					start := 1620
					if start < 0 {
						start = 0
					}
					end := 1630
					if end > len(content) {
						end = len(content)
					}
					log.Printf("🔍 [DEBUG] 错误位置附近的字符 (位置 %d-%d): %s", start, end, content[start:end])
				}
			} else {
				log.Printf("✅ [DEBUG] 内容验证：是有效的Base64字符串")
			}

			// 每64个字符一行重新格式化
			var formattedContent strings.Builder
			lineCount := 0
			for i := 0; i < len(content); i += 64 {
				end := i + 64
				if end > len(content) {
					end = len(content)
				}
				if i > 0 {
					formattedContent.WriteString("\n")
				}
				formattedContent.WriteString(content[i:end])
				lineCount++
			}

			log.Printf("🔍 [DEBUG] 重新格式化为 %d 行 (每行64字符)", lineCount)

			// 重新组装PEM格式
			keyStr = beginMarker + "\n" + formattedContent.String() + "\n" + endMarker
			newlineCount = strings.Count(keyStr, "\n")
			log.Printf("✅ [DEBUG] 重新格式化完成，换行符数量: %d", newlineCount)
		} else {
			log.Printf("❌ [DEBUG] 无法找到PEM标记位置: beginIdx=%d, endIdx=%d", beginIdx, endIdx)
		}
	}

	// 解析PEM格式
	log.Println("🔍 [DEBUG] 尝试解析 PEM 格式...")
	block, rest := pem.Decode([]byte(keyStr))
	if block == nil {
		log.Println("❌ [DEBUG] PEM 解码失败，尝试其他格式...")
		// 尝试直接解析（可能是去掉了头尾的格式）
		trimmedKey := strings.TrimSpace(keyStr)
		// 移除可能的 PEM 标记
		trimmedKey = strings.TrimPrefix(trimmedKey, "-----BEGIN PRIVATE KEY-----")
		trimmedKey = strings.TrimSuffix(trimmedKey, "-----END PRIVATE KEY-----")
		trimmedKey = strings.TrimPrefix(trimmedKey, "-----BEGIN RSA PRIVATE KEY-----")
		trimmedKey = strings.TrimSuffix(trimmedKey, "-----END RSA PRIVATE KEY-----")
		trimmedKey = strings.TrimSpace(trimmedKey)

		// 移除所有空白字符
		trimmedKey = strings.ReplaceAll(trimmedKey, "\n", "")
		trimmedKey = strings.ReplaceAll(trimmedKey, " ", "")
		trimmedKey = strings.ReplaceAll(trimmedKey, "\r", "")
		trimmedKey = strings.ReplaceAll(trimmedKey, "\t", "")

		// 过滤掉所有非Base64字符
		beforeFilter := trimmedKey
		trimmedKey = filterBase64Chars(trimmedKey)
		if len(trimmedKey) != len(beforeFilter) {
			log.Printf("🔍 [DEBUG] 已过滤非Base64字符，过滤后长度: %d 字符 (移除了 %d 个非法字符)", len(trimmedKey), len(beforeFilter)-len(trimmedKey))
		}

		log.Printf("🔍 [DEBUG] 尝试 Base64 解码，清理后长度: %d", len(trimmedKey))
		keyBytes, err := base64.StdEncoding.DecodeString(trimmedKey)
		if err == nil {
			log.Printf("🔍 [DEBUG] Base64 解码成功，字节长度: %d", len(keyBytes))
			// 尝试解析为 PKCS8
			privateKey, err := x509.ParsePKCS8PrivateKey(keyBytes)
			if err == nil {
				if rsaKey, ok := privateKey.(*rsa.PrivateKey); ok {
					log.Printf("✅ [DEBUG] 私钥解析成功（PKCS8，Base64格式），密钥大小: %d 位", rsaKey.N.BitLen())
					return rsaKey, nil
				}
			} else {
				log.Printf("❌ [DEBUG] PKCS8 解析失败: %v", err)
				// 尝试 PKCS1
				rsaKey, err2 := x509.ParsePKCS1PrivateKey(keyBytes)
				if err2 == nil {
					log.Printf("✅ [DEBUG] 私钥解析成功（PKCS1，Base64格式），密钥大小: %d 位", rsaKey.N.BitLen())
					return rsaKey, nil
				}
				log.Printf("❌ [DEBUG] PKCS1 解析也失败: %v", err2)
			}
		} else {
			log.Printf("❌ [DEBUG] Base64 解码失败: %v", err)
			previewLen := 100
			if len(trimmedKey) < previewLen {
				previewLen = len(trimmedKey)
			}
			log.Printf("🔍 [DEBUG] Base64字符串前%d字符: %s", previewLen, trimmedKey[:previewLen])
			// 显示错误位置附近的字符
			if len(trimmedKey) > 1624 {
				start := 1620
				if start < 0 {
					start = 0
				}
				end := 1630
				if end > len(trimmedKey) {
					end = len(trimmedKey)
				}
				log.Printf("🔍 [DEBUG] 错误位置附近的字符 (位置 %d-%d): %s", start, end, trimmedKey[start:end])
				// 显示该位置的字符编码
				if start < len(trimmedKey) {
					for i := start; i < end && i < len(trimmedKey); i++ {
						log.Printf("🔍 [DEBUG] 位置 %d: 字符='%c' (ASCII=%d, 0x%02x)", i, trimmedKey[i], trimmedKey[i], trimmedKey[i])
					}
				}
			}
		}

		log.Println("❌ [DEBUG] 所有解析方式都失败")
		return nil, errors.New("私钥格式错误：无法解析PEM格式，请确保私钥包含 -----BEGIN PRIVATE KEY----- 和 -----END PRIVATE KEY-----")
	}

	if len(rest) > 0 {
		log.Printf("⚠️  [DEBUG] PEM 解码后有剩余数据，长度: %d", len(rest))
	}

	log.Printf("🔍 [DEBUG] PEM Block Type: %s", block.Type)
	log.Printf("🔍 [DEBUG] PEM Block 字节长度: %d", len(block.Bytes))

	// 解析PKCS8格式
	log.Println("🔍 [DEBUG] 尝试解析 PKCS8 格式...")
	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		log.Printf("❌ [DEBUG] PKCS8 解析失败: %v", err)
		// 如果 PKCS8 失败，尝试 PKCS1 格式
		log.Println("🔍 [DEBUG] 尝试解析 PKCS1 格式...")
		rsaKey, err2 := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err2 == nil {
			log.Printf("✅ [DEBUG] 私钥解析成功（PKCS1格式），密钥大小: %d 位", rsaKey.N.BitLen())
			return rsaKey, nil
		}
		log.Printf("❌ [DEBUG] PKCS1 解析也失败: %v", err2)
		return nil, fmt.Errorf("解析私钥失败: %w (尝试了PKCS8和PKCS1格式)", err)
	}

	rsaKey, ok := privateKey.(*rsa.PrivateKey)
	if !ok {
		log.Println("❌ [DEBUG] 私钥类型错误：不是RSA私钥")
		return nil, errors.New("私钥类型错误：不是RSA私钥")
	}

	log.Printf("✅ [DEBUG] 私钥解析成功（PKCS8格式），密钥大小: %d 位", rsaKey.N.BitLen())
	return rsaKey, nil
}

// buildQueryString 构建查询字符串
func (s *PaymentService) buildQueryString(params map[string]string) string {
	values := url.Values{}
	for k, v := range params {
		// URL编码参数值
		values.Set(k, v)
	}
	encoded := values.Encode()
	log.Printf("📤 构建的查询字符串长度: %d 字符", len(encoded))
	if len(encoded) > 500 {
		log.Printf("📤 查询字符串前500字符: %s...", encoded[:500])
	}
	return encoded
}

// generateRandomString 生成随机字符串
func generateRandomString(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

// GetOrderStatus 获取订单状态
func (s *PaymentService) GetOrderStatus(orderID string) (*paymentModels.Order, error) {
	order, err := s.orderRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

// HandleAlipayNotify 处理支付宝异步通知
func (s *PaymentService) HandleAlipayNotify(params map[string]string) error {
	// 1. 验签
	if err := s.verifySign(params); err != nil {
		return fmt.Errorf("验签失败: %w", err)
	}

	// 2. 获取订单号
	orderID := params["out_trade_no"]
	if orderID == "" {
		return errors.New("订单号为空")
	}

	// 3. 查找订单
	order, err := s.orderRepo.GetByOrderID(orderID)
	if err != nil {
		return fmt.Errorf("订单不存在: %w", err)
	}

	// 4. 检查订单状态（幂等性）
	if order.IsPaid() {
		log.Printf("订单 %s 已支付，忽略重复通知", orderID)
		return nil
	}

	// 5. 验证金额
	notifyAmount, err := strconv.ParseFloat(params["total_amount"], 64)
	if err != nil {
		return fmt.Errorf("金额格式错误: %w", err)
	}
	if notifyAmount != order.Amount {
		return fmt.Errorf("金额不匹配: 订单金额 %.2f, 通知金额 %.2f", order.Amount, notifyAmount)
	}

	// 6. 检查交易状态
	tradeStatus := params["trade_status"]
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		return fmt.Errorf("交易状态异常: %s", tradeStatus)
	}

	// 7. 在事务中更新订单状态 + 增加用户星尘余额，保证原子性（流水可后续补）
	now := time.Now()
	order.Status = paymentModels.OrderStatusPaid
	order.PaidAt = &now
	order.AlipayTradeNo = params["trade_no"]

	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(order).Error; err != nil {
			return fmt.Errorf("更新订单失败: %w", err)
		}
		if err := tx.Model(&userModels.User{}).
			Where("id = ?", order.UserID).
			Update("token_balance", gorm.Expr("token_balance + ?", order.Stardust)).Error; err != nil {
			return fmt.Errorf("更新用户余额失败: %w", err)
		}

		// 创建充值流水记录
		transaction := &userModels.TokenTransaction{
			UserID:       order.UserID,
			Amount:       int64(order.Stardust),
			Type:         "recharge", // 交易类型：充值
			RelatedID:    order.OrderID,
			Description:  fmt.Sprintf("购买套餐: %s", order.PackageName),
			TotalTokens:  int(order.Stardust),
			Cost:         order.Amount, // 实际支付金额
			Currency:     "CNY",        // 货币单位
			CreatedAt:    now,
		}
		if err := tx.Create(transaction).Error; err != nil {
			return fmt.Errorf("创建交易流水失败: %w", err)
		}

		return nil
	}); err != nil {
		return err
	}

	// 9. 记录交易流水（可选，后续实现时可一并放入上方事务）
	// TODO: 创建 TokenTransaction 记录

	log.Printf("订单 %s 支付成功，用户 %d 增加 %d 星尘", orderID, order.UserID, order.Stardust)

	return nil
}

// verifySign 验证签名
func (s *PaymentService) verifySign(params map[string]string) error {
	// 1. 获取签名
	sign, ok := params["sign"]
	if !ok || sign == "" {
		return errors.New("签名为空")
	}

	// 2. 移除签名参数
	signType := params["sign_type"]
	delete(params, "sign")
	delete(params, "sign_type")

	// 3. 参数排序
	keys := make([]string, 0, len(params))
	for k := range params {
		if params[k] != "" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	// 4. 构建待签名字符串
	var signStr strings.Builder
	for i, k := range keys {
		if i > 0 {
			signStr.WriteString("&")
		}
		signStr.WriteString(k)
		signStr.WriteString("=")
		signStr.WriteString(params[k])
	}

	// 5. 解析支付宝公钥
	publicKey, err := s.parsePublicKey(config.AlipayPublicKey)
	if err != nil {
		return fmt.Errorf("解析公钥失败: %w", err)
	}

	// 6. Base64解码签名
	signBytes, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return fmt.Errorf("签名解码失败: %w", err)
	}

	// 7. 验证签名
	hash := sha256.Sum256([]byte(signStr.String()))
	if signType == "RSA2" {
		err = rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hash[:], signBytes)
		if err != nil {
			return fmt.Errorf("签名验证失败: %w", err)
		}
	}

	return nil
}

// parsePublicKey 解析公钥
func (s *PaymentService) parsePublicKey(keyStr string) (*rsa.PublicKey, error) {
	// 处理换行符
	keyStr = strings.ReplaceAll(keyStr, "\\n", "\n")

	// 解析PEM格式
	block, _ := pem.Decode([]byte(keyStr))
	if block == nil {
		return nil, errors.New("公钥格式错误")
	}

	// 解析公钥
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("解析公钥失败: %w", err)
	}

	rsaKey, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("公钥类型错误")
	}

	return rsaKey, nil
}
