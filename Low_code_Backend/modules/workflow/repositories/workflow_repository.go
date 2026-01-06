package repositories

import (
	"workflow-management-system/backend/domain/entity"
	"workflow-management-system/backend/domain/repository"
	"workflow-management-system/backend/modules/workflow/models"

	"gorm.io/gorm"
)

// workflowRepository 工作流仓储实现
type workflowRepository struct {
	db *gorm.DB
}

// NewWorkflowRepository 创建工作流仓储实例
func NewWorkflowRepository(db *gorm.DB) repository.WorkflowRepository {
	return &workflowRepository{db: db}
}

// toDomainEntity 将持久化实体转换为领域实体
func toDomainEntity(m *models.Workflow) *entity.Workflow {
	return &entity.Workflow{
		ID:          m.ID,
		UserID:      m.UserID,
		ProjectID:   m.ProjectID,
		Name:        m.Name,
		Description: m.Description,
		Status:      m.Status,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

// toPersistenceEntity 将领域实体转换为持久化实体
func toPersistenceEntity(e *entity.Workflow) *models.Workflow {
	return &models.Workflow{
		ID:          e.ID,
		UserID:      e.UserID,
		ProjectID:   e.ProjectID,
		Name:        e.Name,
		Description: e.Description,
		Status:      e.Status,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

// Create 创建工作流
func (r *workflowRepository) Create(workflow *entity.Workflow) error {
	model := toPersistenceEntity(workflow)
	if err := r.db.Create(model).Error; err != nil {
		return err
	}
	// 更新领域实体的ID和时间戳
	workflow.ID = model.ID
	workflow.CreatedAt = model.CreatedAt
	workflow.UpdatedAt = model.UpdatedAt
	return nil
}

// FindByID 根据ID查找工作流
func (r *workflowRepository) FindByID(id uint) (*entity.Workflow, error) {
	var model models.Workflow
	if err := r.db.First(&model, id).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

// FindByProjectID 根据项目ID查找工作流列表
func (r *workflowRepository) FindByProjectID(projectID uint, offset, limit int) ([]*entity.Workflow, int64, error) {
	var modelsList []models.Workflow
	var total int64

	// 查询总数
	if err := r.db.Model(&models.Workflow{}).Where("project_id = ?", projectID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 查询列表
	if err := r.db.Where("project_id = ?", projectID).
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&modelsList).Error; err != nil {
		return nil, 0, err
	}

	// 转换为领域实体
	entities := make([]*entity.Workflow, len(modelsList))
	for i := range modelsList {
		entities[i] = toDomainEntity(&modelsList[i])
	}

	return entities, total, nil
}

// FindByUserID 根据用户ID查找工作流列表
func (r *workflowRepository) FindByUserID(userID uint, offset, limit int) ([]*entity.Workflow, int64, error) {
	var modelsList []models.Workflow
	var total int64

	// 查询总数
	if err := r.db.Model(&models.Workflow{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 查询列表
	if err := r.db.Where("user_id = ?", userID).
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&modelsList).Error; err != nil {
		return nil, 0, err
	}

	// 转换为领域实体
	entities := make([]*entity.Workflow, len(modelsList))
	for i := range modelsList {
		entities[i] = toDomainEntity(&modelsList[i])
	}

	return entities, total, nil
}

// Update 更新工作流
func (r *workflowRepository) Update(workflow *entity.Workflow) error {
	model := toPersistenceEntity(workflow)
	return r.db.Save(model).Error
}

// Delete 删除工作流（软删除）
func (r *workflowRepository) Delete(id uint) error {
	return r.db.Delete(&models.Workflow{}, id).Error
}
