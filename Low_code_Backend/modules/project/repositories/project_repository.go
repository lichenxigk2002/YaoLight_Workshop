package repositories

import (
	"workflow-management-system/backend/domain/entity"
	"workflow-management-system/backend/domain/repository"
	"workflow-management-system/backend/modules/project/models"

	"gorm.io/gorm"
)

// projectRepository 项目仓储实现
type projectRepository struct {
	db *gorm.DB
}

// NewProjectRepository 创建项目仓储实例
func NewProjectRepository(db *gorm.DB) repository.ProjectRepository {
	return &projectRepository{db: db}
}

// toDomainEntity 将持久化实体转换为领域实体
func toDomainEntity(m *models.Project) *entity.Project {
	return &entity.Project{
		ID:          m.ID,
		UserID:      m.UserID,
		Name:        m.Name,
		Description: m.Description,
		Status:      m.Status,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

// toPersistenceEntity 将领域实体转换为持久化实体
func toPersistenceEntity(e *entity.Project) *models.Project {
	return &models.Project{
		ID:          e.ID,
		UserID:      e.UserID,
		Name:        e.Name,
		Description: e.Description,
		Status:      e.Status,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

// Create 创建项目
func (r *projectRepository) Create(project *entity.Project) error {
	model := toPersistenceEntity(project)
	if err := r.db.Create(model).Error; err != nil {
		return err
	}
	// 更新领域实体的ID和时间戳
	project.ID = model.ID
	project.CreatedAt = model.CreatedAt
	project.UpdatedAt = model.UpdatedAt
	return nil
}

// FindByID 根据ID查找项目
func (r *projectRepository) FindByID(id uint) (*entity.Project, error) {
	var model models.Project
	if err := r.db.First(&model, id).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&model), nil
}

// FindByUserID 根据用户ID查找项目列表
func (r *projectRepository) FindByUserID(userID uint, offset, limit int) ([]*entity.Project, int64, error) {
	var modelsList []models.Project
	var total int64

	// 查询总数
	if err := r.db.Model(&models.Project{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
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
	entities := make([]*entity.Project, len(modelsList))
	for i := range modelsList {
		entities[i] = toDomainEntity(&modelsList[i])
	}

	return entities, total, nil
}

// Update 更新项目
func (r *projectRepository) Update(project *entity.Project) error {
	model := toPersistenceEntity(project)
	return r.db.Save(model).Error
}

// Delete 删除项目（软删除）
func (r *projectRepository) Delete(id uint) error {
	return r.db.Delete(&models.Project{}, id).Error
}
