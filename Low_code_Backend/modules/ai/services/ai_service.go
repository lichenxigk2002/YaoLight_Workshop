package services

import (
	"errors"
	"fmt"
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/ai/models"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/utils"
)

var (
	ErrModelNotFound    = errors.New("model not found")
	ErrModelNotOwned    = errors.New("model does not belong to user")
	ErrModelInactive    = errors.New("model is inactive")
	ErrProviderNotFound = errors.New("provider template not found")
	ErrInvalidAPIKey    = errors.New("invalid API key")
)

// AIService AI服务
type AIService struct {
	modelRepo       repository.AIModelRepository
	templateRepo    repository.ProviderTemplateRepository
	providerFactory *ProviderFactory
}

// NewAIService 创建AI服务实例
func NewAIService(
	modelRepo repository.AIModelRepository,
	templateRepo repository.ProviderTemplateRepository,
) *AIService {
	return &AIService{
		modelRepo:       modelRepo,
		templateRepo:    templateRepo,
		providerFactory: NewProviderFactory(),
	}
}

// GetProviderTemplates 获取所有供应商模板（暂时返回硬编码的列表）
func (s *AIService) GetProviderTemplates() ([]map[string]interface{}, error) {
	// 暂时返回硬编码的提供商列表，后续可以从数据库读取
	return []map[string]interface{}{
		{
			"provider":        "deepseek",
			"name":            "DeepSeek",
			"description":     "DeepSeek AI模型",
			"defaultBaseUrl":  "https://api.deepseek.com",
			"supportedModels": []string{"deepseek-chat", "deepseek-coder"},
			"defaultConfig": map[string]interface{}{
				"temperature": 0.7,
				"maxTokens":   2000,
			},
		},
		{
			"provider":        "doubao",
			"name":            "豆包",
			"description":     "字节跳动豆包AI模型",
			"defaultBaseUrl":  "https://ark.cn-beijing.volces.com/api/v3",
			"supportedModels": []string{"doubao-seed-1-6-251015", "doubao-seedream-4-5-251128"},
			"defaultConfig": map[string]interface{}{
				"temperature": 0.7,
				"maxTokens":   2000,
			},
		},
		{
			"provider":       "qwen",
			"name":           "通义千问",
			"description":    "阿里云通义千问AI模型（OpenAI兼容模式）",
			"defaultBaseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
			"supportedModels": []string{
				// 通义千问模型列表（已升级至Qwen3系列，支持深度思考）
				"qwen-max",             // 通义千问Max：效果最好，适合复杂任务（支持深度思考）
				"qwen-plus",            // 通义千问Plus：效果、速度、成本均衡（支持深度思考）
				"qwen-flash",           // 通义千问Flash：速度最快、成本最低（支持深度思考）
				"qwen-turbo",           // 通义千问Turbo（推荐使用Flash替代）
				"qwen-max-longcontext", // 通义千问Max长上下文版本
				"qwen-vl-plus",         // 通义千问VL视觉语言模型
				"qwen-coder",           // 通义千问Coder代码模型
			},
			"defaultConfig": map[string]interface{}{
				"temperature": 0.7,
				"maxTokens":   2000,
			},
		},
		{
			"provider":       "zhipuai",
			"name":           "智谱AI GLM",
			"description":    "智谱AI GLM系列模型（支持深度思考和流式输出）",
			"defaultBaseUrl": "https://open.bigmodel.cn/api/paas/v4",
			"supportedModels": []string{
				// 智谱AI GLM模型列表
				"glm-4.7",             // 最新旗舰模型，支持复杂推理、超长上下文
				"glm-4.6",             // 旗舰模型，支持深度思考
				"glm-4.5-air",         // 轻量级模型
				"glm-4.5-airx",        // 增强版轻量模型
				"glm-4.5-flash",       // 快速响应模型
				"glm-4-flash-250414",  // 快速模型
				"glm-4-flashx-250414", // 增强版快速模型
			},
			"defaultConfig": map[string]interface{}{
				"temperature": 1.0,
				"maxTokens":   1024,
			},
		},
		{
			"provider":       "gpt",
			"name":           "GPT",
			"description":    "OpenAI GPT 系列模型（通过 OpenRouter 访问）",
			"defaultBaseUrl": "https://openrouter.ai/api/v1",
			"supportedModels": []string{
				"openai/gpt-oss-20b",
				"openai/gpt-oss-120b",
				"openai/gpt-4o-mini",
				"openai/gpt-4o",
			},
			"defaultConfig": map[string]interface{}{
				"temperature": 0.7,
				"maxTokens":   4096,
			},
		},
		{
			"provider":        "spark",
			"name":            "讯飞星火",
			"description":     "讯飞星火深度推理模型（OpenAI兼容接口）",
			"defaultBaseUrl":  "https://spark-api-open.xf-yun.com/v2",
			"supportedModels": []string{"spark-x"},
			"defaultConfig": map[string]interface{}{
				"temperature":  1.2,
				"topP":         0.95,
				"maxTokens":    65535,
				"thinkingType": "enabled",
			},
		},
		{
			"provider":        "hunyuan",
			"name":            "腾讯混元",
			"description":     "腾讯混元大模型（OpenAI兼容接口）",
			"defaultBaseUrl":  "https://api.hunyuan.cloud.tencent.com/v1",
			"supportedModels": []string{"hunyuan-turbos-latest"},
			"defaultConfig": map[string]interface{}{
				"temperature":       0.7,
				"maxTokens":         2000,
				"enableEnhancement": true,
			},
		},
		{
			"provider":       "gemini",
			"name":           "Google Gemini",
			"description":    "Google Gemini 系列模型（通过 OpenRouter 访问）",
			"defaultBaseUrl": "https://openrouter.ai/api/v1",
			"supportedModels": []string{
				"google/gemini-pro-1.5",
				"google/gemini-flash-1.5",
				"google/gemini-3-pro-preview",
			},
			"defaultConfig": map[string]interface{}{
				"temperature": 0.7,
				"maxTokens":   2000,
			},
		},
		{
			"provider":       "grok",
			"name":           "Grok",
			"description":    "xAI Grok 系列模型（通过 OpenRouter 访问）",
			"defaultBaseUrl": "https://openrouter.ai/api/v1",
			"supportedModels": []string{
				"x-ai/grok-4.1-fast",
				"x-ai/grok-4-fast",
				"x-ai/grok-code-fast-1",
				"x-ai/grok-4",
				"x-ai/grok-3-mini",
				"x-ai/grok-3",
				"x-ai/grok-3-mini-beta",
				"x-ai/grok-3-beta",
			},
			"defaultConfig": map[string]interface{}{
				"temperature": 0.7,
				"maxTokens":   4096,
			},
		},
	}, nil
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

	// 检查是否有Gemini预设配置
	if config.GeminiAPIKey != "" {
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
	// 验证提供商是否支持
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
	}
	if !supportedProviders[req.Provider] {
		return nil, fmt.Errorf("provider %s not supported yet", req.Provider)
	}

	// 加密API Key
	encryptedKey, err := utils.EncryptAPIKey(req.APIKey)
	if err != nil {
		return nil, ErrInvalidAPIKey
	}

	// 使用默认值
	baseURL := req.BaseURL
	if baseURL == nil {
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
		case "gemini", "gpt", "grok":
			defaultURL = "https://openrouter.ai/api/v1"
		default:
			defaultURL = "https://api.deepseek.com"
		}
		baseURL = &defaultURL
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

// toPersistenceModel 将领域实体转换为持久化实体
func toPersistenceModel(e *entity.AIModel) *models.AIModel {
	return &models.AIModel{
		ID:               e.ID,
		Name:             e.Name,
		Provider:         e.Provider,
		ModelName:        e.ModelName,
		APIKeyEncrypted:  e.APIKeyEncrypted,
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
