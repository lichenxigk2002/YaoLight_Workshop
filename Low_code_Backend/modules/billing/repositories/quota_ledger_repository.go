package repositories

import (
	"yaolight-workshop/backend/modules/billing/models"

	"gorm.io/gorm"
)

// QuotaLedgerRepository 配额流水仓储
type QuotaLedgerRepository struct {
	db *gorm.DB
}

// NewQuotaLedgerRepository 创建仓储实例
func NewQuotaLedgerRepository(db *gorm.DB) *QuotaLedgerRepository {
	return &QuotaLedgerRepository{db: db}
}

// Create 写入一条流水
func (r *QuotaLedgerRepository) Create(entry *models.QuotaLedger) error {
	return r.db.Create(entry).Error
}

// ListParams 列表查询参数
type ListParams struct {
	Page      int
	PageSize  int
	UserID    *uint
	SourceType string
	StartDate string
	EndDate   string
}

// List 分页查询流水，按创建时间倒序
func (r *QuotaLedgerRepository) List(p ListParams) ([]models.QuotaLedger, int64, error) {
	q := r.db.Model(&models.QuotaLedger{})
	if p.UserID != nil {
		q = q.Where("user_id = ?", *p.UserID)
	}
	if p.SourceType != "" {
		q = q.Where("source_type = ?", p.SourceType)
	}
	if p.StartDate != "" {
		q = q.Where("created_at >= ?", p.StartDate)
	}
	if p.EndDate != "" {
		q = q.Where("created_at <= ?", p.EndDate)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := p.Page
	if page < 1 {
		page = 1
	}
	pageSize := p.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	var list []models.QuotaLedger
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}
