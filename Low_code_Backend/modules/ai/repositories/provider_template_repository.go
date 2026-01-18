package repositories

import (
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/modules/ai/models"

	"gorm.io/gorm"
)

// providerTemplateRepository 供应商模板仓储实现
type providerTemplateRepository struct {
	db *gorm.DB
}

// NewProviderTemplateRepository 创建供应商模板仓储实例
func NewProviderTemplateRepository(db *gorm.DB) repository.ProviderTemplateRepository {
	return &providerTemplateRepository{db: db}
}

// toDomainEntity 将持久化实体转换为领域实体
func toTemplateDomainEntity(m *models.ProviderTemplate) *entity.ProviderTemplate {
	return &entity.ProviderTemplate{
		ID:              m.ID,
		Provider:        m.Provider,
		Name:            m.Name,
		Description:     m.Description,
		Icon:            m.Icon,
		DefaultBaseURL:  m.DefaultBaseURL,
		DefaultEndpoint: m.DefaultEndpoint,
		SupportedModels: m.SupportedModels,
		ConfigSchema:    m.ConfigSchema,
		DefaultConfig:   m.DefaultConfig,
		IsActive:        m.IsActive,
	}
}

// FindAll 查找所有激活的模板
func (r *providerTemplateRepository) FindAll() ([]*entity.ProviderTemplate, error) {
	var templates []models.ProviderTemplate
	if err := r.db.Where("is_active = ?", true).Find(&templates).Error; err != nil {
		return nil, err
	}

	entities := make([]*entity.ProviderTemplate, len(templates))
	for i := range templates {
		entities[i] = toTemplateDomainEntity(&templates[i])
	}

	return entities, nil
}

// FindByProvider 根据提供商名称查找模板
func (r *providerTemplateRepository) FindByProvider(provider string) (*entity.ProviderTemplate, error) {
	var m models.ProviderTemplate
	if err := r.db.Where("provider = ? AND is_active = ?", provider, true).First(&m).Error; err != nil {
		return nil, err
	}
	return toTemplateDomainEntity(&m), nil
}

// FindByID 根据ID查找模板
func (r *providerTemplateRepository) FindByID(id uint) (*entity.ProviderTemplate, error) {
	var m models.ProviderTemplate
	if err := r.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return toTemplateDomainEntity(&m), nil
}
