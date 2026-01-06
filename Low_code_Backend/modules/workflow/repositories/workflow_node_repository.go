package repositories

import (
	"workflow-management-system/backend/modules/workflow/models"

	"gorm.io/gorm"
)

// WorkflowNodeRepository 工作流节点仓储实现
type WorkflowNodeRepository struct {
	db *gorm.DB
}

// NewWorkflowNodeRepository 创建工作流节点仓储实例
func NewWorkflowNodeRepository(db *gorm.DB) *WorkflowNodeRepository {
	return &WorkflowNodeRepository{db: db}
}

// CreateOrUpdate 创建或更新节点
func (r *WorkflowNodeRepository) CreateOrUpdate(node *models.WorkflowNode) error {
	// 查找是否已存在相同 workflowId 和 nodeId 的节点
	var existing models.WorkflowNode
	err := r.db.Where("workflow_id = ? AND node_id = ?", node.WorkflowID, node.NodeID).First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		// 不存在，创建新节点
		return r.db.Create(node).Error
	} else if err != nil {
		return err
	}

	// 存在，更新
	node.ID = existing.ID
	return r.db.Save(node).Error
}

// BatchCreateOrUpdate 批量创建或更新节点
func (r *WorkflowNodeRepository) BatchCreateOrUpdate(nodes []*models.WorkflowNode) error {
	for _, node := range nodes {
		if err := r.CreateOrUpdate(node); err != nil {
			return err
		}
	}
	return nil
}

// FindByWorkflowID 根据工作流ID查找所有节点
func (r *WorkflowNodeRepository) FindByWorkflowID(workflowID uint) ([]*models.WorkflowNode, error) {
	var nodes []*models.WorkflowNode
	err := r.db.Where("workflow_id = ?", workflowID).Order("sort_order ASC, created_at ASC").Find(&nodes).Error
	return nodes, err
}

// DeleteByWorkflowID 删除工作流的所有节点
func (r *WorkflowNodeRepository) DeleteByWorkflowID(workflowID uint) error {
	return r.db.Where("workflow_id = ?", workflowID).Delete(&models.WorkflowNode{}).Error
}

// DeleteByWorkflowIDAndNodeIDs 删除指定节点（保留列表中的节点）
func (r *WorkflowNodeRepository) DeleteByWorkflowIDAndNodeIDs(workflowID uint, keepNodeIDs []string) error {
	if len(keepNodeIDs) == 0 {
		// 如果没有要保留的节点，删除所有节点
		return r.DeleteByWorkflowID(workflowID)
	}
	return r.db.Where("workflow_id = ? AND node_id NOT IN ?", workflowID, keepNodeIDs).Delete(&models.WorkflowNode{}).Error
}
