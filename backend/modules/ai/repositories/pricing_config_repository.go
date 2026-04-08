package repositories

import (
	"gorm.io/gorm"
	aiModels "yaolight-workshop/backend/modules/ai/models"
)

// PricingConfigRepository 计费配置仓库接口
type PricingConfigRepository interface {
	FindByProviderAndModel(provider string, modelName string) (*aiModels.ModelPricingConfig, error)
	CreateOrUpdate(config *aiModels.ModelPricingConfig) error
	FindAll() ([]aiModels.ModelPricingConfig, error)
	FindActiveByProvider(provider string) ([]aiModels.ModelPricingConfig, error)
}

type pricingConfigRepository struct {
	db *gorm.DB
}

// NewPricingConfigRepository 创建计费配置仓库
func NewPricingConfigRepository(db *gorm.DB) PricingConfigRepository {
	return &pricingConfigRepository{db: db}
}

// FindByProviderAndModel 根据provider和modelName查找计费配置
func (r *pricingConfigRepository) FindByProviderAndModel(provider string, modelName string) (*aiModels.ModelPricingConfig, error) {
	var config aiModels.ModelPricingConfig
	err := r.db.Where("provider = ? AND model_name = ? AND is_active = ?", provider, modelName, true).
		First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// CreateOrUpdate 创建或更新计费配置
func (r *pricingConfigRepository) CreateOrUpdate(config *aiModels.ModelPricingConfig) error {
	var existing aiModels.ModelPricingConfig
	err := r.db.Where("provider = ? AND model_name = ?", config.Provider, config.ModelName).
		First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		// 创建新配置
		return r.db.Create(config).Error
	} else if err != nil {
		return err
	}

	// 更新现有配置
	config.ID = existing.ID
	return r.db.Model(&existing).Updates(config).Error
}

// FindAll 查找所有计费配置
func (r *pricingConfigRepository) FindAll() ([]aiModels.ModelPricingConfig, error) {
	var configs []aiModels.ModelPricingConfig
	err := r.db.Where("is_active = ?", true).Find(&configs).Error
	return configs, err
}

// FindActiveByProvider 根据provider查找所有激活的计费配置
func (r *pricingConfigRepository) FindActiveByProvider(provider string) ([]aiModels.ModelPricingConfig, error) {
	var configs []aiModels.ModelPricingConfig
	err := r.db.Where("provider = ? AND is_active = ?", provider, true).Find(&configs).Error
	return configs, err
}
