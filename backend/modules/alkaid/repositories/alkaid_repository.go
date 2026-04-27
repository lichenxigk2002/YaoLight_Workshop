package repositories

import (
	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/shared"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

// AlkaidRepository 瑶光星数据访问层
type AlkaidRepository struct {
	db *gorm.DB
}

// NewAlkaidRepository 创建瑶光星数据访问层
func NewAlkaidRepository() *AlkaidRepository {
	return &AlkaidRepository{
		db: database.DB,
	}
}

// ========== Session 相关方法 ==========

// CreateSession 创建会话
func (r *AlkaidRepository) CreateSession(session *alkaidModels.AlkaidSession) error {
	return r.db.Create(session).Error
}

// GetSessionByID 根据ID获取会话
func (r *AlkaidRepository) GetSessionByID(sessionID uint) (*alkaidModels.AlkaidSession, error) {
	var session alkaidModels.AlkaidSession
	if err := r.db.First(&session, sessionID).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// GetSessionsByUserID 获取用户的所有会话
func (r *AlkaidRepository) GetSessionsByUserID(userID uint, limit, offset int) ([]alkaidModels.AlkaidSession, int64, error) {
	var sessions []alkaidModels.AlkaidSession
	var total int64

	// 计算总数
	if err := r.db.Model(&alkaidModels.AlkaidSession{}).
		Where("user_id = ?", userID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取列表
	if err := r.db.Where("user_id = ?", userID).
		Order("updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error; err != nil {
		return nil, 0, err
	}

	return sessions, total, nil
}

// UpdateSession 更新会话
func (r *AlkaidRepository) UpdateSession(session *alkaidModels.AlkaidSession) error {
	return r.db.Save(session).Error
}

func (r *AlkaidRepository) UpdateSessionStatus(sessionID uint, status string) error {
	return r.db.Model(&alkaidModels.AlkaidSession{}).
		Where("id = ?", sessionID).
		Update("status", status).Error
}

func (r *AlkaidRepository) SavePendingWorkflow(sessionID uint, workflow interface{}) error {
	session, err := r.GetSessionByID(sessionID)
	if err != nil {
		return err
	}
	session.PendingWorkflowJSON.Data = workflow
	session.PendingPatchJSON.Data = nil
	return r.UpdateSession(session)
}

func (r *AlkaidRepository) SavePendingPatch(sessionID uint, patch interface{}) error {
	session, err := r.GetSessionByID(sessionID)
	if err != nil {
		return err
	}
	session.PendingPatchJSON.Data = patch
	session.PendingWorkflowJSON.Data = nil
	return r.UpdateSession(session)
}

func (r *AlkaidRepository) UpdateSessionPhase(sessionID uint, phase string) error {
	return r.db.Model(&alkaidModels.AlkaidSession{}).
		Where("id = ?", sessionID).
		Update("current_phase", phase).Error
}

func (r *AlkaidRepository) UpdateTaskMode(sessionID uint, mode string) error {
	return r.db.Model(&alkaidModels.AlkaidSession{}).
		Where("id = ?", sessionID).
		Update("current_task_mode", mode).Error
}

// DeleteSession 删除会话（软删除）
func (r *AlkaidRepository) DeleteSession(sessionID uint) error {
	return r.db.Delete(&alkaidModels.AlkaidSession{}, sessionID).Error
}

// ========== Message 相关方法 ==========

// CreateMessage 创建消息
func (r *AlkaidRepository) CreateMessage(message *alkaidModels.AlkaidMessage) error {
	return r.db.Create(message).Error
}

func (r *AlkaidRepository) UpdateMessage(message *alkaidModels.AlkaidMessage) error {
	return r.db.Save(message).Error
}

func (r *AlkaidRepository) UpdateMessageContent(messageID uint, content string, msgType string) error {
	updates := map[string]interface{}{
		"content": content,
	}
	if msgType != "" {
		updates["type"] = msgType
	}
	return r.db.Model(&alkaidModels.AlkaidMessage{}).
		Where("id = ?", messageID).
		Updates(updates).Error
}

func (r *AlkaidRepository) UpdateMessageRawData(messageID uint, rawData interface{}) error {
	return r.db.Model(&alkaidModels.AlkaidMessage{}).
		Where("id = ?", messageID).
		Update("raw_data", shared.JSONB{Data: rawData}).Error
}

// GetMessagesBySessionID 获取会话的所有消息
func (r *AlkaidRepository) GetMessagesBySessionID(sessionID uint, limit int) ([]alkaidModels.AlkaidMessage, error) {
	var messages []alkaidModels.AlkaidMessage
	query := r.db.Where("session_id = ?", sessionID).
		Order("created_at ASC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	if err := query.Find(&messages).Error; err != nil {
		return nil, err
	}
	return messages, nil
}

// GetLatestMessages 获取会话的最新N条消息
func (r *AlkaidRepository) GetLatestMessages(sessionID uint, limit int) ([]alkaidModels.AlkaidMessage, error) {
	var messages []alkaidModels.AlkaidMessage
	if err := r.db.Where("session_id = ?", sessionID).
		Order("created_at DESC").
		Limit(limit).
		Find(&messages).Error; err != nil {
		return nil, err
	}

	// 反转顺序，使其按时间正序
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// DeleteMessagesBySessionID 删除会话的所有消息（软删除）
func (r *AlkaidRepository) DeleteMessagesBySessionID(sessionID uint) error {
	return r.db.Where("session_id = ?", sessionID).
		Delete(&alkaidModels.AlkaidMessage{}).Error
}
