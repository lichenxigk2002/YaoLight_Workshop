package repository

import (
	"yaolight-workshop/backend/domain/entity"
)

// ProviderTemplateRepository 供应商模板仓储接口
type ProviderTemplateRepository interface {
	// FindAll 查找所有激活的模板
	FindAll() ([]*entity.ProviderTemplate, error)

	// FindByProvider 根据提供商名称查找模板
	FindByProvider(provider string) (*entity.ProviderTemplate, error)

	// FindByID 根据ID查找模板
	FindByID(id uint) (*entity.ProviderTemplate, error)

	// Update 更新模板
	Update(template *entity.ProviderTemplate) error
}
