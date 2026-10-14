package repositories

import (
	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/task/models"
)

// TaskLogRepository 任务日志仓储接口
type TaskLogRepository interface {
	// GetByTaskID 获取任务的所有日志
	GetByTaskID(taskID uint, offset, limit int) ([]models.TaskLog, int64, error)

	// GetByTaskIDAndLevel 根据日志级别过滤
	GetByTaskIDAndLevel(taskID uint, level string, offset, limit int) ([]models.TaskLog, int64, error)

	// Create 创建日志
	Create(log *models.TaskLog) error

	// BatchCreate 批量创建日志
	BatchCreate(logs []models.TaskLog) error
}

// taskLogRepository 任务日志仓储实现
type taskLogRepository struct {
	db *gorm.DB
}

// NewTaskLogRepository 创建任务日志仓储实例
func NewTaskLogRepository(db *gorm.DB) TaskLogRepository {
	return &taskLogRepository{db: db}
}

// GetByTaskID 获取任务的所有日志（按时间正序）
func (r *taskLogRepository) GetByTaskID(taskID uint, offset, limit int) ([]models.TaskLog, int64, error) {
	var logs []models.TaskLog
	var total int64

	// 查询总数
	if err := r.db.Model(&models.TaskLog{}).
		Where("task_id = ?", taskID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 查询列表
	query := r.db.Where("task_id = ?", taskID).
		Order("created_at ASC")

	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}

	if err := query.Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// GetByTaskIDAndLevel 根据日志级别过滤
func (r *taskLogRepository) GetByTaskIDAndLevel(taskID uint, level string, offset, limit int) ([]models.TaskLog, int64, error) {
	var logs []models.TaskLog
	var total int64

	// 查询总数
	if err := r.db.Model(&models.TaskLog{}).
		Where("task_id = ? AND level = ?", taskID, level).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 查询列表
	query := r.db.Where("task_id = ? AND level = ?", taskID, level).
		Order("created_at ASC")

	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}

	if err := query.Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// Create 创建日志
func (r *taskLogRepository) Create(log *models.TaskLog) error {
	return r.db.Create(log).Error
}

// BatchCreate 批量创建日志
func (r *taskLogRepository) BatchCreate(logs []models.TaskLog) error {
	if len(logs) == 0 {
		return nil
	}
	return r.db.Create(&logs).Error
}
