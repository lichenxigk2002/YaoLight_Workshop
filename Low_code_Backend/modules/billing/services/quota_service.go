package services

import (
	"fmt"

	"gorm.io/gorm"
	billingModels "yaolight-workshop/backend/modules/billing/models"
	"yaolight-workshop/backend/modules/billing/repositories"
	userModels "yaolight-workshop/backend/modules/user/models"
)

// QuotaService 配额服务：补救、赠送、流水
type QuotaService struct {
	db       *gorm.DB
	ledgerRepo *repositories.QuotaLedgerRepository
}

// NewQuotaService 创建服务
func NewQuotaService(db *gorm.DB) *QuotaService {
	return &QuotaService{
		db:         db,
		ledgerRepo: repositories.NewQuotaLedgerRepository(db),
	}
}

// RecoverQuotaRequest 补救配额请求（支付失败补发）
type RecoverQuotaRequest struct {
	OrderID    string `json:"order_id" binding:"required"`
	UserID     uint   `json:"user_id" binding:"required"` // 前端可能传字符串，需在 controller 转 uint
	QuotaDelta int64  `json:"quota_delta" binding:"required,min=1"`
	Reason     string `json:"reason" binding:"required"`
}

// GrantQuotaRequest 管理员赠送请求
type GrantQuotaRequest struct {
	UserID     uint   `json:"user_id" binding:"required"`
	QuotaDelta int64  `json:"quota_delta" binding:"required,min=1"`
	Remark     string `json:"remark" binding:"required"`
	CampaignID string `json:"campaign_id"`
}

// RecoverQuota 支付失败补发：增加用户余额并写流水（source_type=payment_recovery）
func (s *QuotaService) RecoverQuota(req *RecoverQuotaRequest, operatorID uint) (*billingModels.QuotaLedger, error) {
	var user userModels.User
	if err := s.db.Where("id = ?", req.UserID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("用户不存在: %d", req.UserID)
		}
		return nil, err
	}

	var newBalance int64
	var entry *billingModels.QuotaLedger
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 增加余额
		newBalance = user.TokenBalance + req.QuotaDelta
		if err := tx.Model(&userModels.User{}).Where("id = ?", req.UserID).
			Update("token_balance", newBalance).Error; err != nil {
			return err
		}
		entry = &billingModels.QuotaLedger{
			UserID:       req.UserID,
			Delta:        req.QuotaDelta,
			BalanceAfter: newBalance,
			SourceType:   billingModels.QuotaLedgerSourcePaymentRecovery,
			SourceID:     req.OrderID,
			OperatorID:   operatorID,
			Remark:       req.Reason,
		}
		return tx.Create(entry).Error
	})
	if err != nil {
		return nil, err
	}
	return entry, nil
}

// GrantQuota 管理员赠送：增加用户余额并写流水（source_type=admin_gift）
func (s *QuotaService) GrantQuota(req *GrantQuotaRequest, operatorID uint) (*billingModels.QuotaLedger, error) {
	var user userModels.User
	if err := s.db.Where("id = ?", req.UserID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("用户不存在: %d", req.UserID)
		}
		return nil, err
	}

	var newBalance int64
	var entry *billingModels.QuotaLedger
	err := s.db.Transaction(func(tx *gorm.DB) error {
		newBalance = user.TokenBalance + req.QuotaDelta
		if err := tx.Model(&userModels.User{}).Where("id = ?", req.UserID).
			Update("token_balance", newBalance).Error; err != nil {
			return err
		}
		entry = &billingModels.QuotaLedger{
			UserID:       req.UserID,
			Delta:        req.QuotaDelta,
			BalanceAfter: newBalance,
			SourceType:   billingModels.QuotaLedgerSourceAdminGift,
			SourceID:     req.CampaignID,
			OperatorID:   operatorID,
			Remark:       req.Remark,
		}
		return tx.Create(entry).Error
	})
	if err != nil {
		return nil, err
	}
	return entry, nil
}

// QuotaSummary 配额流水统计汇总
type QuotaSummary struct {
	RecoveryCount int64 `json:"recovery_count"` // 补救笔数（payment_recovery）
	GiftCount     int64 `json:"gift_count"`     // 赠送笔数（admin_gift）
	TotalCount    int64 `json:"total_count"`    // 流水总条数
	UserCount     int64 `json:"user_count"`     // 涉及的去重用户数
}

// GetSummary 统计补救/赠送笔数、流水总数与涉及用户数
func (s *QuotaService) GetSummary() (*QuotaSummary, error) {
	var result QuotaSummary

	if err := s.db.Model(&billingModels.QuotaLedger{}).
		Where("source_type = ?", billingModels.QuotaLedgerSourcePaymentRecovery).
		Count(&result.RecoveryCount).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&billingModels.QuotaLedger{}).
		Where("source_type = ?", billingModels.QuotaLedgerSourceAdminGift).
		Count(&result.GiftCount).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&billingModels.QuotaLedger{}).Count(&result.TotalCount).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&billingModels.QuotaLedger{}).
		Select("COUNT(DISTINCT user_id)").
		Scan(&result.UserCount).Error; err != nil {
		return nil, err
	}

	return &result, nil
}

// ListLedgerParams 流水列表参数
type ListLedgerParams struct {
	Page       int
	PageSize   int
	UserID     *uint
	SourceType string
	StartDate  string
	EndDate    string
}

// ListLedger 分页查询流水
func (s *QuotaService) ListLedger(p ListLedgerParams) ([]billingModels.QuotaLedger, int64, error) {
	return s.ledgerRepo.List(repositories.ListParams{
		Page:       p.Page,
		PageSize:   p.PageSize,
		UserID:     p.UserID,
		SourceType: p.SourceType,
		StartDate:  p.StartDate,
		EndDate:    p.EndDate,
	})
}
