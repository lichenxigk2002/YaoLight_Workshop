package entity

import "yaolight-workshop/backend/infrastructure/shared"

// ProviderTemplate 供应商模板领域实体
type ProviderTemplate struct {
	ID              uint
	Provider        string
	Name            string
	Description     *string
	Icon            *string
	DefaultBaseURL  *string
	DefaultEndpoint *string
	SupportedModels shared.JSONB
	ConfigSchema    shared.JSONB
	DefaultConfig   shared.JSONB
	IsActive        bool
}

// IsActive 检查模板是否激活
func (t *ProviderTemplate) Active() bool {
	return t.IsActive
}
