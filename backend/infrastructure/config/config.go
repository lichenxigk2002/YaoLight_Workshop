package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/joho/godotenv"
)

var (
	// 数据库配置
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Redis配置
	RedisHost     string
	RedisPort     string
	RedisPassword string

	// JWT配置
	JWTSecret      string
	JWTExpireHours int

	// 服务器配置
	ServerPort string
	ServerMode string

	AdminBootstrapUsername string
	AdminBootstrapEmail    string
	AdminBootstrapPassword string

	// AI预设模型配置（从.env读取，系统级别的共享配置）
	DeepSeekAPIKey          string // DeepSeek预设API Key
	DoubaoAPIKey            string // 豆包预设API Key
	QwenAPIKey              string // 通义千问预设API Key
	ZhipuaiAPIKey           string // 智谱AI预设API Key
	GeminiAPIKey            string // Gemini预设API Key
	SparkAPIKey             string // 讯飞星火预设API Key
	HunyuanAPIKey           string // 腾讯混元预设API Key
	AIRequestTimeoutSeconds int    // AI 请求超时时间（秒）
	AIHTTPProxyURL          string // AI 请求通用代理
	OpenRouterProxyURL      string // OpenRouter 通用代理
	GPTProxyURL             string // GPT provider 专用代理
	ClaudeProxyURL          string // Claude provider 专用代理
	GeminiProxyURL          string // Gemini provider 专用代理
	GrokProxyURL            string // Grok provider 专用代理
	GeminiBaseURL           string // Gemini provider 默认 Base URL
	OpenAIBaseURL           string // GPT/OpenAI provider 默认 Base URL

	// 文件上传配置
	UploadPath string // 文件上传路径

	// 腾讯云 COS 配置（头像等文件，不配置则走本地 UploadPath）
	COSEnabled       bool   // 是否启用 COS
	COSBucket        string // 存储桶名称（含 APPID，如 my-bucket-1234567890）
	COSRegion        string // 地域，如 ap-guangzhou
	COSSecretID      string
	COSSecretKey     string
	COSPublicBaseURL string // 可选：自定义/CDN 域名，如 https://cdn.example.com，空则用默认域名

	// OAuth 登录（Google / GitHub）
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
	FrontendURL        string // 登录成功后重定向的前端地址，如 http://localhost:3000
	OpenAPIKeyPepper   string

	// 支付宝支付配置
	AlipayAppID      string // 支付宝应用ID
	AlipayPID        string // 支付宝商户PID
	AlipayGateway    string // 支付宝网关地址
	AlipayPrivateKey string // 应用私钥
	AlipayPublicKey  string // 支付宝公钥
	AlipayNotifyURL  string // 异步通知地址
	AlipayReturnURL  string // 同步跳转地址
	AlipaySignType   string // 签名方式
	AlipayCharset    string // 字符编码
	AlipayFormat     string // 数据格式
)

// LoadConfig 加载配置
func LoadConfig() error {
	// 获取当前工作目录
	wd, err := os.Getwd()
	if err != nil {
		wd = "unknown"
	}

	// 尝试从多个位置加载.env文件
	envPaths := []string{
		".env",                    // 当前工作目录
		filepath.Join(wd, ".env"), // 当前工作目录的绝对路径
		"../.env",                 // 上级目录
		"../../.env",              // 再上一级
	}

	var loaded bool
	var loadedPath string
	for _, path := range envPaths {
		// 检查文件是否存在
		if _, err := os.Stat(path); err == nil {
			// 文件存在，尝试加载
			// 使用 godotenv.Load 的变体，支持多行值
			if err := godotenv.Load(path); err == nil {
				loadedPath = path
				loaded = true
				break
			} else {
				// 如果标准加载失败，尝试手动解析（处理多行和特殊字符）
				if err := loadEnvFileManually(path); err == nil {
					loadedPath = path
					loaded = true
					break
				} else {
					log.Printf("⚠️  Found .env at %s but failed to load: %v", path, err)
				}
			}
		}
	}

	if loaded {
		log.Printf("✅ Loaded .env file from: %s", loadedPath)
	} else {
		log.Println("⚠️  .env file not found, using environment variables")
		log.Printf("   Current working directory: %s", wd)
		log.Println("   Searched paths:")
		for _, path := range envPaths {
			absPath, _ := filepath.Abs(path)
			if _, err := os.Stat(path); err == nil {
				log.Printf("     ✓ %s (exists)", absPath)
			} else {
				log.Printf("     ✗ %s (not found)", absPath)
			}
		}
	}

	// 数据库配置
	DBHost = getEnv("DB_HOST", "localhost")
	DBPort = getEnv("DB_PORT", "5432")
	DBUser = getEnv("DB_USER", "postgres")
	DBPassword = getEnv("DB_PASSWORD", "postgres")
	DBName = getEnv("DB_NAME", "workflow_db")
	DBSSLMode = getEnv("DB_SSLMODE", "disable")

	// Redis配置
	RedisHost = getEnv("REDIS_HOST", "localhost")
	RedisPort = getEnv("REDIS_PORT", "6379")
	RedisPassword = getEnv("REDIS_PASSWORD", "")

	// JWT配置
	JWTSecret = getEnv("JWT_SECRET", "your-secret-key-change-in-production")
	JWTExpireHours = getEnvInt("JWT_EXPIRE_HOURS", 24)

	// 服务器配置
	ServerPort = getEnv("SERVER_PORT", "8080")
	ServerMode = getEnv("SERVER_MODE", "debug")
	AdminBootstrapUsername = getEnv("ADMIN_BOOTSTRAP_USERNAME", "")
	AdminBootstrapEmail = getEnv("ADMIN_BOOTSTRAP_EMAIL", "")
	AdminBootstrapPassword = getEnv("ADMIN_BOOTSTRAP_PASSWORD", "")

	// AI预设模型配置（可选，如果未配置则用户需要自己配置）
	DeepSeekAPIKey = getEnv("DEEPSEEK_API_KEY", "")
	DoubaoAPIKey = getEnv("DOUBAO_API_KEY", "")
	QwenAPIKey = getEnv("QWEN_API_KEY", "")
	ZhipuaiAPIKey = getEnv("ZHIPUAI_API_KEY", "")
	GeminiAPIKey = getEnv("OPENROUTER_API_KEY", "")
	SparkAPIKey = getEnv("SPARK_API_PASSWORD", "")
	HunyuanAPIKey = getEnv("HUNYUAN_API_KEY", "")
	AIRequestTimeoutSeconds = getEnvInt("AI_REQUEST_TIMEOUT_SECONDS", 90)
	AIHTTPProxyURL = strings.TrimSpace(getEnv("AI_HTTP_PROXY_URL", ""))
	OpenRouterProxyURL = strings.TrimSpace(getEnv("OPENROUTER_PROXY_URL", ""))
	GPTProxyURL = strings.TrimSpace(getEnv("GPT_PROXY_URL", ""))
	ClaudeProxyURL = strings.TrimSpace(getEnv("CLAUDE_PROXY_URL", ""))
	GeminiProxyURL = strings.TrimSpace(getEnv("GEMINI_PROXY_URL", ""))
	GrokProxyURL = strings.TrimSpace(getEnv("GROK_PROXY_URL", ""))
	GeminiBaseURL = strings.TrimSpace(getEnv("GEMINI_BASE_URL", ""))
	OpenAIBaseURL = strings.TrimSpace(getEnv("OPENAI_BASE_URL", ""))

	// 文件上传配置
	UploadPath = getEnv("UPLOAD_PATH", "./uploads")

	// 腾讯云 COS
	COSEnabled = getEnv("COS_ENABLED", "false") == "true" || getEnv("COS_ENABLED", "") == "1"
	COSBucket = getEnv("COS_BUCKET", "")
	COSRegion = getEnv("COS_REGION", "")
	COSSecretID = getEnv("COS_SECRET_ID", "")
	COSSecretKey = getEnv("COS_SECRET_KEY", "")
	COSPublicBaseURL = getEnv("COS_PUBLIC_BASE_URL", "")

	// OAuth 登录
	GoogleClientID = getEnv("GOOGLE_CLIENT_ID", "")
	GoogleClientSecret = getEnv("GOOGLE_CLIENT_SECRET", "")
	GitHubClientID = getEnv("GITHUB_CLIENT_ID", "")
	GitHubClientSecret = getEnv("GITHUB_CLIENT_SECRET", "")
	FrontendURL = getEnv("FRONTEND_URL", "http://localhost:3000")
	OpenAPIKeyPepper = getEnv("OPEN_API_KEY_PEPPER", "")

	// 支付宝支付配置
	AlipayAppID = getEnv("ALIPAY_APP_ID", "")
	AlipayPID = getEnv("ALIPAY_PID", "")
	AlipayGateway = getEnv("ALIPAY_GATEWAY", "https://openapi-sandbox.dl.alipaydev.com/gateway.do")
	AlipayPrivateKey = getEnv("ALIPAY_PRIVATE_KEY", "")
	AlipayPublicKey = getEnv("ALIPAY_PUBLIC_KEY", "")
	AlipayNotifyURL = getEnv("ALIPAY_NOTIFY_URL", "")
	AlipayReturnURL = getEnv("ALIPAY_RETURN_URL", "")
	AlipaySignType = getEnv("ALIPAY_SIGN_TYPE", "RSA2")
	AlipayCharset = getEnv("ALIPAY_CHARSET", "utf-8")
	AlipayFormat = getEnv("ALIPAY_FORMAT", "JSON")

	// 输出支付宝配置信息（用于调试）
	log.Println("=== 支付宝配置信息 ===")
	log.Printf("APP_ID: %s", AlipayAppID)
	log.Printf("PID: %s", AlipayPID)
	log.Printf("Gateway: %s", AlipayGateway)
	log.Printf("SignType: %s", AlipaySignType)
	log.Printf("Charset: %s", AlipayCharset)
	log.Printf("Format: %s", AlipayFormat)
	log.Printf("NotifyURL: %s", AlipayNotifyURL)
	log.Printf("ReturnURL: %s", AlipayReturnURL)

	// 私钥信息（敏感信息，只显示部分）
	if AlipayPrivateKey != "" {
		log.Printf("PrivateKey长度: %d 字符", len(AlipayPrivateKey))
		// 检查是否包含PEM标记
		hasBegin := strings.Contains(AlipayPrivateKey, "BEGIN")
		hasEnd := strings.Contains(AlipayPrivateKey, "END")
		log.Printf("PrivateKey包含BEGIN标记: %v", hasBegin)
		log.Printf("PrivateKey包含END标记: %v", hasEnd)
		if len(AlipayPrivateKey) > 50 {
			log.Printf("PrivateKey前50字符: %s", AlipayPrivateKey[:50])
			log.Printf("PrivateKey后50字符: %s", AlipayPrivateKey[len(AlipayPrivateKey)-50:])
		} else {
			log.Printf("PrivateKey内容: %s", AlipayPrivateKey)
		}
		// 检查换行符
		hasNewline := strings.Contains(AlipayPrivateKey, "\n")
		hasEscapedNewline := strings.Contains(AlipayPrivateKey, "\\n")
		log.Printf("PrivateKey包含实际换行符(\\n): %v", hasNewline)
		log.Printf("PrivateKey包含转义换行符(\\\\n): %v", hasEscapedNewline)
	} else {
		log.Println("⚠️  PrivateKey为空！")
	}

	// 公钥信息
	if AlipayPublicKey != "" {
		log.Printf("PublicKey长度: %d 字符", len(AlipayPublicKey))
		hasBegin := strings.Contains(AlipayPublicKey, "BEGIN")
		hasEnd := strings.Contains(AlipayPublicKey, "END")
		log.Printf("PublicKey包含BEGIN标记: %v", hasBegin)
		log.Printf("PublicKey包含END标记: %v", hasEnd)
	} else {
		log.Println("⚠️  PublicKey为空！")
	}
	log.Println("====================")

	return nil
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt 获取整数环境变量
func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	var result int
	if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
		return defaultValue
	}
	return result
}

// loadEnvFileManually 手动加载 .env 文件（处理多行值和特殊字符）
func loadEnvFileManually(path string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	lines := strings.Split(string(content), "\n")
	var currentKey string
	var currentValue strings.Builder
	inQuotes := false
	quoteChar := byte(0)

	for i, line := range lines {
		line = strings.TrimRight(line, "\r")

		// 跳过注释和空行
		if strings.HasPrefix(strings.TrimSpace(line), "#") || strings.TrimSpace(line) == "" {
			continue
		}

		// 检查是否在引号内（继续上一行的值）
		if currentKey != "" && !inQuotes {
			// 检查是否是新的键值对
			if strings.Contains(line, "=") && !strings.HasPrefix(strings.TrimSpace(line), "#") {
				// 保存之前的值
				value := strings.TrimSpace(currentValue.String())
				if value != "" {
					os.Setenv(currentKey, value)
				}
				currentKey = ""
				currentValue.Reset()
			}
		}

		// 解析键值对
		if idx := strings.Index(line, "="); idx > 0 {
			key := strings.TrimSpace(line[:idx])
			valuePart := line[idx+1:]

			// 检查值是否以引号开始
			valuePart = strings.TrimSpace(valuePart)
			if len(valuePart) > 0 {
				if valuePart[0] == '"' || valuePart[0] == '\'' {
					inQuotes = true
					quoteChar = valuePart[0]
					valuePart = valuePart[1:]
				}
			}

			// 检查值是否以引号结束
			if inQuotes && len(valuePart) > 0 && valuePart[len(valuePart)-1] == quoteChar {
				inQuotes = false
				valuePart = valuePart[:len(valuePart)-1]
			}

			if currentKey == "" {
				currentKey = key
				currentValue.Reset()
			}

			if valuePart != "" {
				if currentValue.Len() > 0 {
					currentValue.WriteString("\n")
				}
				currentValue.WriteString(valuePart)
			}
		} else if currentKey != "" {
			// 继续上一行的值（多行值）
			if currentValue.Len() > 0 {
				currentValue.WriteString("\n")
			}
			currentValue.WriteString(line)

			// 检查是否结束引号
			if inQuotes && strings.HasSuffix(line, string(quoteChar)) {
				inQuotes = false
				// 移除末尾的引号
				val := currentValue.String()
				if len(val) > 0 && val[len(val)-1] == quoteChar {
					currentValue.Reset()
					currentValue.WriteString(val[:len(val)-1])
				}
			}
		}

		// 如果不在引号内且遇到空行或注释，保存当前值
		if !inQuotes && currentKey != "" {
			if i == len(lines)-1 || strings.TrimSpace(lines[i+1]) == "" || strings.HasPrefix(strings.TrimSpace(lines[i+1]), "#") {
				value := strings.TrimSpace(currentValue.String())
				if value != "" {
					os.Setenv(currentKey, value)
				}
				currentKey = ""
				currentValue.Reset()
			}
		}
	}

	// 保存最后一个值
	if currentKey != "" {
		value := strings.TrimSpace(currentValue.String())
		if value != "" {
			os.Setenv(currentKey, value)
		}
	}

	return nil
}
