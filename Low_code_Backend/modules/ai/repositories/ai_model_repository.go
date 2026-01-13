package repositories

import (
	"time"

	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/modules/ai/models"

	"gorm.io/gorm"
)

// aiModelRepository AI模型仓储实现
type aiModelRepository struct {
	db *gorm.DB
}

// NewAIModelRepository 创建AI模型仓储实例
func NewAIModelRepository(db *gorm.DB) repository.AIModelRepository {
	return &aiModelRepository{db: db}
}

// toDomainEntity 将持久化实体转换为领域实体
func toDomainEntity(m *models.AIModel) *entity.AIModel {
	return &entity.AIModel{
		ID:               m.ID,
		Name:             m.Name,
		Provider:         m.Provider,
		ModelName:        m.ModelName,
		APIKeyEncrypted:  m.APIKeyEncrypted,
		Endpoint:         m.Endpoint,
		BaseURL:          m.BaseURL,
		Params:           m.Params,
		Status:           m.Status,
		MaxTokens:        m.MaxTokens,
		Temperature:      m.Temperature,
		TopP:             m.TopP,
		FrequencyPenalty: m.FrequencyPenalty,
		PresencePenalty:  m.PresencePenalty,
		StopSequences:    m.StopSequences,
		SystemPrompt:     m.SystemPrompt,
		PromptTemplate:   m.PromptTemplate,
		RateLimit:        m.RateLimit,
		CostPerToken:     m.CostPerToken,
		UsageCount:       m.UsageCount,
		TotalTokens:      m.TotalTokens,
		TotalCost:        m.TotalCost,
		LastUsedAt:       m.LastUsedAt,
		ErrorCount:       m.ErrorCount,
		AvgResponseTime:  m.AvgResponseTime,
		CreatedBy:        m.CreatedBy,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}

// toPersistenceEntity 将领域实体转换为持久化实体
func toPersistenceEntity(e *entity.AIModel) *models.AIModel {
	return &models.AIModel{
		ID:               e.ID,
		Name:             e.Name,
		Provider:         e.Provider,
		ModelName:        e.ModelName,
		APIKeyEncrypted:  e.APIKeyEncrypted,
		Endpoint:         e.Endpoint,
		BaseURL:          e.BaseURL,
		Params:           e.Params,
		Status:           e.Status,
		MaxTokens:        e.MaxTokens,
		Temperature:      e.Temperature,
		TopP:             e.TopP,
		FrequencyPenalty: e.FrequencyPenalty,
		PresencePenalty:  e.PresencePenalty,
		StopSequences:    e.StopSequences,
		SystemPrompt:     e.SystemPrompt,
		PromptTemplate:   e.PromptTemplate,
		RateLimit:        e.RateLimit,
		CostPerToken:     e.CostPerToken,
		UsageCount:       e.UsageCount,
		TotalTokens:      e.TotalTokens,
		TotalCost:        e.TotalCost,
		LastUsedAt:       e.LastUsedAt,
		ErrorCount:       e.ErrorCount,
		AvgResponseTime:  e.AvgResponseTime,
		CreatedBy:        e.CreatedBy,
		CreatedAt:        e.CreatedAt,
		UpdatedAt:        e.UpdatedAt,
	}
}

// Create 创建AI模型配置
func (r *aiModelRepository) Create(model *entity.AIModel) error {
	m := toPersistenceEntity(model)
	if err := r.db.Create(m).Error; err != nil {
		return err
	}
	// 更新领域实体的ID和时间戳
	model.ID = m.ID
	model.CreatedAt = m.CreatedAt
	model.UpdatedAt = m.UpdatedAt
	return nil
}

// FindByID 根据ID查找模型
func (r *aiModelRepository) FindByID(id uint) (*entity.AIModel, error) {
	var m models.AIModel
	if err := r.db.First(&m, id).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&m), nil
}

// FindByIDAndUser 根据ID和用户ID查找模型（验证归属）
func (r *aiModelRepository) FindByIDAndUser(id uint, userID uint) (*entity.AIModel, error) {
	var m models.AIModel
	if err := r.db.Where("id = ? AND created_by = ?", id, userID).First(&m).Error; err != nil {
		return nil, err
	}
	return toDomainEntity(&m), nil
}

// FindByUserID 根据用户ID查找模型列表
func (r *aiModelRepository) FindByUserID(userID uint, offset, limit int) ([]*entity.AIModel, int64, error) {
	var modelList []models.AIModel
	var total int64

	// 统计总数
	if err := r.db.Model(&models.AIModel{}).Where("created_by = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 查询列表
	if err := r.db.Where("created_by = ?", userID).
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&modelList).Error; err != nil {
		return nil, 0, err
	}

	// 转换为领域实体
	entities := make([]*entity.AIModel, len(modelList))
	for i := range modelList {
		entities[i] = toDomainEntity(&modelList[i])
	}

	return entities, total, nil
}

// Update 更新模型配置
func (r *aiModelRepository) Update(model *entity.AIModel) error {
	m := toPersistenceEntity(model)
	return r.db.Save(m).Error
}

// Delete 删除模型配置（软删除）
func (r *aiModelRepository) Delete(id uint) error {
	return r.db.Delete(&models.AIModel{}, id).Error
}

// UpdateUsage 更新模型使用统计
func (r *aiModelRepository) UpdateUsage(id uint, tokens int64, cost float64) error {
	// 先查询当前值
	var m models.AIModel
	if err := r.db.First(&m, id).Error; err != nil {
		return err
	}

	// 更新统计
	m.UsageCount++
	m.TotalTokens += tokens
	if m.TotalCost == nil {
		m.TotalCost = new(float64)
	}
	*m.TotalCost += cost
	now := time.Now()
	m.LastUsedAt = &now

	return r.db.Save(&m).Error
}
