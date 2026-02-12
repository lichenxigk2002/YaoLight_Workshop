package services

import (
	"errors"
	"fmt"
	"strings"
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/ai/models"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/utils"
)

var (
	ErrModelNotFound       = errors.New("model not found")
	ErrModelNotOwned       = errors.New("model does not belong to user")
	ErrModelInactive       = errors.New("model is inactive")
	ErrProviderNotFound    = errors.New("provider template not found")
	ErrInvalidAPIKey       = errors.New("invalid API key")
	ErrUnsupportedProvider = errors.New("unsupported provider")
)

// AIService AI服务
type AIService struct {
	modelRepo       repository.AIModelRepository
	templateRepo    repository.ProviderTemplateRepository
	pricingRepo     aiRepos.PricingConfigRepository
	capabilityRepo  aiRepos.CapabilityConfigRepository
	providerFactory *ProviderFactory
}

// NewAIService 创建AI服务实例
func NewAIService(
	modelRepo repository.AIModelRepository,
	templateRepo repository.ProviderTemplateRepository,
	pricingRepo aiRepos.PricingConfigRepository,
	capabilityRepo aiRepos.CapabilityConfigRepository,
) *AIService {
	return &AIService{
		modelRepo:       modelRepo,
		templateRepo:    templateRepo,
		pricingRepo:     pricingRepo,
		capabilityRepo:  capabilityRepo,
		providerFactory: NewProviderFactory(),
	}
}

// GetProviderTemplates 获取所有供应商模板（从数据库动态获取模型列表）
func (s *AIService) GetProviderTemplates() ([]map[string]interface{}, error) {
	// 从数据库获取所有活跃的计费配置
	allPricingConfigs, err := s.pricingRepo.FindAll()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch pricing configs: %w", err)
	}

	// 按 provider 分组模型
	modelsByProvider := make(map[string][]string)
	for _, config := range allPricingConfigs {
		if config.IsActive {
			p := strings.ToLower(config.Provider)
			modelsByProvider[p] = append(modelsByProvider[p], config.ModelName)
		}
	}

	// 从数据库读取供应商模板（来源：ai_provider_templates）
	templatesFromDB, err := s.templateRepo.FindAll()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch provider templates: %w", err)
	}

	// 兼容兜底：如果数据库还没种子数据，返回空数组（由前端自行兜底/提示）
	if len(templatesFromDB) == 0 {
		return []map[string]interface{}{}, nil
	}

	// 构建结果列表（以 DB 模板为准；supportedModels 优先取计费表动态聚合，否则回退模板自带 supported_models）
	result := make([]map[string]interface{}, 0, len(templatesFromDB))
	for _, t := range templatesFromDB {
		provider := strings.ToLower(t.Provider)

		// 计费配置中的子模型（动态），用于 UI 展示和系统星尘计费
		supportedModels := modelsByProvider[provider]
		if len(supportedModels) == 0 {
			// 回退到模板字段（如果模板里也维护了 supported_models）
			if arr, ok := t.SupportedModels.Data.([]interface{}); ok {
				for _, v := range arr {
					if s, ok := v.(string); ok && s != "" {
						supportedModels = append(supportedModels, s)
					}
				}
			} else if arr, ok := t.SupportedModels.Data.([]string); ok {
				supportedModels = append(supportedModels, arr...)
			}
		}
		if supportedModels == nil {
			supportedModels = []string{}
		}

		// defaultConfig 回退为空对象，避免前端类型/渲染异常
		defaultConfig := map[string]interface{}{}
		if m, ok := t.DefaultConfig.Data.(map[string]interface{}); ok && m != nil {
			defaultConfig = m
		}

		template := map[string]interface{}{
			"provider":        provider,
			"name":            t.Name,
			"description":     t.Description,
			"icon":            t.Icon,
			"defaultBaseUrl":  t.DefaultBaseURL,
			"defaultEndpoint": t.DefaultEndpoint,
			"defaultConfig":   defaultConfig,
			"supportedModels": supportedModels,
		}

		// 附加该 provider 下各模型的能力配置（按 model_name 索引）
		modelCapabilities := make(map[string]map[string]interface{})
		if s.capabilityRepo != nil {
			caps, _ := s.capabilityRepo.FindByProvider(provider)
			for _, c := range caps {
				modelCapabilities[c.ModelName] = capabilityToMap(&c)
			}
		}
		template["modelCapabilities"] = modelCapabilities

		result = append(result, template)
	}

	return result, nil
}

// GetModelCapability 按 provider+model_name 获取能力配置，不存在时返回 nil
func (s *AIService) GetModelCapability(provider, modelName string) map[string]interface{} {
	if s.capabilityRepo == nil {
		return nil
	}
	c, err := s.capabilityRepo.FindByProviderAndModel(provider, modelName)
	if err != nil || c == nil {
		return nil
	}
	return capabilityToMap(c)
}

// capabilityToMap 将 ModelCapabilityConfig 转为前端可用的 map
func capabilityToMap(c *models.ModelCapabilityConfig) map[string]interface{} {
	m := map[string]interface{}{
		"support_temperature":       c.SupportTemperature,
		"support_max_tokens":        c.SupportMaxTokens,
		"support_top_p":             c.SupportTopP,
		"support_stream":            c.SupportStream,
		"support_thinking":          c.SupportThinking,
		"support_thinking_level":    c.SupportThinkingLevel,
		"support_enable_thinking":   c.SupportEnableThinking,
		"support_frequency_penalty": c.SupportFrequencyPenalty,
		"support_presence_penalty":  c.SupportPresencePenalty,
		"support_stop_sequences":    c.SupportStopSequences,
		"support_vision":            c.SupportVision,
		"support_image_generation":  c.SupportImageGeneration,
		"max_tokens_limit":          c.MaxTokensLimit,
	}
	if c.CapabilityOptions != nil && c.CapabilityOptions.Data != nil {
		m["capability_options"] = c.CapabilityOptions.Data
	}
	return m
}

// GetProvider 获取提供商实例
func (s *AIService) GetProvider(providerName string) (providers.AIProvider, error) {
	return s.providerFactory.GetProvider(providerName)
}

// GetSystemPresetModels 获取系统预设模型列表（从.env读取）
func (s *AIService) GetSystemPresetModels() []map[string]interface{} {
	models := []map[string]interface{}{}

	// 检查是否有DeepSeek预设配置
	if config.DeepSeekAPIKey != "" {
		models = append(models, map[string]interface{}{
			"id":          "system_deepseek",
			"name":        "DeepSeek",
			"provider":    "deepseek",
			"modelName":   "deepseek-chat",
			"baseUrl":     "https://api.deepseek.com",
			"isSystem":    true,
			"description": "系统预设的DeepSeek模型，所有用户可用",
		})
	}

	// 检查是否有豆包预设配置
	if config.DoubaoAPIKey != "" {
		models = append(models, map[string]interface{}{
			"id":          "system_doubao",
			"name":        "豆包",
			"provider":    "doubao",
			"modelName":   "doubao-seed-1-6-251015",
			"baseUrl":     "https://ark.cn-beijing.volces.com/api/v3",
			"isSystem":    true,
			"description": "系统预设的豆包模型，所有用户可用",
		})
	}

	// 检查是否有通义千问预设配置
	if config.QwenAPIKey != "" {
		models = append(models, map[string]interface{}{
			"id":          "system_qwen",
			"name":        "通义千问",
			"provider":    "qwen",
			"modelName":   "qwen-plus",
			"baseUrl":     "https://dashscope.aliyuncs.com/compatible-mode/v1",
			"isSystem":    true,
			"description": "系统预设的通义千问模型，所有用户可用",
		})
	}

	// 检查是否有智谱AI预设配置
	if config.ZhipuaiAPIKey != "" {
		models = append(models, map[string]interface{}{
			"id":          "system_zhipuai",
			"name":        "智谱AI GLM",
			"provider":    "zhipuai",
			"modelName":   "glm-4.7",
			"baseUrl":     "https://open.bigmodel.cn/api/paas/v4",
			"isSystem":    true,
			"description": "系统预设的智谱AI GLM模型，所有用户可用",
		})
	}

	// 检查是否有讯飞星火预设配置
	if config.SparkAPIKey != "" {
		models = append(models, map[string]interface{}{
			"id":          "system_spark",
			"name":        "讯飞星火",
			"provider":    "spark",
			"modelName":   "spark-x",
			"baseUrl":     "https://spark-api-open.xf-yun.com/v2",
			"isSystem":    true,
			"description": "系统预设的讯飞星火模型，所有用户可用",
		})
	}

	// 检查是否有腾讯混元预设配置
	if config.HunyuanAPIKey != "" {
		models = append(models, map[string]interface{}{
			"id":          "system_hunyuan",
			"name":        "腾讯混元",
			"provider":    "hunyuan",
			"modelName":   "hunyuan-turbos-latest",
			"baseUrl":     "https://api.hunyuan.cloud.tencent.com/v1",
			"isSystem":    true,
			"description": "系统预设的腾讯混元模型，所有用户可用",
		})
	}

	// 检查是否有OpenRouter预设配置（Claude、Gemini、GPT、Grok都使用OpenRouter）
	if config.GeminiAPIKey != "" {
		models = append(models, map[string]interface{}{
			"id":          "system_claude",
			"name":        "Claude",
			"provider":    "claude",
			"modelName":   "anthropic/claude-sonnet-4.5",
			"baseUrl":     "https://openrouter.ai/api/v1",
			"isSystem":    true,
			"description": "系统预设的Anthropic Claude模型，所有用户可用",
		})

		models = append(models, map[string]interface{}{
			"id":          "system_gemini",
			"name":        "Google Gemini",
			"provider":    "gemini",
			"modelName":   "google/gemini-3-pro-preview",
			"baseUrl":     "https://openrouter.ai/api/v1",
			"isSystem":    true,
			"description": "系统预设的Google Gemini模型，所有用户可用",
		})

		models = append(models, map[string]interface{}{
			"id":          "system_gpt",
			"name":        "GPT",
			"provider":    "gpt",
			"modelName":   "openai/gpt-oss-20b",
			"baseUrl":     "https://openrouter.ai/api/v1",
			"isSystem":    true,
			"description": "系统预设的OpenAI GPT模型（OpenRouter），所有用户可用",
		})

		// 既然有了OpenRouter Key，顺便也加上Grok作为系统预设
		models = append(models, map[string]interface{}{
			"id":          "system_grok",
			"name":        "Grok",
			"provider":    "grok",
			"modelName":   "x-ai/grok-4.1-fast",
			"baseUrl":     "https://openrouter.ai/api/v1",
			"isSystem":    true,
			"description": "系统预设的xAI Grok模型，所有用户可用",
		})
	}

	return models
}

// GetModelsByUserID 获取用户的模型列表
func (s *AIService) GetModelsByUserID(userID uint, page, pageSize int) ([]*models.AIModel, int64, error) {
	offset := (page - 1) * pageSize
	entities, total, err := s.modelRepo.FindByUserID(userID, offset, pageSize)
	if err != nil {
		return nil, 0, err
	}

	// 转换为持久化实体
	models := make([]*models.AIModel, len(entities))
	for i, e := range entities {
		models[i] = toPersistenceModel(e)
	}

	return models, total, nil
}

// GetModelByIDAndUser 根据ID和用户ID获取模型（验证归属）
func (s *AIService) GetModelByIDAndUser(id uint, userID uint) (*models.AIModel, error) {
	entity, err := s.modelRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, ErrModelNotFound
	}

	if !entity.IsActive() {
		return nil, ErrModelInactive
	}

	return toPersistenceModel(entity), nil
}

// CreateModelRequest 创建模型请求
func normalizeProvider(provider string) string {
	switch provider {
	case "qianwen":
		return "qwen"
	default:
		return provider
	}
}

type CreateModelRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Provider    string                 `json:"provider" binding:"required"`
	ModelName   string                 `json:"modelName" binding:"required"`
	APIKey      string                 `json:"apiKey" binding:"required"`
	BaseURL     *string                `json:"baseUrl,omitempty"`
	Endpoint    *string                `json:"endpoint,omitempty"`
	Temperature *float64               `json:"temperature,omitempty"`
	MaxTokens   *int                   `json:"maxTokens,omitempty"`
	Params      map[string]interface{} `json:"params,omitempty"` // 模型级别的自定义配置（JSONB）
	UserID      uint                   `json:"-"`
}

// CreateModel 创建模型配置
func (s *AIService) CreateModel(req *CreateModelRequest) (*models.AIModel, error) {
	req.Provider = strings.ToLower(normalizeProvider(req.Provider))

	// 验证提供商是否支持：优先以数据库模板为准，兼容老版本再回退硬编码白名单
	var providerTemplate *entity.ProviderTemplate
	if s.templateRepo != nil {
		if tpl, err := s.templateRepo.FindByProvider(req.Provider); err == nil {
			providerTemplate = tpl
		}
	}
	if providerTemplate == nil {
		// fallback：避免旧环境未种子数据时直接不可用
		supportedProviders := map[string]bool{
			"deepseek": true,
			"doubao":   true,
			"qwen":     true,
			"spark":    true,
			"hunyuan":  true,
			"zhipuai":  true,
			"gemini":   true,
			"gpt":      true,
			"grok":     true,
			"claude":   true,
			"openai":   true,
		}
		if !supportedProviders[req.Provider] {
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedProvider, req.Provider)
		}
	}

	// 加密API Key
	encryptedKey, err := utils.EncryptAPIKey(req.APIKey)
	if err != nil {
		return nil, ErrInvalidAPIKey
	}

	// 使用默认值
	baseURL := req.BaseURL
	if baseURL == nil {
		// 优先使用数据库模板的默认 BaseURL
		if providerTemplate != nil && providerTemplate.DefaultBaseURL != nil && *providerTemplate.DefaultBaseURL != "" {
			baseURL = providerTemplate.DefaultBaseURL
		} else {
			var defaultURL string
			switch req.Provider {
			case "deepseek":
				defaultURL = "https://api.deepseek.com"
			case "doubao":
				defaultURL = "https://ark.cn-beijing.volces.com/api/v3"
			case "qwen":
				defaultURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
			case "spark":
				defaultURL = "https://spark-api-open.xf-yun.com/v2"
			case "hunyuan":
				defaultURL = "https://api.hunyuan.cloud.tencent.com/v1"
			case "zhipuai":
				defaultURL = "https://open.bigmodel.cn/api/paas/v4"
			case "claude", "gemini", "gpt", "grok", "openai":
				// 注意：gpt/claude/gemini/grok 依旧是 OpenRouter；openai 这里给一个可用默认值
				if req.Provider == "openai" {
					defaultURL = "https://api.openai.com/v1"
				} else {
					defaultURL = "https://openrouter.ai/api/v1"
				}
			default:
				defaultURL = "https://api.deepseek.com"
			}
			baseURL = &defaultURL
		}
	}

	temperature := req.Temperature
	if temperature == nil {
		// 智谱AI默认1.0，其他默认0.7
		if req.Provider == "zhipuai" {
			t := 1.0
			temperature = &t
		} else {
			t := 0.7
			temperature = &t
		}
	}

	maxTokens := req.MaxTokens
	if maxTokens == nil {
		t := 2000
		maxTokens = &t
	}

	// 处理 Params 字段
	var paramsJSONB shared.JSONB
	if req.Params != nil && len(req.Params) > 0 {
		paramsJSONB = shared.JSONB{Data: req.Params}
	} else {
		paramsJSONB = shared.JSONB{Data: map[string]interface{}{}}
	}

	// 创建领域实体
	entity := &entity.AIModel{
		Name:            req.Name,
		Provider:        req.Provider,
		ModelName:       req.ModelName,
		APIKeyEncrypted: encryptedKey,
		BaseURL:         baseURL,
		Endpoint:        req.Endpoint,
		Status:          "active",
		Temperature:     temperature,
		MaxTokens:       maxTokens,
		Params:          paramsJSONB,
		CreatedBy:       &req.UserID,
	}

	// 保存
	if err := s.modelRepo.Create(entity); err != nil {
		return nil, err
	}

	return toPersistenceModel(entity), nil
}

// UpdateModelRequest 更新模型请求
type UpdateModelRequest struct {
	Name        *string                 `json:"name,omitempty"`
	APIKey      *string                 `json:"apiKey,omitempty"`
	BaseURL     *string                 `json:"baseUrl,omitempty"`
	Endpoint    *string                 `json:"endpoint,omitempty"`
	Temperature *float64                `json:"temperature,omitempty"`
	MaxTokens   *int                    `json:"maxTokens,omitempty"`
	Status      *string                 `json:"status,omitempty"`
	Params      *map[string]interface{} `json:"params,omitempty"` // 模型级别的自定义配置（JSONB）
}

// UpdateModel 更新模型配置
func (s *AIService) UpdateModel(id uint, userID uint, req *UpdateModelRequest) (*models.AIModel, error) {
	// 获取模型并验证归属
	entity, err := s.modelRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, ErrModelNotFound
	}

	// 更新字段
	if req.Name != nil {
		entity.Name = *req.Name
	}
	if req.APIKey != nil {
		encryptedKey, err := utils.EncryptAPIKey(*req.APIKey)
		if err != nil {
			return nil, ErrInvalidAPIKey
		}
		entity.APIKeyEncrypted = encryptedKey
	}
	if req.BaseURL != nil {
		entity.BaseURL = req.BaseURL
	}
	if req.Endpoint != nil {
		entity.Endpoint = req.Endpoint
	}
	if req.Temperature != nil {
		entity.Temperature = req.Temperature
	}
	if req.MaxTokens != nil {
		entity.MaxTokens = req.MaxTokens
	}
	if req.Status != nil {
		entity.Status = *req.Status
	}
	if req.Params != nil {
		// 更新 Params 字段
		entity.Params = shared.JSONB{Data: *req.Params}
	}

	// 保存
	if err := s.modelRepo.Update(entity); err != nil {
		return nil, err
	}

	return toPersistenceModel(entity), nil
}

// DeleteModel 删除模型配置
func (s *AIService) DeleteModel(id uint, userID uint) error {
	// 验证归属
	_, err := s.modelRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return ErrModelNotFound
	}

	return s.modelRepo.Delete(id)
}

// toPersistenceModel 将领域实体转换为持久化实体（用于返回给前端）
func toPersistenceModel(e *entity.AIModel) *models.AIModel {
	return &models.AIModel{
		ID:               e.ID,
		Name:             e.Name,
		Provider:         e.Provider,
		ModelName:        e.ModelName,
		APIKeyEncrypted:  "", // 安全考虑：绝对不返回API Key给前端，即使是加密的
		Endpoint:         e.Endpoint,
		BaseURL:          e.BaseURL,
		Params:           e.Params,
		Status:           e.Status,
		MaxTokens:        e.MaxTokens,
		Temperature:      e.Temperature,
		TopP:             e.TopP,
		FrequencyPenalty: e.FrequencyPenalty,
		PresencePenalty:  e.PresencePenalty,
		StopSequences:    e.StopSequences,
		SystemPrompt:     e.SystemPrompt,
		PromptTemplate:   e.PromptTemplate,
		RateLimit:        e.RateLimit,
		CostPerToken:     e.CostPerToken,
		UsageCount:       e.UsageCount,
		TotalTokens:      e.TotalTokens,
		TotalCost:        e.TotalCost,
		LastUsedAt:       e.LastUsedAt,
		ErrorCount:       e.ErrorCount,
		AvgResponseTime:  e.AvgResponseTime,
		CreatedBy:        e.CreatedBy,
		CreatedAt:        e.CreatedAt,
		UpdatedAt:        e.UpdatedAt,
	}
}
