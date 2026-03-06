package services

import (
	"fmt"
	"log"

	"gorm.io/gorm"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/database"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
	userModels "yaolight-workshop/backend/modules/user/models"
	userRepos "yaolight-workshop/backend/modules/user/repositories"
)

// TransactionService 交易服务，负责统一的Token扣费和流水记录
type TransactionService struct {
	userRepo       repository.UserRepository
	pricingService *aiService.PricingService
}

// NewTransactionService 创建交易服务
func NewTransactionService() *TransactionService {
	pricingRepo := aiRepos.NewPricingConfigRepository(database.DB)
	return &TransactionService{
		userRepo:       userRepos.NewUserRepository(database.DB),
		pricingService: aiService.NewPricingService(pricingRepo),
	}
}

// RecordTokenUsageRequest 记录Token使用请求
type RecordTokenUsageRequest struct {
	UserID    uint
	Usage     *providers.TokenUsage
	Provider  string
	ModelName string
	ModelMode string // "system", "saved", "custom"
	ModelID   *uint
	RelatedID string // 关联ID，如节点ID或会话ID
	Type      string // "consumption", "usage_record", "chat"
	Desc      string // 描述
}

// RecordTokenUsage 记录Token使用并扣费（如果是system模式）
func (s *TransactionService) RecordTokenUsage(req RecordTokenUsageRequest) error {
	if req.Usage == nil {
		return fmt.Errorf("usage info is nil")
	}

	// 提取扩展Token信息
	var cacheRead, cacheWrite, audio int
	if req.Usage.CacheReadTokens != nil {
		cacheRead = *req.Usage.CacheReadTokens
	}
	if req.Usage.CacheWriteTokens != nil {
		cacheWrite = *req.Usage.CacheWriteTokens
	}
	if req.Usage.AudioTokens != nil {
		audio = *req.Usage.AudioTokens
	}

	// 只有system模式需要扣费和扣除token余额
	if req.ModelMode == "system" {
		log.Printf("[Transaction] Processing system model billing: userID=%d, provider=%s, totalTokens=%d",
			req.UserID, req.Provider, req.Usage.TotalTokens)

		// 使用 PricingService 计算等效Token数（星尘消耗）
		equivalentTokens, err := s.pricingService.CalculateEquivalentTokens(req.Usage, req.Provider, req.ModelName)
		if err != nil {
			log.Printf("[Transaction] Failed to calculate equivalent tokens: %v, using actual tokens", err)
			equivalentTokens = int64(req.Usage.TotalTokens) // 计算失败时使用实际Token数
		}

		// 计算费用（仅用于记录）
		cost, err := s.pricingService.CalculateCost(req.Usage, req.Provider, req.ModelName)
		if err != nil {
			log.Printf("[Transaction] Failed to calculate cost: %v", err)
			cost = 0
		}
		currency := s.pricingService.GetCurrency(req.Provider, req.ModelName)

		transaction := userModels.TokenTransaction{
			UserID:           req.UserID,
			Amount:           -equivalentTokens,
			Type:             req.Type,
			RelatedID:        req.RelatedID,
			Description:      req.Desc,
			Provider:         req.Provider,
			ModelName:        req.ModelName,
			ModelMode:        req.ModelMode,
			ModelID:          req.ModelID,
			PromptTokens:     req.Usage.PromptTokens,
			CompletionTokens: req.Usage.CompletionTokens,
			TotalTokens:      req.Usage.TotalTokens,
			CacheReadTokens:  cacheRead,
			CacheWriteTokens: cacheWrite,
			AudioTokens:      audio,
			Cost:             cost,
			Currency:         currency,
		}

		if err := database.DB.Transaction(func(tx *gorm.DB) error {
			if err := s.userRepo.DeductTokensWithDB(tx, req.UserID, equivalentTokens); err != nil {
				return err
			}
			return tx.Create(&transaction).Error
		}); err != nil {
			log.Printf("[Transaction] Token deduction/transaction failed for user %d: %v", req.UserID, err)
			return err
		} else {
			log.Printf("[Transaction] Deducted %d stardust for user %d, provider: %s, model: %s",
				equivalentTokens, req.UserID, req.Provider, req.ModelName)
		}
	} else {
		// saved或custom模式：使用用户自己的API Key，只记录使用量，不扣费不扣token
		log.Printf("[Transaction] Recording usage (no billing): userID=%d, mode=%s, provider=%s",
			req.UserID, req.ModelMode, req.Provider)

		transaction := userModels.TokenTransaction{
			UserID:           req.UserID,
			Amount:           0, // 不扣除token余额
			Type:             "usage_record",
			RelatedID:        req.RelatedID,
			Description:      req.Desc,
			Provider:         req.Provider,
			ModelName:        req.ModelName,
			ModelMode:        req.ModelMode,
			ModelID:          req.ModelID,
			PromptTokens:     req.Usage.PromptTokens,
			CompletionTokens: req.Usage.CompletionTokens,
			TotalTokens:      req.Usage.TotalTokens,
			CacheReadTokens:  cacheRead,
			CacheWriteTokens: cacheWrite,
			AudioTokens:      audio,
			Cost:             0, // 不产生费用
			Currency:         "USD",
		}

		if err := database.DB.Create(&transaction).Error; err != nil {
			log.Printf("[Transaction] Create usage record failed for user %d: %v", req.UserID, err)
			return err
		}
	}

	return nil
}
