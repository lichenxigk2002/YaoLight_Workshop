package models

import (
	"time"

	"gorm.io/gorm"
)

// OrderStatus 订单状态
type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"   // 待支付
	OrderStatusPaid     OrderStatus = "paid"       // 已支付
	OrderStatusCancelled OrderStatus = "cancelled" // 已取消
	OrderStatusFailed    OrderStatus = "failed"    // 支付失败
)

// PaymentMethod 支付方式
type PaymentMethod string

const (
	PaymentMethodAlipayPC PaymentMethod = "alipay_pc" // 支付宝PC支付
	PaymentMethodAlipayQR PaymentMethod = "alipay_qr" // 支付宝扫码支付
	PaymentMethodMock     PaymentMethod = "mock"      // 模拟支付（仅开发用）
)

// Order 订单模型
type Order struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	OrderID       string       `gorm:"type:varchar(64);uniqueIndex;not null" json:"order_id"` // 订单号（唯一）
	UserID        uint         `gorm:"index;not null" json:"user_id"`                          // 用户ID
	PackageID     string       `gorm:"type:varchar(64);not null" json:"package_id"`           // 套餐ID
	PackageName   string       `gorm:"type:varchar(100)" json:"package_name"`                 // 套餐名称
	Amount        float64      `gorm:"type:decimal(10,2);not null" json:"amount"`             // 支付金额（CNY）
	Stardust      int64        `gorm:"not null" json:"stardust"`                              // 购买的星尘数量
	Status        OrderStatus  `gorm:"type:varchar(20);default:'pending';index" json:"status"` // 订单状态
	PaymentMethod PaymentMethod `gorm:"type:varchar(20);default:'alipay_pc'" json:"payment_method"` // 支付方式
	AlipayTradeNo string       `gorm:"type:varchar(64);index" json:"alipay_trade_no"`         // 支付宝交易号
	PayURL        string       `gorm:"type:text" json:"pay_url"`                              // 支付跳转链接
	QRCode        string       `gorm:"type:text" json:"qr_code"`                              // 二维码内容（扫码支付）
	PaidAt        *time.Time   `json:"paid_at"`                                               // 支付时间
	ExpiresAt     *time.Time   `json:"expires_at"`                                             // 订单过期时间
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Order) TableName() string {
	return "orders"
}

// IsPaid 判断订单是否已支付
func (o *Order) IsPaid() bool {
	return o.Status == OrderStatusPaid
}

// IsPending 判断订单是否待支付
func (o *Order) IsPending() bool {
	return o.Status == OrderStatusPending
}

// IsExpired 判断订单是否已过期
func (o *Order) IsExpired() bool {
	if o.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*o.ExpiresAt)
}

