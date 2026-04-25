package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/mcp/models"
	userModels "yaolight-workshop/backend/modules/user/models"
)

var (
	ErrMCPTokenInvalid = errors.New("mcp token invalid")
	ErrMCPTokenExpired = errors.New("mcp token expired")
	ErrMCPTokenRevoked = errors.New("mcp token revoked")
)

var DefaultReadScopes = []string{
	"projects:read",
	"workflows:read",
	"tasks:read",
	"artifacts:read",
	"knowledge:read",
	"models:read",
}

type TokenService struct {
	db *gorm.DB
}

type CreatedToken struct {
	TokenRecord *models.MCPToken `json:"token_record"`
	PlainToken  string           `json:"plain_token"`
}

type AuthenticatedToken struct {
	Token  *models.MCPToken
	User   *userModels.User
	Scopes map[string]bool
}

func NewTokenService(db *gorm.DB) *TokenService {
	return &TokenService{db: db}
}

func (s *TokenService) DB() *gorm.DB {
	return s.db
}

func (s *TokenService) Create(userID uint, name string, scopes []string, expiresAt *time.Time) (*CreatedToken, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "YaoLight MCP Token"
	}
	if len(scopes) == 0 {
		scopes = DefaultReadScopes
	}
	scopes = NormalizeScopes(scopes, true)

	plainToken, err := generatePlainToken()
	if err != nil {
		return nil, err
	}
	token := &models.MCPToken{
		UserID:      userID,
		Name:        name,
		TokenHash:   HashToken(plainToken),
		TokenPrefix: tokenPrefix(plainToken),
		Scopes:      shared.JSONB{Data: scopes},
		ExpiresAt:   expiresAt,
	}
	if err := s.db.Create(token).Error; err != nil {
		return nil, err
	}
	return &CreatedToken{TokenRecord: token, PlainToken: plainToken}, nil
}

func (s *TokenService) List(userID uint) ([]models.MCPToken, error) {
	var tokens []models.MCPToken
	err := s.db.
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Order("created_at DESC").
		Find(&tokens).Error
	return tokens, err
}

func (s *TokenService) CountActive(userID uint) (int64, error) {
	var count int64
	err := s.db.Model(&models.MCPToken{}).
		Where("user_id = ? AND deleted_at IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)", userID, time.Now()).
		Count(&count).Error
	return count, err
}

func (s *TokenService) Revoke(userID, tokenID uint) error {
	now := time.Now()
	result := s.db.Model(&models.MCPToken{}).
		Where("id = ? AND user_id = ? AND revoked_at IS NULL", tokenID, userID).
		Updates(map[string]any{"revoked_at": now})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *TokenService) DeleteRecord(userID, tokenID uint) error {
	result := s.db.
		Where("id = ? AND user_id = ?", tokenID, userID).
		Where("revoked_at IS NOT NULL OR (expires_at IS NOT NULL AND expires_at <= ?)", time.Now()).
		Delete(&models.MCPToken{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *TokenService) Authenticate(plainToken, ip string) (*AuthenticatedToken, error) {
	plainToken = strings.TrimSpace(plainToken)
	if plainToken == "" {
		return nil, ErrMCPTokenInvalid
	}

	var token models.MCPToken
	if err := s.db.Where("token_hash = ? AND deleted_at IS NULL", HashToken(plainToken)).First(&token).Error; err != nil {
		return nil, ErrMCPTokenInvalid
	}
	if token.RevokedAt != nil {
		return nil, ErrMCPTokenRevoked
	}
	if token.ExpiresAt != nil && token.ExpiresAt.Before(time.Now()) {
		return nil, ErrMCPTokenExpired
	}

	var user userModels.User
	if err := s.db.Where("id = ? AND status = ?", token.UserID, "active").First(&user).Error; err != nil {
		return nil, ErrMCPTokenInvalid
	}

	now := time.Now()
	updates := map[string]any{"last_used_at": now}
	if strings.TrimSpace(ip) != "" {
		updates["last_used_ip"] = ip
	}
	_ = s.db.Model(&models.MCPToken{}).Where("id = ?", token.ID).Updates(updates).Error

	return &AuthenticatedToken{
		Token:  &token,
		User:   &user,
		Scopes: scopeSet(token.Scopes.Data),
	}, nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func generatePlainToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "yl_mcp_" + hex.EncodeToString(buf), nil
}

func tokenPrefix(token string) string {
	if len(token) <= 24 {
		return token
	}
	return token[:24]
}

func NormalizeScopes(scopes []string, allowExecution bool) []string {
	allowed := map[string]bool{
		"projects:read":     true,
		"workflows:read":    true,
		"tasks:read":        true,
		"artifacts:read":    true,
		"knowledge:read":    true,
		"models:read":       true,
		"workflows:execute": true,
		"tasks:write":       true,
	}
	seen := make(map[string]bool)
	result := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" || !allowed[scope] || seen[scope] {
			continue
		}
		if !allowExecution && AllowsExecutionScope(scope) {
			continue
		}
		seen[scope] = true
		result = append(result, scope)
	}
	if len(result) == 0 {
		return DefaultReadScopes
	}
	return result
}

func scopeSet(raw any) map[string]bool {
	result := make(map[string]bool)
	switch values := raw.(type) {
	case []string:
		for _, scope := range values {
			result[scope] = true
		}
	case []any:
		for _, value := range values {
			if scope, ok := value.(string); ok {
				result[scope] = true
			}
		}
	}
	return result
}
