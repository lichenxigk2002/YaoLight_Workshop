package repositories

import (
	"gorm.io/gorm"
	aiModels "yaolight-workshop/backend/modules/ai/models"
)

type ManagedAIModelRepository interface {
	FindAll() ([]aiModels.ManagedAIModel, error)
	FindByID(id uint) (*aiModels.ManagedAIModel, error)
	FindByProvider(provider string) ([]aiModels.ManagedAIModel, error)
	FindByProviderAndModel(provider, modelName string) (*aiModels.ManagedAIModel, error)
	Create(model *aiModels.ManagedAIModel) error
	Update(model *aiModels.ManagedAIModel) error
	Delete(id uint) error
	CreateOrUpdate(model *aiModels.ManagedAIModel) error
}

type managedAIModelRepository struct {
	db *gorm.DB
}

func NewManagedAIModelRepository(db *gorm.DB) ManagedAIModelRepository {
	return &managedAIModelRepository{db: db}
}

func (r *managedAIModelRepository) FindAll() ([]aiModels.ManagedAIModel, error) {
	var list []aiModels.ManagedAIModel
	err := r.db.Order("sort_order ASC, provider ASC, model_name ASC").
		Find(&list).Error
	return list, err
}

func (r *managedAIModelRepository) FindByID(id uint) (*aiModels.ManagedAIModel, error) {
	var model aiModels.ManagedAIModel
	if err := r.db.First(&model, id).Error; err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *managedAIModelRepository) FindByProvider(provider string) ([]aiModels.ManagedAIModel, error) {
	var list []aiModels.ManagedAIModel
	err := r.db.Where("provider = ?", provider).
		Order("sort_order ASC, model_name ASC").
		Find(&list).Error
	return list, err
}

func (r *managedAIModelRepository) FindByProviderAndModel(provider, modelName string) (*aiModels.ManagedAIModel, error) {
	var model aiModels.ManagedAIModel
	err := r.db.Where("provider = ? AND model_name = ?", provider, modelName).First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *managedAIModelRepository) Create(model *aiModels.ManagedAIModel) error {
	return r.db.Create(model).Error
}

func (r *managedAIModelRepository) Update(model *aiModels.ManagedAIModel) error {
	return r.db.Save(model).Error
}

func (r *managedAIModelRepository) Delete(id uint) error {
	return r.db.Delete(&aiModels.ManagedAIModel{}, id).Error
}

func (r *managedAIModelRepository) CreateOrUpdate(model *aiModels.ManagedAIModel) error {
	var existing aiModels.ManagedAIModel
	err := r.db.Where("provider = ? AND model_name = ?", model.Provider, model.ModelName).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.Create(model).Error
	}
	if err != nil {
		return err
	}
	model.ID = existing.ID
	return r.db.Model(&existing).Updates(model).Error
}
