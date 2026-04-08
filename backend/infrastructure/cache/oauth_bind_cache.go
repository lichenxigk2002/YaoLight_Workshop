package cache

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

type oauthBindEntry struct {
	UserID    uint
	ExpiredAt time.Time
}

// OAuthBindCache 用于“绑定第三方”流程的一次性 token：token -> userId，TTL 5 分钟
type OAuthBindCache struct {
	cache map[string]*oauthBindEntry
	mu    sync.RWMutex
}

var (
	oauthBindCacheInstance *OAuthBindCache
	oauthBindOnce          sync.Once
)

func GetOAuthBindCache() *OAuthBindCache {
	oauthBindOnce.Do(func() {
		oauthBindCacheInstance = &OAuthBindCache{cache: make(map[string]*oauthBindEntry)}
		go oauthBindCacheInstance.cleanExpired()
	})
	return oauthBindCacheInstance
}

func randomToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Set 写入 token -> userId，5 分钟有效
func (c *OAuthBindCache) Set(token string, userID uint) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[token] = &oauthBindEntry{UserID: userID, ExpiredAt: time.Now().Add(5 * time.Minute)}
}

// Get 返回 userId；过期或不存在返回 0, false
func (c *OAuthBindCache) Get(token string) (uint, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.cache[token]
	if !ok || time.Now().After(e.ExpiredAt) {
		return 0, false
	}
	return e.UserID, true
}

// Delete 用后删除
func (c *OAuthBindCache) Delete(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, token)
}

// CreateToken 生成新 token 并写入 userId，返回 token
func (c *OAuthBindCache) CreateToken(userID uint) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	c.Set(token, userID)
	return token, nil
}

func (c *OAuthBindCache) cleanExpired() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for k, e := range c.cache {
			if now.After(e.ExpiredAt) {
				delete(c.cache, k)
			}
		}
		c.mu.Unlock()
	}
}
