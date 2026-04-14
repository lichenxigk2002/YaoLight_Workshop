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

// TokenUsageStats Token使用统计
type TokenUsageStats struct {
	Cost         float64 `json:"cost"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
	TotalTokens  int64   `json:"total_tokens"`
}

// ModelTokenStats 模型维度统计
type ModelTokenStats struct {
	Provider  string          `json:"provider"`
	ModelName string          `json:"model_name"`
	Today     TokenUsageStats `json:"today"`
	Total     TokenUsageStats `json:"total"`
}

// TokenStats 整体统计响应
type TokenStats struct {
	Today  TokenUsageStats   `json:"today"`
	Total  TokenUsageStats   `json:"total"`
	Models []ModelTokenStats `json:"models"`
}

// TransactionOptionItem 包含 Provider 和其对应的 Model 列表
type TransactionOptionItem struct {
	Provider string   `json:"provider"`
	Models   []string `json:"models"`
}

// TransactionOptions 筛选选项响应
type TransactionOptions struct {
	Items []TransactionOptionItem `json:"items"`
}

// BillingService 账单服务
type BillingService struct{}

// NewBillingService 创建账单服务
func NewBillingService() *BillingService {
	return &BillingService{}
}

// GetTransactionOptions 获取用户的筛选选项（Provider和Model列表）
func (s *BillingService) GetTransactionOptions(userID uint) (*TransactionOptions, error) {
	type Result struct {
		Provider  string
		ModelName string
	}
	var results []Result

	// 查询所有不重复的 Provider 和 ModelName 组合
	if err := database.DB.Model(&userModels.TokenTransaction{}).
		Select("DISTINCT provider, model_name").
		Where("user_id = ? AND (provider != '' OR model_name != '')", userID).
		Scan(&results).Error; err != nil {
		return nil, err
	}

	// 聚合数据
	providerMap := make(map[string][]string)
	for _, r := range results {
		if r.Provider == "" && r.ModelName == "" {
			continue
		}
		// 如果 Provider 为空，归类到 "Unknown" 或其他处理，这里暂且保留原样
		p := r.Provider
		if p == "" {
			p = "Other"
		}
		providerMap[p] = append(providerMap[p], r.ModelName)
	}

	var items []TransactionOptionItem
	for p, models := range providerMap {
		items = append(items, TransactionOptionItem{
			Provider: p,
			Models:   models,
		})
	}

	return &TransactionOptions{
		Items: items,
	}, nil
}

// GetTokenStats 获取Token统计数据
func (s *BillingService) GetTokenStats(userID uint) (*TokenStats, error) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	stats := &TokenStats{
		Models: make([]ModelTokenStats, 0),
	}

	// 1. 获取今日总体统计
	if err := database.DB.Model(&userModels.TokenTransaction{}).
		Select("COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(prompt_tokens), 0) as input_tokens, COALESCE(SUM(completion_tokens), 0) as output_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens").
		Where("user_id = ? AND created_at >= ?", userID, todayStart).
		Scan(&stats.Today).Error; err != nil {
		return nil, err
	}

	// 2. 获取累计总体统计
	if err := database.DB.Model(&userModels.TokenTransaction{}).
		Select("COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(prompt_tokens), 0) as input_tokens, COALESCE(SUM(completion_tokens), 0) as output_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens").
		Where("user_id = ?", userID).
		Scan(&stats.Total).Error; err != nil {
		return nil, err
	}

	// 3. 获取模型维度的统计（分组聚合）
	// 注意：这里需要分别计算Today和Total，或者一次性查出来并在内存中处理。
	// 为了简单起见，我们查两次分组聚合。

	type ModelStatRaw struct {
		Provider     string
		ModelName    string
		Cost         float64
		InputTokens  int64
		OutputTokens int64
		TotalTokens  int64
	}

	var totalRaw []ModelStatRaw
	if err := database.DB.Model(&userModels.TokenTransaction{}).
		Select("provider, model_name, COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(prompt_tokens), 0) as input_tokens, COALESCE(SUM(completion_tokens), 0) as output_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens").
		Where("user_id = ? AND (provider != '' OR model_name != '')", userID).
		Group("provider, model_name").
		Scan(&totalRaw).Error; err != nil {
		return nil, err
	}

	var todayRaw []ModelStatRaw
	if err := database.DB.Model(&userModels.TokenTransaction{}).
		Select("provider, model_name, COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(prompt_tokens), 0) as input_tokens, COALESCE(SUM(completion_tokens), 0) as output_tokens, COALESCE(SUM(total_tokens), 0) as total_tokens").
		Where("user_id = ? AND created_at >= ? AND (provider != '' OR model_name != '')", userID, todayStart).
		Group("provider, model_name").
		Scan(&todayRaw).Error; err != nil {
		return nil, err
	}

	// 4. 合并数据
	// 使用Map来合并Today和Total数据
	modelMap := make(map[string]*ModelTokenStats)

	// 先处理累计数据
	for _, raw := range totalRaw {
		key := raw.Provider + "|" + raw.ModelName
		if _, exists := modelMap[key]; !exists {
			modelMap[key] = &ModelTokenStats{
				Provider:  raw.Provider,
				ModelName: raw.ModelName,
			}
		}
		modelMap[key].Total = TokenUsageStats{
			Cost:         raw.Cost,
			InputTokens:  raw.InputTokens,
			OutputTokens: raw.OutputTokens,
			TotalTokens:  raw.TotalTokens,
		}
	}

	// 再处理今日数据
	for _, raw := range todayRaw {
		key := raw.Provider + "|" + raw.ModelName
		if _, exists := modelMap[key]; !exists {
			// 理论上Today有的Total一定有，但为了保险起见
			modelMap[key] = &ModelTokenStats{
				Provider:  raw.Provider,
				ModelName: raw.ModelName,
			}
		}
		modelMap[key].Today = TokenUsageStats{
			Cost:         raw.Cost,
			InputTokens:  raw.InputTokens,
			OutputTokens: raw.OutputTokens,
			TotalTokens:  raw.TotalTokens,
		}
	}

	// 转换为Slice
	for _, v := range modelMap {
		stats.Models = append(stats.Models, *v)
	}

	return stats, nil
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
