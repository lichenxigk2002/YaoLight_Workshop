package services

import (
	"fmt"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/services/providers/deepseek"
	"yaolight-workshop/backend/modules/ai/services/providers/doubao"
	"yaolight-workshop/backend/modules/ai/services/providers/gemini"
	"yaolight-workshop/backend/modules/ai/services/providers/gpt"
	"yaolight-workshop/backend/modules/ai/services/providers/grok"
	"yaolight-workshop/backend/modules/ai/services/providers/hunyuan"
	"yaolight-workshop/backend/modules/ai/services/providers/qwen"
	"yaolight-workshop/backend/modules/ai/services/providers/spark"
	"yaolight-workshop/backend/modules/ai/services/providers/zhipuai"
)

// ProviderFactory 提供商工厂
type ProviderFactory struct {
	providers map[string]providers.AIProvider
}

// NewProviderFactory 创建提供商工厂
func NewProviderFactory() *ProviderFactory {
	factory := &ProviderFactory{
		providers: make(map[string]providers.AIProvider),
	}

	// 注册提供商
	factory.RegisterProvider("deepseek", deepseek.NewDeepSeekProvider())
	factory.RegisterProvider("doubao", doubao.NewDoubaoProvider())
	factory.RegisterProvider("gemini", gemini.NewGeminiProvider())
	factory.RegisterProvider("gpt", gpt.NewGPTProvider())
	factory.RegisterProvider("grok", grok.NewGrokProvider())
	factory.RegisterProvider("hunyuan", hunyuan.NewHunyuanProvider())
	factory.RegisterProvider("qwen", qwen.NewQwenProvider())
	factory.RegisterProvider("spark", spark.NewSparkProvider())
	factory.RegisterProvider("zhipuai", zhipuai.NewZhipuaiProvider())

	return factory
}

// RegisterProvider 注册提供商
func (f *ProviderFactory) RegisterProvider(name string, provider providers.AIProvider) {
	f.providers[name] = provider
}

// GetProvider 获取提供商
func (f *ProviderFactory) GetProvider(name string) (providers.AIProvider, error) {
	provider, ok := f.providers[name]
	if !ok {
		return nil, fmt.Errorf("provider %s not found", name)
	}
	return provider, nil
}
