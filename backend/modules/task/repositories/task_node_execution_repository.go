package repositories

import (
	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/task/models"
)

// TaskNodeExecutionRepository 任务节点执行仓储接口
type TaskNodeExecutionRepository interface {
	// GetByTaskID 获取任务的所有节点执行记录
	GetByTaskID(taskID uint) ([]models.TaskNodeExecution, error)

	// GetByTaskIDAndNodeID 获取特定节点的执行记录
	GetByTaskIDAndNodeID(taskID uint, nodeID string) (*models.TaskNodeExecution, error)

	// Create 创建节点执行记录
	Create(execution *models.TaskNodeExecution) error

	// Update 更新节点执行记录
	Update(execution *models.TaskNodeExecution) error
}

// taskNodeExecutionRepository 任务节点执行仓储实现
type taskNodeExecutionRepository struct {
	db *gorm.DB
}

// NewTaskNodeExecutionRepository 创建任务节点执行仓储实例
func NewTaskNodeExecutionRepository(db *gorm.DB) TaskNodeExecutionRepository {
	return &taskNodeExecutionRepository{db: db}
}

// GetByTaskID 获取任务的所有节点执行记录（按开始时间排序）
func (r *taskNodeExecutionRepository) GetByTaskID(taskID uint) ([]models.TaskNodeExecution, error) {
	var executions []models.TaskNodeExecution

	err := r.db.Where("task_id = ?", taskID).
		Order("started_at ASC").
		Find(&executions).Error

	if err != nil {
		return nil, err
	}

	return executions, nil
}

// GetByTaskIDAndNodeID 获取特定节点的执行记录
func (r *taskNodeExecutionRepository) GetByTaskIDAndNodeID(taskID uint, nodeID string) (*models.TaskNodeExecution, error) {
	var execution models.TaskNodeExecution

	err := r.db.Where("task_id = ? AND node_id = ?", taskID, nodeID).
		First(&execution).Error

	if err != nil {
		return nil, err
	}

	return &execution, nil
}

// Create 创建节点执行记录
func (r *taskNodeExecutionRepository) Create(execution *models.TaskNodeExecution) error {
	return r.db.Create(execution).Error
}

// Update 更新节点执行记录
func (r *taskNodeExecutionRepository) Update(execution *models.TaskNodeExecution) error {
	return r.db.Save(execution).Error
}
