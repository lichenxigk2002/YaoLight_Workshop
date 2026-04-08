package models

import (
	"time"
)

// QuotaLedgerSourceType 配额流水来源
const (
	QuotaLedgerSourcePaymentRecovery = "payment_recovery" // 支付失败补发
	QuotaLedgerSourceAdminGift      = "admin_gift"       // 管理员赠送
)

// QuotaLedger 配额流水表（补救、赠送等均记入此表）
type QuotaLedger struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"index;not null" json:"user_id"`
	Delta        int64     `gorm:"not null" json:"delta"`          // 变动量，正数为增加
	BalanceAfter int64     `gorm:"not null" json:"balance_after"`  // 变动后余额
	SourceType   string    `gorm:"type:varchar(32);index;not null" json:"source_type"` // payment_recovery | admin_gift
	SourceID     string    `gorm:"type:varchar(128);index" json:"source_id"`           // 订单号/活动ID等
	OperatorID   uint      `gorm:"index;not null" json:"operator_id"`                  // 操作人（管理员）ID
	Remark       string    `gorm:"type:varchar(512)" json:"remark"`
	CreatedAt    time.Time `json:"created_at"`
}

// TableName 指定表名
func (QuotaLedger) TableName() string {
	return "quota_ledger"
}
