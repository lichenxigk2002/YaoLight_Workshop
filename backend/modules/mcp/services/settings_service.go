package services

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
	systemModels "yaolight-workshop/backend/modules/system/models"
)

const AccessConfigKey = "mcp_access"

type AccessSettings struct {
	Enabled              bool     `json:"enabled"`
	AllowExecutionTools  bool     `json:"allowExecutionTools"`
	DefaultExpiresInDays int      `json:"defaultExpiresInDays"`
	MaxExpiresInDays     int      `json:"maxExpiresInDays"`
	MaxTokensPerUser     int      `json:"maxTokensPerUser"`
	RateLimitPerMinute   int      `json:"rateLimitPerMinute"`
	DefaultScopes        []string `json:"defaultScopes"`
}

func DefaultAccessSettings() AccessSettings {
	return AccessSettings{
		Enabled:              true,
		AllowExecutionTools:  false,
		DefaultExpiresInDays: 90,
		MaxExpiresInDays:     365,
		MaxTokensPerUser:     10,
		RateLimitPerMinute:   60,
		DefaultScopes:        DefaultReadScopes,
	}
}

func LoadAccessSettings(db *gorm.DB) AccessSettings {
	defaults := DefaultAccessSettings()
	var cfg systemModels.SystemConfig
	if err := db.Where("key = ? AND deleted_at IS NULL", AccessConfigKey).First(&cfg).Error; err != nil {
		return defaults
	}
	values, ok := cfg.Value.Data.(map[string]interface{})
	if !ok {
		return defaults
	}
	if enabled, ok := values["enabled"].(bool); ok {
		defaults.Enabled = enabled
	}
	if allow, ok := values["allowExecutionTools"].(bool); ok {
		defaults.AllowExecutionTools = allow
	}
	if days, ok := numberValue(values["defaultExpiresInDays"]); ok {
		defaults.DefaultExpiresInDays = days
	}
	if days, ok := numberValue(values["maxExpiresInDays"]); ok {
		defaults.MaxExpiresInDays = days
	}
	if maxTokens, ok := numberValue(values["maxTokensPerUser"]); ok {
		defaults.MaxTokensPerUser = maxTokens
	}
	if rateLimit, ok := numberValue(values["rateLimitPerMinute"]); ok {
		defaults.RateLimitPerMinute = rateLimit
	}
	if rawScopes, ok := values["defaultScopes"].([]interface{}); ok {
		scopes := make([]string, 0, len(rawScopes))
		for _, raw := range rawScopes {
			if scope, ok := raw.(string); ok {
				scopes = append(scopes, scope)
			}
		}
		defaults.DefaultScopes = NormalizeScopes(scopes, true)
	}
	return NormalizeAccessSettings(defaults)
}

func SaveAccessSettings(db *gorm.DB, settings AccessSettings) (AccessSettings, error) {
	settings = NormalizeAccessSettings(settings)
	description := "MCP access settings"
	category := "mcp"
	value := shared.JSONB{Data: map[string]interface{}{
		"enabled":              settings.Enabled,
		"allowExecutionTools":  settings.AllowExecutionTools,
		"defaultExpiresInDays": settings.DefaultExpiresInDays,
		"maxExpiresInDays":     settings.MaxExpiresInDays,
		"maxTokensPerUser":     settings.MaxTokensPerUser,
		"rateLimitPerMinute":   settings.RateLimitPerMinute,
		"defaultScopes":        settings.DefaultScopes,
	}}

	var existing systemModels.SystemConfig
	if err := db.Where("key = ?", AccessConfigKey).First(&existing).Error; err == nil {
		existing.Value = value
		existing.Description = &description
		existing.Category = &category
		return settings, db.Save(&existing).Error
	}

	cfg := systemModels.SystemConfig{Key: AccessConfigKey, Value: value, Description: &description, Category: &category}
	return settings, db.Create(&cfg).Error
}

func NormalizeAccessSettings(settings AccessSettings) AccessSettings {
	defaults := DefaultAccessSettings()
	if settings.DefaultExpiresInDays <= 0 {
		settings.DefaultExpiresInDays = defaults.DefaultExpiresInDays
	}
	if settings.MaxExpiresInDays <= 0 {
		settings.MaxExpiresInDays = defaults.MaxExpiresInDays
	}
	if settings.MaxExpiresInDays > 365 {
		settings.MaxExpiresInDays = 365
	}
	if settings.DefaultExpiresInDays > settings.MaxExpiresInDays {
		settings.DefaultExpiresInDays = settings.MaxExpiresInDays
	}
	if settings.MaxTokensPerUser < 0 {
		settings.MaxTokensPerUser = defaults.MaxTokensPerUser
	}
	if settings.RateLimitPerMinute < 0 {
		settings.RateLimitPerMinute = defaults.RateLimitPerMinute
	}
	settings.DefaultScopes = NormalizeScopes(settings.DefaultScopes, true)
	return settings
}

func AllowsExecutionScope(scope string) bool {
	return scope == "workflows:execute" || scope == "tasks:write"
}

func IsExecutionTool(toolName string) bool {
	switch toolName {
	case "run_workflow", "cancel_task", "retry_task":
		return true
	default:
		return false
	}
}

func CountRecentTokenCalls(db *gorm.DB, tokenID uint, since time.Time) (int64, error) {
	var count int64
	err := db.Table("mcp_call_logs").
		Where("token_id = ? AND created_at >= ? AND deleted_at IS NULL", tokenID, since).
		Count(&count).Error
	return count, err
}

func numberValue(value interface{}) (int, bool) {
	switch v := value.(type) {
	case float64:
		return int(v), true
	case int:
		return v, true
	case int64:
		return int(v), true
	default:
		return 0, false
	}
}
