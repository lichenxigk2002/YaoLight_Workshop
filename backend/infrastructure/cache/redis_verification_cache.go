package cache

import (
	"fmt"
	"math/rand"
	"time"

	"yaolight-workshop/backend/infrastructure/redis"
)

// RedisVerificationCache Redis 实现的验证码缓存
type RedisVerificationCache struct{}

// NewRedisVerificationCache 创建 Redis 验证码缓存实例
func NewRedisVerificationCache() *RedisVerificationCache {
	return &RedisVerificationCache{}
}

// GenerateCode 生成6位数字验证码
func (c *RedisVerificationCache) GenerateCode() string {
	rand.Seed(time.Now().UnixNano())
	code := rand.Intn(900000) + 100000 // 生成 100000-999999 的随机数
	return fmt.Sprintf("%06d", code)
}

// Set 设置验证码（有效期5分钟）
func (c *RedisVerificationCache) Set(email string, code string) error {
	key := fmt.Sprintf("verify_code:%s", email)
	return redis.Set(key, code, 5*time.Minute)
}

// Verify 验证验证码
func (c *RedisVerificationCache) Verify(email string, code string) (bool, error) {
	key := fmt.Sprintf("verify_code:%s", email)
	storedCode, err := redis.Get(key)
	if err != nil {
		return false, err
	}
	return storedCode == code, nil
}

// Delete 删除验证码（验证成功后删除）
func (c *RedisVerificationCache) Delete(email string) error {
	key := fmt.Sprintf("verify_code:%s", email)
	return redis.Delete(key)
}

// CheckRateLimit 检查发送频率限制（同一邮箱60秒内只能发送一次）
func (c *RedisVerificationCache) CheckRateLimit(email string) (bool, error) {
	limitKey := fmt.Sprintf("verify_limit:%s", email)
	exists, err := redis.Exists(limitKey)
	if err != nil {
		return true, err // 出错时允许发送
	}
	if exists {
		return false, nil // 限制中，不允许发送
	}
	return true, nil // 允许发送
}

// SetRateLimit 设置发送频率限制（60秒）
func (c *RedisVerificationCache) SetRateLimit(email string) error {
	limitKey := fmt.Sprintf("verify_limit:%s", email)
	return redis.Set(limitKey, "1", 60*time.Second)
}

// GetRemainingTime 获取剩余可发送时间（秒）
func (c *RedisVerificationCache) GetRemainingTime(email string) (int, error) {
	limitKey := fmt.Sprintf("verify_limit:%s", email)
	ttl, err := redis.TTL(limitKey)
	if err != nil {
		return 0, err
	}
	if ttl < 0 {
		return 0, nil
	}
	return int(ttl.Seconds()), nil
}

// VerificationCacheInterface 验证码缓存接口
type VerificationCacheInterface interface {
	GenerateCode() string
	Set(email string, code string) error
	Verify(email string, code string) (bool, error)
	Delete(email string) error
	CheckRateLimit(email string) (bool, error)
	SetRateLimit(email string) error
	GetRemainingTime(email string) (int, error)
}

// GetVerificationCacheService 获取验证码缓存服务（根据配置选择 Redis 或内存）
func GetVerificationCacheService(useRedis bool) VerificationCacheInterface {
	if useRedis && redis.Client != nil {
		return NewRedisVerificationCache()
	}
	return GetVerificationCache() // 降级到内存缓存
}
