package services

import (
	"fmt"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/utils"
)

// GetModelConfigForExecution 获取执行用的模型配置（支持三种模式）
func GetModelConfigForExecution(
	mode string,
	modelID uint,
	userID uint,
	customConfig map[string]interface{},
	modelRepo repository.AIModelRepository,
) (*providers.AIModelConfig, error) {
	switch mode {
	case "system":
		// 系统预设模型（从.env读取）
		return getSystemPresetConfig(customConfig)
	case "saved":
		// 用户保存的模型（从数据库读取）
		return getSavedModelConfig(modelID, userID, customConfig, modelRepo)
	case "custom":
		// 自定义配置（临时使用）
		return getCustomModelConfig(customConfig)
	default:
		return nil, fmt.Errorf("unknown model mode: %s", mode)
	}
}

// getSystemPresetConfig 获取系统预设模型配置
func getSystemPresetConfig(customConfig map[string]interface{}) (*providers.AIModelConfig, error) {
	// 从customConfig获取provider
	provider := normalizeProvider(getString(customConfig, "provider", "deepseek"))

	// 根据provider获取预设API Key
	var apiKey string
	switch provider {
	case "deepseek":
		apiKey = config.DeepSeekAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("系统未配置DeepSeek API Key，请在.env中配置DEEPSEEK_API_KEY")
		}
	case "doubao":
		apiKey = config.DoubaoAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("系统未配置豆包 API Key，请在.env中配置DOUBAO_API_KEY")
		}
	case "qwen":
		apiKey = config.QwenAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("系统未配置通义千问 API Key，请在.env中配置QWEN_API_KEY")
		}
	case "spark":
		apiKey = config.SparkAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("系统未配置讯飞星火 APIpassword，请在.env中配置SPARK_API_PASSWORD")
		}
	case "hunyuan":
		apiKey = config.HunyuanAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("系统未配置腾讯混元 API Key，请在.env中配置HUNYUAN_API_KEY")
		}
	case "zhipuai":
		apiKey = config.ZhipuaiAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("系统未配置智谱AI API Key，请在.env中配置ZHIPUAI_API_KEY")
		}
	case "claude", "gemini", "gpt", "grok":
		apiKey = config.GeminiAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("系统未配置OpenRouter API Key，请在.env中配置OPENROUTER_API_KEY")
		}
		// Claude 系统预设使用 anthropic/claude-sonnet-4.5
		if provider == "claude" && getString(customConfig, "modelName", "") == "deepseek-chat" {
			customConfig["modelName"] = "anthropic/claude-sonnet-4.5"
		}
		// Gemini 系统预设使用 google/gemini-3-pro-preview
		if provider == "gemini" && getString(customConfig, "modelName", "") == "deepseek-chat" {
			// 如果没有指定模型名称，或者使用了默认值，强制使用 Gemini 的默认模型
			customConfig["modelName"] = "google/gemini-3-pro-preview"
		}
		if provider == "gpt" && getString(customConfig, "modelName", "") == "deepseek-chat" {
			customConfig["modelName"] = "openai/gpt-oss-20b"
		}
		// Grok 系统预设使用 x-ai/grok-4.1-fast
		if provider == "grok" && getString(customConfig, "modelName", "") == "deepseek-chat" {
			customConfig["modelName"] = "x-ai/grok-4.1-fast"
		}
	default:
		return nil, fmt.Errorf("不支持的预设提供商: %s", provider)
	}

	// 构建配置
	config := &providers.AIModelConfig{
		Provider:     provider,
		ModelName:    getString(customConfig, "modelName", "deepseek-chat"),
		APIKey:       apiKey,
		BaseURL:      getString(customConfig, "baseUrl", getDefaultBaseURL(provider)),
		Temperature:  getFloat64Ptr(customConfig, "temperature"),
		MaxTokens:    getIntPtr(customConfig, "maxTokens"),
		TopP:         getFloat64Ptr(customConfig, "topP"),
		SystemPrompt: getString(customConfig, "systemPrompt", ""),
	}

	return config, nil
}

// getSavedModelConfig 获取用户保存的模型配置
func getSavedModelConfig(modelID uint, userID uint, customConfig map[string]interface{}, modelRepo repository.AIModelRepository) (*providers.AIModelConfig, error) {
	// 从数据库加载模型
	entity, err := modelRepo.FindByIDAndUser(modelID, userID)
	if err != nil {
		return nil, fmt.Errorf("加载模型失败: %w", err)
	}

	if !entity.IsActive() {
		return nil, fmt.Errorf("模型状态异常: %s", entity.Status)
	}

	// 解密API Key
	apiKey, err := utils.DecryptAPIKey(entity.APIKeyEncrypted)
	if err != nil {
		return nil, fmt.Errorf("解密API Key失败: %w", err)
	}

	// 构建配置
	config := &providers.AIModelConfig{
		Provider:         entity.Provider,
		ModelName:        entity.ModelName,
		APIKey:           apiKey,
		BaseURL:          getStringValue(entity.BaseURL),
		Endpoint:         getStringValue(entity.Endpoint),
		Temperature:      entity.Temperature,
		MaxTokens:        entity.MaxTokens,
		TopP:             entity.TopP,
		FrequencyPenalty: entity.FrequencyPenalty,
		PresencePenalty:  entity.PresencePenalty,
		SystemPrompt:     getStringValue(entity.SystemPrompt),
	}

	// 处理供应商级别配置：如果数据库中存的是 __provider_default__，则必须由 customConfig 提供实际模型名
	if config.ModelName == "__provider_default__" {
		if actualModel := getString(customConfig, "modelName", ""); actualModel != "" {
			config.ModelName = actualModel
		}
	}

	// 允许节点配置覆盖部分参数
	if temp := getFloat64Ptr(customConfig, "temperature"); temp != nil {
		config.Temperature = temp
	}
	if maxTokens := getIntPtr(customConfig, "maxTokens"); maxTokens != nil {
		config.MaxTokens = maxTokens
	}
	if topP := getFloat64Ptr(customConfig, "topP"); topP != nil {
		config.TopP = topP
	}

	return config, nil
}

// getCustomModelConfig 获取自定义模型配置
func getCustomModelConfig(customConfig map[string]interface{}) (*providers.AIModelConfig, error) {
	provider := normalizeProvider(getString(customConfig, "provider", ""))
	modelName := getString(customConfig, "modelName", "")
	apiKey := getString(customConfig, "apiKey", "")

	if provider == "" || modelName == "" || apiKey == "" {
		return nil, fmt.Errorf("自定义配置缺少必填字段: provider, modelName, apiKey")
	}

	return &providers.AIModelConfig{
		Provider:         provider,
		ModelName:        modelName,
		APIKey:           apiKey,
		BaseURL:          getString(customConfig, "baseUrl", ""),
		Endpoint:         getString(customConfig, "endpoint", ""),
		Temperature:      getFloat64Ptr(customConfig, "temperature"),
		MaxTokens:        getIntPtr(customConfig, "maxTokens"),
		TopP:             getFloat64Ptr(customConfig, "topP"),
		FrequencyPenalty: getFloat64Ptr(customConfig, "frequencyPenalty"),
		PresencePenalty:  getFloat64Ptr(customConfig, "presencePenalty"),
		SystemPrompt:     getString(customConfig, "systemPrompt", ""),
	}, nil
}

// 辅助函数
func getString(m map[string]interface{}, key, defaultValue string) string {
	if v, ok := m[key].(string); ok && v != "" {
		return v
	}
	return defaultValue
}

func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func getFloat64Ptr(m map[string]interface{}, key string) *float64 {
	if v, ok := m[key].(float64); ok {
		return &v
	}
	return nil
}

func getIntPtr(m map[string]interface{}, key string) *int {
	if v, ok := m[key].(float64); ok {
		i := int(v)
		return &i
	}
	return nil
}

// getDefaultBaseURL 根据提供商获取默认BaseURL
func getDefaultBaseURL(provider string) string {
	switch provider {
	case "deepseek":
		return "https://api.deepseek.com"
	case "doubao":
		return "https://ark.cn-beijing.volces.com/api/v3"
	case "qwen":
		return "https://dashscope.aliyuncs.com/compatible-mode/v1"
	case "spark":
		return "https://spark-api-open.xf-yun.com/v2"
	case "zhipuai":
		return "https://open.bigmodel.cn/api/paas/v4"
	case "hunyuan":
		return "https://api.hunyuan.cloud.tencent.com/v1"
	case "claude", "gemini", "gpt", "grok":
		return "https://openrouter.ai/api/v1"
	default:
		return ""
	}
}
