package cache

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// VerificationCode 验证码结构
type VerificationCode struct {
	Code      string
	ExpiredAt time.Time
	Email     string
}

// VerificationCache 验证码缓存（内存实现）
type VerificationCache struct {
	cache map[string]*VerificationCode
	mu    sync.RWMutex
}

var (
	verificationCacheInstance *VerificationCache
	once                      sync.Once
)

// GetVerificationCache 获取验证码缓存实例（单例）
func GetVerificationCache() *VerificationCache {
	once.Do(func() {
		verificationCacheInstance = &VerificationCache{
			cache: make(map[string]*VerificationCode),
		}
		// 启动定期清理过期验证码的协程
		go verificationCacheInstance.cleanExpired()
	})
	return verificationCacheInstance
}

// GenerateCode 生成6位数字验证码
func (c *VerificationCache) GenerateCode() string {
	rand.Seed(time.Now().UnixNano())
	code := rand.Intn(900000) + 100000 // 生成 100000-999999 的随机数
	return fmt.Sprintf("%06d", code)
}

// Set 设置验证码（有效期5分钟）
func (c *VerificationCache) Set(email string, code string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache[email] = &VerificationCode{
		Code:      code,
		Email:     email,
		ExpiredAt: time.Now().Add(5 * time.Minute),
	}
	return nil
}

// Verify 验证验证码
func (c *VerificationCache) Verify(email string, code string) (bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	vc, exists := c.cache[email]
	if !exists {
		return false, nil
	}

	// 检查是否过期
	if time.Now().After(vc.ExpiredAt) {
		return false, nil
	}

	// 验证码匹配
	return vc.Code == code, nil
}

// Delete 删除验证码（验证成功后删除）
func (c *VerificationCache) Delete(email string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.cache, email)
	return nil
}

// CheckRateLimit 检查发送频率限制（同一邮箱60秒内只能发送一次）
func (c *VerificationCache) CheckRateLimit(email string) (bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	vc, exists := c.cache[email]
	if !exists {
		return true, nil // 可以发送
	}

	// 如果距离上次发送不到60秒，则不能发送
	timeSinceCreated := time.Since(vc.ExpiredAt.Add(-5 * time.Minute))
	return timeSinceCreated >= 60*time.Second, nil
}

// SetRateLimit 设置发送频率限制（内存实现自动处理，无需额外操作）
func (c *VerificationCache) SetRateLimit(email string) error {
	return nil // 内存缓存在 Set 时自动处理
}

// GetRemainingTime 获取剩余可发送时间（秒）
func (c *VerificationCache) GetRemainingTime(email string) (int, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	vc, exists := c.cache[email]
	if !exists {
		return 0, nil
	}

	createdAt := vc.ExpiredAt.Add(-5 * time.Minute)
	elapsed := time.Since(createdAt)
	remaining := 60 - int(elapsed.Seconds())

	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}

// cleanExpired 定期清理过期验证码
func (c *VerificationCache) cleanExpired() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for email, vc := range c.cache {
			if now.After(vc.ExpiredAt) {
				delete(c.cache, email)
			}
		}
		c.mu.Unlock()
	}
}
