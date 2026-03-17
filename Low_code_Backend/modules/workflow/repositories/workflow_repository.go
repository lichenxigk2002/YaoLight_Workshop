package repositories

import (
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/modules/workflow/models"

	"gorm.io/gorm"
)

type workflowRepository struct {
	db *gorm.DB
}

func NewWorkflowRepository(db *gorm.DB) repository.WorkflowRepository {
	return &workflowRepository{db: db}
}

func toDomainEntity(m *models.Workflow) *entity.Workflow {
	return &entity.Workflow{
		ID:          m.ID,
		UserID:      m.UserID,
		ProjectID:   m.ProjectID,
		TemplateID:  m.TemplateID,
		Name:        m.Name,
		Description: m.Description,
		Status:      m.Status,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

func toPersistenceEntity(e *entity.Workflow) *models.Workflow {
	return &models.Workflow{
		ID:          e.ID,
		UserID:      e.UserID,
		ProjectID:   e.ProjectID,
		TemplateID:  e.TemplateID,
		Name:        e.Name,
		Description: e.Description,
		Status:      e.Status,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

func (r *workflowRepository) Create(workflow *entity.Workflow) error {
	model := toPersistenceEntity(workflow)
	if err := r.db.Create(model).Error; err != nil {
		return err
	}
	workflow.ID = model.ID
	workflow.CreatedAt = model.CreatedAt
	workflow.UpdatedAt = model.UpdatedAt
	return nil
}

func (r *workflowRepository) FindByID(id uint) (*entity.Workflow, error) {
	var model models.Workflow
	if err := r.db.First(&model, id).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

func (r *workflowRepository) FindByProjectID(projectID uint, offset, limit int) ([]*entity.Workflow, int64, error) {
	var modelList []models.Workflow
	var total int64

	if err := r.db.Model(&models.Workflow{}).Where("project_id = ?", projectID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.Where("project_id = ?", projectID).
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&modelList).Error; err != nil {
		return nil, 0, err
	}

	entities := make([]*entity.Workflow, len(modelList))
	for i := range modelList {
		entities[i] = toDomainEntity(&modelList[i])
	}

	return entities, total, nil
}

func (r *workflowRepository) FindByUserID(userID uint, offset, limit int) ([]*entity.Workflow, int64, error) {
	var modelList []models.Workflow
	var total int64

	if err := r.db.Model(&models.Workflow{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.Where("user_id = ?", userID).
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&modelList).Error; err != nil {
		return nil, 0, err
	}

	entities := make([]*entity.Workflow, len(modelList))
	for i := range modelList {
		entities[i] = toDomainEntity(&modelList[i])
	}

	return entities, total, nil
}

func (r *workflowRepository) Update(workflow *entity.Workflow) error {
	model := toPersistenceEntity(workflow)
	return r.db.Save(model).Error
}

func (r *workflowRepository) UpdateTemplateReference(id uint, templateID *uint) error {
	return r.db.Model(&models.Workflow{}).
		Where("id = ?", id).
		Update("template_id", templateID).Error
}

func (r *workflowRepository) Delete(id uint) error {
	return r.db.Delete(&models.Workflow{}, id).Error
}
