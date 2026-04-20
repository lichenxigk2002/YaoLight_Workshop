package repositories

import (
	"gorm.io/gorm"
	aiModels "yaolight-workshop/backend/modules/ai/models"
)

// CapabilityConfigRepository 模型能力配置仓库接口
type CapabilityConfigRepository interface {
	FindByProviderAndModel(provider, modelName string) (*aiModels.ModelCapabilityConfig, error)
	FindByProvider(provider string) ([]aiModels.ModelCapabilityConfig, error)
	CreateOrUpdate(config *aiModels.ModelCapabilityConfig) error
}

type capabilityConfigRepository struct {
	db *gorm.DB
}

// NewCapabilityConfigRepository 创建能力配置仓库
func NewCapabilityConfigRepository(db *gorm.DB) CapabilityConfigRepository {
	return &capabilityConfigRepository{db: db}
}

// FindByProviderAndModel 根据 provider 和 model_name 查询
func (r *capabilityConfigRepository) FindByProviderAndModel(provider, modelName string) (*aiModels.ModelCapabilityConfig, error) {
	var c aiModels.ModelCapabilityConfig
	err := r.db.Where("provider = ? AND model_name = ? AND is_active = ?", provider, modelName, true).
		First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// FindByProvider 查询某供应商下所有模型的能力配置
func (r *capabilityConfigRepository) FindByProvider(provider string) ([]aiModels.ModelCapabilityConfig, error) {
	var list []aiModels.ModelCapabilityConfig
	err := r.db.Where("provider = ? AND is_active = ?", provider, true).Order("sort_order ASC, model_name ASC").Find(&list).Error
	return list, err
}

// CreateOrUpdate 创建或更新
func (r *capabilityConfigRepository) CreateOrUpdate(config *aiModels.ModelCapabilityConfig) error {
	var existing aiModels.ModelCapabilityConfig
	err := r.db.Where("provider = ? AND model_name = ?", config.Provider, config.ModelName).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.Create(config).Error
	}
	if err != nil {
		return err
	}
	config.ID = existing.ID
	return r.db.Model(&existing).Select("*").Updates(config).Error
}
