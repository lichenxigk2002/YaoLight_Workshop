package services

import (
	"fmt"

	"gorm.io/gorm"

	billingModels "yaolight-workshop/backend/modules/billing/models"
	"yaolight-workshop/backend/modules/billing/repositories"
	"yaolight-workshop/backend/modules/notification"
	userModels "yaolight-workshop/backend/modules/user/models"
)

const (
	quotaRecoveryNotificationType  = "quota_recovery"
	quotaAdminGiftNotificationType = "admin_gift"
	quotaTransactionsActionURL     = "/settings/token-transactions"
)

// QuotaService handles admin quota recovery, grants, and ledger queries.
type QuotaService struct {
	db         *gorm.DB
	ledgerRepo *repositories.QuotaLedgerRepository
}

func NewQuotaService(db *gorm.DB) *QuotaService {
	return &QuotaService{
		db:         db,
		ledgerRepo: repositories.NewQuotaLedgerRepository(db),
	}
}

type RecoverQuotaRequest struct {
	OrderID    string `json:"order_id" binding:"required"`
	UserID     uint   `json:"user_id" binding:"required"`
	QuotaDelta int64  `json:"quota_delta" binding:"required,min=1"`
	Reason     string `json:"reason" binding:"required"`
}

type GrantQuotaRequest struct {
	UserID     uint   `json:"user_id" binding:"required"`
	QuotaDelta int64  `json:"quota_delta" binding:"required,min=1"`
	Remark     string `json:"remark" binding:"required"`
	CampaignID string `json:"campaign_id"`
}

// RecoverQuota increases balance, writes admin ledger, and syncs user transaction history.
func (s *QuotaService) RecoverQuota(req *RecoverQuotaRequest, operatorID uint) (*billingModels.QuotaLedger, error) {
	var user userModels.User
	if err := s.db.Where("id = ?", req.UserID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found: %d", req.UserID)
		}
		return nil, err
	}

	var (
		newBalance int64
		entry      *billingModels.QuotaLedger
	)

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
			SourceType:   billingModels.QuotaLedgerSourcePaymentRecovery,
			SourceID:     req.OrderID,
			OperatorID:   operatorID,
			Remark:       req.Reason,
		}
		if err := tx.Create(entry).Error; err != nil {
			return err
		}

		return tx.Create(buildQuotaTokenTransaction(
			req.UserID,
			req.QuotaDelta,
			billingModels.QuotaLedgerSourcePaymentRecovery,
			resolveQuotaTransactionRelatedID(req.OrderID, entry.ID),
			fmt.Sprintf("支付失败补发配额（订单 %s）", req.OrderID),
		)).Error
	})
	if err != nil {
		return nil, err
	}

	notification.Notify(
		req.UserID,
		quotaRecoveryNotificationType,
		"补发配额已到账",
		fmt.Sprintf("已为你补发 %d 星尘。订单：%s。原因：%s。", req.QuotaDelta, req.OrderID, req.Reason),
		quotaTransactionsActionURL,
	)

	return entry, nil
}

// GrantQuota increases balance, writes admin ledger, and syncs user transaction history.
func (s *QuotaService) GrantQuota(req *GrantQuotaRequest, operatorID uint) (*billingModels.QuotaLedger, error) {
	var user userModels.User
	if err := s.db.Where("id = ?", req.UserID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found: %d", req.UserID)
		}
		return nil, err
	}

	var (
		newBalance int64
		entry      *billingModels.QuotaLedger
	)

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
		if err := tx.Create(entry).Error; err != nil {
			return err
		}

		return tx.Create(buildQuotaTokenTransaction(
			req.UserID,
			req.QuotaDelta,
			billingModels.QuotaLedgerSourceAdminGift,
			resolveQuotaTransactionRelatedID(req.CampaignID, entry.ID),
			buildAdminGiftDescription(req.QuotaDelta, req.CampaignID, req.Remark),
		)).Error
	})
	if err != nil {
		return nil, err
	}

	notification.Notify(
		req.UserID,
		quotaAdminGiftNotificationType,
		"管理员赠送配额已到账",
		buildAdminGiftNotificationContent(req.QuotaDelta, req.CampaignID, req.Remark),
		quotaTransactionsActionURL,
	)

	return entry, nil
}

type QuotaSummary struct {
	RecoveryCount int64 `json:"recovery_count"`
	GiftCount     int64 `json:"gift_count"`
	TotalCount    int64 `json:"total_count"`
	UserCount     int64 `json:"user_count"`
}

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

type ListLedgerParams struct {
	Page       int
	PageSize   int
	UserID     *uint
	SourceType string
	StartDate  string
	EndDate    string
}

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

func buildQuotaTokenTransaction(userID uint, amount int64, typ, relatedID, description string) *userModels.TokenTransaction {
	return &userModels.TokenTransaction{
		UserID:      userID,
		Amount:      amount,
		Type:        typ,
		RelatedID:   relatedID,
		Description: description,
		TotalTokens: int(amount),
		Cost:        0,
		Currency:    "CNY",
	}
}

func resolveQuotaTransactionRelatedID(sourceID string, ledgerID uint) string {
	if sourceID != "" {
		return sourceID
	}
	return fmt.Sprintf("quota_ledger_%d", ledgerID)
}

func buildAdminGiftDescription(amount int64, campaignID, remark string) string {
	if campaignID != "" {
		return fmt.Sprintf("管理员赠送配额 %d（活动 %s）- %s", amount, campaignID, remark)
	}
	return fmt.Sprintf("管理员赠送配额 %d - %s", amount, remark)
}

func buildAdminGiftNotificationContent(amount int64, campaignID, remark string) string {
	if campaignID != "" {
		return fmt.Sprintf("管理员已为你赠送 %d 星尘。活动：%s。备注：%s。", amount, campaignID, remark)
	}
	return fmt.Sprintf("管理员已为你赠送 %d 星尘。备注：%s。", amount, remark)
}
