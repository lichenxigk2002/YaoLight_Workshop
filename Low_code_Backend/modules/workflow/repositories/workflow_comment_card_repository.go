package repositories

import (
	"yaolight-workshop/backend/modules/workflow/models"

	"gorm.io/gorm"
)

// WorkflowCommentCardRepository 工作流注释卡片仓储实现
type WorkflowCommentCardRepository struct {
	db *gorm.DB
}

// NewWorkflowCommentCardRepository 创建工作流注释卡片仓储实例
func NewWorkflowCommentCardRepository(db *gorm.DB) *WorkflowCommentCardRepository {
	return &WorkflowCommentCardRepository{db: db}
}

// CreateOrUpdate 创建或更新注释卡片
func (r *WorkflowCommentCardRepository) CreateOrUpdate(card *models.WorkflowCommentCard) error {
	// 查找是否已存在相同 workflowId 和 cardId 的卡片
	var existing models.WorkflowCommentCard
	err := r.db.Where("workflow_id = ? AND card_id = ?", card.WorkflowID, card.CardID).First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		// 不存在，创建新卡片
		return r.db.Create(card).Error
	} else if err != nil {
		return err
	}

	// 存在，更新
	card.ID = existing.ID
	return r.db.Save(card).Error
}

// BatchCreateOrUpdate 批量创建或更新注释卡片
func (r *WorkflowCommentCardRepository) BatchCreateOrUpdate(cards []*models.WorkflowCommentCard) error {
	for _, card := range cards {
		if err := r.CreateOrUpdate(card); err != nil {
			return err
		}
	}
	return nil
}

// FindByWorkflowID 根据工作流ID查找所有注释卡片
func (r *WorkflowCommentCardRepository) FindByWorkflowID(workflowID uint) ([]*models.WorkflowCommentCard, error) {
	var cards []*models.WorkflowCommentCard
	err := r.db.Where("workflow_id = ?", workflowID).Order("created_at ASC").Find(&cards).Error
	return cards, err
}

// DeleteByWorkflowID 删除工作流的所有注释卡片
func (r *WorkflowCommentCardRepository) DeleteByWorkflowID(workflowID uint) error {
	return r.db.Where("workflow_id = ?", workflowID).Delete(&models.WorkflowCommentCard{}).Error
}

// DeleteByWorkflowIDAndCardIDs 删除指定注释卡片（保留列表中的卡片）
func (r *WorkflowCommentCardRepository) DeleteByWorkflowIDAndCardIDs(workflowID uint, keepCardIDs []string) error {
	if len(keepCardIDs) == 0 {
		// 如果没有要保留的卡片，删除所有卡片
		return r.DeleteByWorkflowID(workflowID)
	}
	return r.db.Where("workflow_id = ? AND card_id NOT IN ?", workflowID, keepCardIDs).Delete(&models.WorkflowCommentCard{}).Error
}
