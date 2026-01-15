package config

import (
	"fmt"
	"log"
	"os"

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

	// AI预设模型配置（从.env读取，系统级别的共享配置）
	DeepSeekAPIKey string // DeepSeek预设API Key
	DoubaoAPIKey   string // 豆包预设API Key
	QianwenAPIKey  string // 通义千问预设API Key
)

// LoadConfig 加载配置
func LoadConfig() error {
	// 尝试加载.env文件（如果存在）
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  .env file not found, using environment variables")
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

	// AI预设模型配置（可选，如果未配置则用户需要自己配置）
	DeepSeekAPIKey = getEnv("DEEPSEEK_API_KEY", "")
	DoubaoAPIKey = getEnv("DOUBAO_API_KEY", "")
	QianwenAPIKey = getEnv("QIANWEN_API_KEY", "")

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
