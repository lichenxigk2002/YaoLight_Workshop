package repositories

import (
	"gorm.io/gorm"
	aiModels "yaolight-workshop/backend/modules/ai/models"
)

type PricingRuleRepository interface {
	FindAll() ([]aiModels.ModelPricingRule, error)
	FindByModelID(modelID uint) ([]aiModels.ModelPricingRule, error)
	FindActiveByModelID(modelID uint) (*aiModels.ModelPricingRule, error)
	FindLatestVersionByModelID(modelID uint) (int, error)
	Create(rule *aiModels.ModelPricingRule) error
	DeactivateByModelID(modelID uint) error
}

type pricingRuleRepository struct {
	db *gorm.DB
}

func NewPricingRuleRepository(db *gorm.DB) PricingRuleRepository {
	return &pricingRuleRepository{db: db}
}

func (r *pricingRuleRepository) FindAll() ([]aiModels.ModelPricingRule, error) {
	var list []aiModels.ModelPricingRule
	err := r.db.Order("provider ASC, model_name ASC, version DESC").Find(&list).Error
	return list, err
}

func (r *pricingRuleRepository) FindByModelID(modelID uint) ([]aiModels.ModelPricingRule, error) {
	var list []aiModels.ModelPricingRule
	err := r.db.Where("managed_model_id = ?", modelID).
		Order("version DESC, created_at DESC").
		Find(&list).Error
	return list, err
}

func (r *pricingRuleRepository) FindActiveByModelID(modelID uint) (*aiModels.ModelPricingRule, error) {
	var rule aiModels.ModelPricingRule
	err := r.db.Where("managed_model_id = ? AND is_active = ?", modelID, true).
		Order("version DESC").
		First(&rule).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *pricingRuleRepository) FindLatestVersionByModelID(modelID uint) (int, error) {
	var rule aiModels.ModelPricingRule
	err := r.db.Where("managed_model_id = ?", modelID).
		Order("version DESC").
		First(&rule).Error
	if err == gorm.ErrRecordNotFound {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return rule.Version, nil
}

func (r *pricingRuleRepository) Create(rule *aiModels.ModelPricingRule) error {
	return r.db.Create(rule).Error
}

func (r *pricingRuleRepository) DeactivateByModelID(modelID uint) error {
	return r.db.Model(&aiModels.ModelPricingRule{}).
		Where("managed_model_id = ? AND is_active = ?", modelID, true).
		Update("is_active", false).Error
}
