package repositories

import (
	"yaolight-workshop/backend/infrastructure/database"
	paymentModels "yaolight-workshop/backend/modules/payment/models"

	"gorm.io/gorm"
)

// OrderRepository 订单仓储接口
type OrderRepository interface {
	Create(order *paymentModels.Order) error
	GetByOrderID(orderID string) (*paymentModels.Order, error)
	GetByID(id uint) (*paymentModels.Order, error)
	Update(order *paymentModels.Order) error
	Delete(order *paymentModels.Order) error
	GetByUserID(userID uint, limit, offset int) ([]paymentModels.Order, int64, error)
}

// orderRepository 订单仓储实现
type orderRepository struct {
	db *gorm.DB
}

// NewOrderRepository 创建订单仓储实例
func NewOrderRepository() OrderRepository {
	return &orderRepository{
		db: database.DB,
	}
}

// Create 创建订单
func (r *orderRepository) Create(order *paymentModels.Order) error {
	return r.db.Create(order).Error
}

// GetByOrderID 根据订单号获取订单
func (r *orderRepository) GetByOrderID(orderID string) (*paymentModels.Order, error) {
	var order paymentModels.Order
	err := r.db.Where("order_id = ?", orderID).First(&order).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// GetByID 根据ID获取订单
func (r *orderRepository) GetByID(id uint) (*paymentModels.Order, error) {
	var order paymentModels.Order
	err := r.db.First(&order, id).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// Update 更新订单
func (r *orderRepository) Update(order *paymentModels.Order) error {
	return r.db.Save(order).Error
}

// Delete 删除订单（软删除）
func (r *orderRepository) Delete(order *paymentModels.Order) error {
	return r.db.Delete(order).Error
}

// GetByUserID 根据用户ID获取订单列表
func (r *orderRepository) GetByUserID(userID uint, limit, offset int) ([]paymentModels.Order, int64, error) {
	var orders []paymentModels.Order
	var total int64

	// 获取总数
	if err := r.db.Model(&paymentModels.Order{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取列表
	err := r.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&orders).Error

	return orders, total, err
}

