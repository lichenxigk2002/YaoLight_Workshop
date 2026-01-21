package services

import (
	"fmt"
	"log"
	"yaolight-workshop/backend/infrastructure/shared"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

// PricingService 计费服务
// 核心逻辑：
// 1. 从数据库读取模型计费配置 (ModelPricingConfig)
// 2. 根据不同的计费类型 (PricingType) 解析 PricingData
// 3. 计算出本次调用的总 USD 费用（自动处理 CNY 汇率转换）
// 4. 将总 USD 费用换算为基准“星尘”（等效 Token）
type PricingService struct {
	pricingRepo aiRepos.PricingConfigRepository
}

// NewPricingService 创建计费服务
func NewPricingService(pricingRepo aiRepos.PricingConfigRepository) *PricingService {
	return &PricingService{
		pricingRepo: pricingRepo,
	}
}

// CalculateEquivalentTokens 计算等效Token数（星尘消耗）
// 以DeepSeek为基准，1星尘 = $0.28/1M tokens
func (s *PricingService) CalculateEquivalentTokens(usage *providers.TokenUsage, provider string, modelName string) (int64, error) {
	// 1. 计算当前调用的总费用 (USD)
	cost, err := s.CalculateCost(usage, provider, modelName)
	if err != nil {
		log.Printf("⚠️ CalculateCost failed for provider=%s, model=%s: %v, fallback to 1:1 total tokens", provider, modelName, err)
		return int64(usage.TotalTokens), nil
	}

	// 2. 获取基准模型（DeepSeek）的单价 (USD/1M)
	// 我们定义 1 星尘 = 1 个 DeepSeek 缓存未命中输入 Token 的价值
	// 即 1 星尘 = $0.28 / 1,000,000
	baseTokenPrice := 0.28 / 1000000.0

	// 尝试从数据库动态获取 DeepSeek 的基准单价，如果没有则使用硬编码兜底
	dsConfig, err := s.pricingRepo.FindByProviderAndModel("deepseek", "deepseek-chat")
	if err == nil {
		if data, ok := dsConfig.PricingData.Data.(map[string]interface{}); ok {
			if p, ok := data["input_price_per_million_cache_miss"].(float64); ok {
				baseTokenPrice = p / 1000000.0
			} else if p, ok := data["input_price_per_million"].(float64); ok {
				baseTokenPrice = p / 1000000.0
			}
		}
	}

	// 3. 计算等效星尘 = 总费用 / 基准单价
	equivalentTokens := cost / baseTokenPrice

	// 如果计算结果极小且有使用量，至少扣1星尘（除非是免费模型）
	if equivalentTokens > 0 && equivalentTokens < 1 && usage.TotalTokens > 0 {
		return 1, nil
	}

	return int64(equivalentTokens), nil
}

// CalculateCost 计算本次调用的总费用 (USD)
func (s *PricingService) CalculateCost(usage *providers.TokenUsage, provider string, modelName string) (float64, error) {
	config, err := s.pricingRepo.FindByProviderAndModel(provider, modelName)
	if err != nil {
		// 只在查询失败时输出醒目的错误日志
		log.Printf("\n❌❌❌ 计费配置查询失败 ❌❌❌\n    Provider: '%s'\n    ModelName: '%s'\n    错误: %v\n    → 将使用 1:1 兜底扣费\n",
			provider, modelName, err)
		return 0, fmt.Errorf("pricing config not found for %s/%s", provider, modelName)
	}

	if !config.IsActive {
		return 0, nil
	}

	var costTotal float64

	// 根据不同的计费类型选择计算逻辑
	switch config.PricingType {
	case "unified":
		costTotal = s.calculateUnifiedCost(config, usage)
	case "separate", "multi_type":
		costTotal = s.calculateDetailedCost(config, usage)
	case "segmented":
		costTotal = s.calculateSegmentedCost(config, usage)
	case "per_image":
		costTotal = s.calculatePerImageCost(config, usage)
	default:
		log.Printf("⚠️ Unknown pricing type: %s, using fallback", config.PricingType)
		costTotal = float64(usage.TotalTokens) / 1000000.0 * 0.28
	}

	// 汇率转换：如果是 CNY 配置，统一转为 USD
	if config.Currency == "CNY" {
		costTotal = costTotal * 0.14 // 1 CNY = 0.14 USD
	}

	return costTotal, nil
}

// calculateUnifiedCost 统一计费逻辑
func (s *PricingService) calculateUnifiedCost(config *aiModels.ModelPricingConfig, usage *providers.TokenUsage) float64 {
	data, _ := config.PricingData.Data.(map[string]interface{})
	price, _ := s.getFloat64(data, "price_per_million_tokens")
	return (float64(usage.TotalTokens) / 1000000.0) * price
}

// calculateDetailedCost 分离计费/多类型计费（支持输入、输出、缓存、音频）
func (s *PricingService) calculateDetailedCost(config *aiModels.ModelPricingConfig, usage *providers.TokenUsage) float64 {
	data, _ := config.PricingData.Data.(map[string]interface{})
	total := 0.0

	// 1. 输入费用（处理缓存命中/未命中的细分计费）
	if cacheHitPrice, ok := s.getFloat64(data, "input_price_per_million_cache_hit"); ok && usage.CacheReadTokens != nil && *usage.CacheReadTokens > 0 {
		// 触发了缓存命中的计费
		total += (float64(*usage.CacheReadTokens) / 1000000.0) * cacheHitPrice
		// 剩余未命中的部分按常规输入计费
		missTokens := usage.PromptTokens - *usage.CacheReadTokens
		if missTokens < 0 {
			missTokens = 0
		}
		price, _ := s.getFloat64(data, "input_price_per_million_cache_miss")
		if price == 0 {
			price, _ = s.getFloat64(data, "input_price_per_million")
		}
		total += (float64(missTokens) / 1000000.0) * price
	} else {
		// 常规输入计费
		price, ok := s.getFloat64(data, "input_price_per_million")
		if !ok {
			price, _ = s.getFloat64(data, "input_price_per_million_cache_miss")
		}
		total += (float64(usage.PromptTokens) / 1000000.0) * price
	}

	// 2. 输出费用
	if price, ok := s.getFloat64(data, "output_price_per_million"); ok {
		total += (float64(usage.CompletionTokens) / 1000000.0) * price
	}

	// 3. 音频费用
	if price, ok := s.getFloat64(data, "audio_price_per_million"); ok && usage.AudioTokens != nil {
		total += (float64(*usage.AudioTokens) / 1000000.0) * price
	}

	// 4. 缓存读取费用（独立计费项，如 GPT-4o）
	if price, ok := s.getFloat64(data, "cache_read_price_per_million"); ok && usage.CacheReadTokens != nil {
		total += (float64(*usage.CacheReadTokens) / 1000000.0) * price
	}

	return total
}

// calculateSegmentedCost 分段计费（如 Grok, Qwen3-max）
func (s *PricingService) calculateSegmentedCost(config *aiModels.ModelPricingConfig, usage *providers.TokenUsage) float64 {
	data, _ := config.PricingData.Data.(map[string]interface{})
	segmentsRaw, ok := data["segments"].([]interface{})
	if !ok {
		return 0
	}

	// 根据上下文长度（输入Token）寻找匹配的分段
	var selected map[string]interface{}
	for _, segRaw := range segmentsRaw {
		seg, ok := segRaw.(map[string]interface{})
		if !ok {
			continue
		}

		limitRaw := seg["context_length_limit"]
		if limitRaw == nil { // null表示无上限，作为兜底
			if selected == nil {
				selected = seg
			}
			continue
		}

		limit := s.toValue(limitRaw)
		if float64(usage.PromptTokens) <= limit {
			selected = seg
			break
		}
	}

	if selected == nil {
		return 0
	}

	// 将选中的分段作为 Detailed 配置重新计算
	virtualConfig := &aiModels.ModelPricingConfig{
		PricingData: shared.JSONB{Data: selected},
		Currency:    config.Currency,
	}
	return s.calculateDetailedCost(virtualConfig, usage)
}

// calculatePerImageCost 按张计费
func (s *PricingService) calculatePerImageCost(config *aiModels.ModelPricingConfig, usage *providers.TokenUsage) float64 {
	data, _ := config.PricingData.Data.(map[string]interface{})
	price, _ := s.getFloat64(data, "price_per_image")

	// 目前 TokenUsage 中尚未包含图片数量，暂时按 1 张计或从特殊字段获取
	// TODO: 在 TokenUsage 中正式增加 ImageCount 字段
	return price
}

// 辅助工具：安全获取 float64
func (s *PricingService) getFloat64(data map[string]interface{}, key string) (float64, bool) {
	val, exists := data[key]
	if !exists {
		return 0, false
	}
	return s.toValue(val), true
}

// 辅助工具：通用数值转换
func (s *PricingService) toValue(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case int32:
		return float64(val)
	default:
		return 0
	}
}

// GetCurrency 获取模型的货币单位
func (s *PricingService) GetCurrency(provider string, modelName string) string {
	config, err := s.pricingRepo.FindByProviderAndModel(provider, modelName)
	if err != nil {
		return "USD"
	}
	return config.Currency
}
