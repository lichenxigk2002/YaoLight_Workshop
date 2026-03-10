package repositories

import (
	"yaolight-workshop/backend/modules/artifact/models"

	"gorm.io/gorm"
)

// ArtifactRepository 制品仓储接口
type ArtifactRepository interface {
	Create(a *models.Artifact) error
	GetByID(id uint) (*models.Artifact, error)
	GetByIDAndUser(id uint, userID uint) (*models.Artifact, error)
	ListByTaskAdmin(taskID uint, page int, pageSize int) ([]models.Artifact, int64, error)
	ListByTask(userID uint, taskID uint, page int, pageSize int) ([]models.Artifact, int64, error)
	ListByWorkflow(userID uint, workflowID uint, page int, pageSize int) ([]models.Artifact, int64, error)
}

type artifactRepository struct {
	db *gorm.DB
}

func NewArtifactRepository(db *gorm.DB) ArtifactRepository {
	return &artifactRepository{db: db}
}

func (r *artifactRepository) Create(a *models.Artifact) error {
	return r.db.Create(a).Error
}

func (r *artifactRepository) GetByID(id uint) (*models.Artifact, error) {
	var a models.Artifact
	if err := r.db.First(&a, id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *artifactRepository) GetByIDAndUser(id uint, userID uint) (*models.Artifact, error) {
	var a models.Artifact
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&a).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *artifactRepository) ListByTaskAdmin(taskID uint, page int, pageSize int) ([]models.Artifact, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}

	var list []models.Artifact
	var total int64

	q := r.db.Model(&models.Artifact{}).Where("task_id = ?", taskID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *artifactRepository) ListByTask(userID uint, taskID uint, page int, pageSize int) ([]models.Artifact, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	var list []models.Artifact
	var total int64

	q := r.db.Model(&models.Artifact{}).
		Where("user_id = ? AND task_id = ?", userID, taskID)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *artifactRepository) ListByWorkflow(userID uint, workflowID uint, page int, pageSize int) ([]models.Artifact, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	var list []models.Artifact
	var total int64

	q := r.db.Model(&models.Artifact{}).
		Where("user_id = ? AND workflow_id = ?", userID, workflowID)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}

	return list, total, nil
}
