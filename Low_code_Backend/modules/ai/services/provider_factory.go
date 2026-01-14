package services

import (
	"fmt"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/services/providers/deepseek"
	"yaolight-workshop/backend/modules/ai/services/providers/doubao"
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
