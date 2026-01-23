package repositories

import (
	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/task/models"
)

// TaskRepository 任务仓储接口
type TaskRepository interface {
	// GetTasksByWorkflowID 获取工作流的所有任务
	GetTasksByWorkflowID(workflowID uint, offset, limit int) ([]models.Task, int64, error)

	// GetTaskByID 根据ID获取任务
	GetTaskByID(taskID uint) (*models.Task, error)

	// GetRunningTasksByWorkflowID 获取工作流正在运行的任务
	GetRunningTasksByWorkflowID(workflowID uint) ([]models.Task, error)

	// CreateTask 创建任务
	CreateTask(task *models.Task) error

	// UpdateTask 更新任务
	UpdateTask(task *models.Task) error
}

// taskRepository 任务仓储实现
type taskRepository struct {
	db *gorm.DB
}

// NewTaskRepository 创建任务仓储实例
func NewTaskRepository(db *gorm.DB) TaskRepository {
	return &taskRepository{db: db}
}

// GetTasksByWorkflowID 获取工作流的所有任务（分页）
func (r *taskRepository) GetTasksByWorkflowID(workflowID uint, offset, limit int) ([]models.Task, int64, error) {
	var tasks []models.Task
	var total int64

	// 查询总数
	if err := r.db.Model(&models.Task{}).
		Where("workflow_id = ?", workflowID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 查询列表（按创建时间倒序）
	if err := r.db.Where("workflow_id = ?", workflowID).
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&tasks).Error; err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

// GetTaskByID 根据ID获取任务
func (r *taskRepository) GetTaskByID(taskID uint) (*models.Task, error) {
	var task models.Task
	if err := r.db.First(&task, taskID).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

// GetRunningTasksByWorkflowID 获取工作流正在运行的任务
func (r *taskRepository) GetRunningTasksByWorkflowID(workflowID uint) ([]models.Task, error) {
	var tasks []models.Task

	// 查询状态为 pending, queued, running, paused 的任务
	err := r.db.Where("workflow_id = ? AND status IN (?)",
		workflowID,
		[]string{"pending", "queued", "running", "paused"}).
		Order("created_at DESC").
		Find(&tasks).Error

	if err != nil {
		return nil, err
	}

	return tasks, nil
}

// CreateTask 创建任务
func (r *taskRepository) CreateTask(task *models.Task) error {
	return r.db.Create(task).Error
}

// UpdateTask 更新任务
func (r *taskRepository) UpdateTask(task *models.Task) error {
	return r.db.Save(task).Error
}
