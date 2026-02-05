package services

import (
	"errors"
	"time"

	"yaolight-workshop/backend/infrastructure/database"
	userModels "yaolight-workshop/backend/modules/user/models"
)

// BillPeriod 账单周期类型
const (
	BillPeriodDay     = "day"
	BillPeriodMonth   = "month"
	BillPeriodQuarter = "quarter"
	BillPeriodYear    = "year"
)

var (
	ErrInvalidBillPeriod = errors.New("invalid bill period")
	ErrInvalidBillParams = errors.New("invalid bill params: year required; month required for day/month; day required for day")
)

// BillSummaryRequest 账单汇总请求参数
type BillSummaryRequest struct {
	Period string // day | month | quarter | year
	Year   int
	Month  int // 1-12，month/quarter/day 时必填
	Day    int // 1-31，period=day 时必填
}

// BillSummary 账单汇总响应
type BillSummary struct {
	Period           string    `json:"period"`
	StartAt          time.Time `json:"start_at"`
	EndAt            time.Time `json:"end_at"`
	TotalIncome      int64     `json:"total_income"`      // 收入（amount > 0 之和，星尘）
	TotalExpense     int64     `json:"total_expense"`     // 支出（amount < 0 的绝对值之和）
	TransactionCount int64     `json:"transaction_count"` // 笔数
}

// BillingService 账单服务
type BillingService struct{}

// NewBillingService 创建账单服务
func NewBillingService() *BillingService {
	return &BillingService{}
}

// GetBillSummary 按周期汇总当前用户流水，返回账单摘要
func (s *BillingService) GetBillSummary(userID uint, req *BillSummaryRequest) (*BillSummary, error) {
	if req == nil || req.Year <= 0 {
		return nil, ErrInvalidBillParams
	}
	var startAt, endAt time.Time
	switch req.Period {
	case BillPeriodDay:
		if req.Month < 1 || req.Month > 12 || req.Day < 1 || req.Day > 31 {
			return nil, ErrInvalidBillParams
		}
		startAt = time.Date(req.Year, time.Month(req.Month), req.Day, 0, 0, 0, 0, time.Local)
		endAt = startAt.AddDate(0, 0, 1).Add(-time.Nanosecond)
	case BillPeriodMonth:
		if req.Month < 1 || req.Month > 12 {
			return nil, ErrInvalidBillParams
		}
		startAt = time.Date(req.Year, time.Month(req.Month), 1, 0, 0, 0, 0, time.Local)
		endAt = startAt.AddDate(0, 1, 0).Add(-time.Nanosecond)
	case BillPeriodQuarter:
		if req.Month < 1 || req.Month > 4 {
			return nil, ErrInvalidBillParams
		}
		// month 传 1/2/3/4 表示第几季度
		startMonth := (req.Month-1)*3 + 1
		startAt = time.Date(req.Year, time.Month(startMonth), 1, 0, 0, 0, 0, time.Local)
		endAt = startAt.AddDate(0, 3, 0).Add(-time.Nanosecond)
	case BillPeriodYear:
		startAt = time.Date(req.Year, 1, 1, 0, 0, 0, 0, time.Local)
		endAt = startAt.AddDate(1, 0, 0).Add(-time.Nanosecond)
	default:
		return nil, ErrInvalidBillPeriod
	}

	var totalIncome, totalExpense, count int64
	// 收入：amount > 0
	if err := database.DB.Raw(
		"SELECT COALESCE(SUM(amount), 0) FROM token_transactions WHERE user_id = ? AND created_at >= ? AND created_at <= ? AND amount > 0",
		userID, startAt, endAt,
	).Scan(&totalIncome).Error; err != nil {
		return nil, err
	}
	// 支出：amount < 0，汇总取绝对值
	if err := database.DB.Raw(
		"SELECT COALESCE(ABS(SUM(amount)), 0) FROM token_transactions WHERE user_id = ? AND created_at >= ? AND created_at <= ? AND amount < 0",
		userID, startAt, endAt,
	).Scan(&totalExpense).Error; err != nil {
		return nil, err
	}
	if err := database.DB.Model(&userModels.TokenTransaction{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ?", userID, startAt, endAt).
		Count(&count).Error; err != nil {
		return nil, err
	}

	return &BillSummary{
		Period:           req.Period,
		StartAt:          startAt,
		EndAt:            endAt,
		TotalIncome:      totalIncome,
		TotalExpense:     totalExpense,
		TransactionCount: count,
	}, nil
}

// GetTransactionTimeRange 返回某周期的时间范围，供流水列表筛选用
func (s *BillingService) GetTransactionTimeRange(userID uint, req *BillSummaryRequest) (startAt, endAt *time.Time, err error) {
	sum, err := s.GetBillSummary(userID, req)
	if err != nil {
		return nil, nil, err
	}
	return &sum.StartAt, &sum.EndAt, nil
}

// GetTransactionsInRange 获取用户在指定时间范围内的流水明细（用于导出 PDF）
func (s *BillingService) GetTransactionsInRange(userID uint, startAt, endAt time.Time, limit int) ([]userModels.TokenTransaction, error) {
	if limit <= 0 {
		limit = 500
	}
	var list []userModels.TokenTransaction
	err := database.DB.Model(&userModels.TokenTransaction{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ?", userID, startAt, endAt).
		Order("created_at DESC").
		Limit(limit).
		Find(&list).Error
	return list, err
}
