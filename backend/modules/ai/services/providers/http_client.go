package providers

import (
	"net/http"
	"net/url"
	"time"
	"yaolight-workshop/backend/infrastructure/config"
)

const DefaultHTTPTimeout = 12 * time.Minute

func NewHTTPClient() *http.Client {
	return &http.Client{Timeout: DefaultHTTPTimeout}
}

func NewHTTPClientWithProxy(proxyURL string) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()

	if proxyURL != "" {
		if parsed, err := url.Parse(proxyURL); err == nil {
			transport.Proxy = http.ProxyURL(parsed)
		}
	}

	return &http.Client{
		Timeout:   DefaultHTTPTimeout,
		Transport: transport,
	}
}

func NewHTTPClientForProvider(provider string) *http.Client {
	proxyURL := resolveProviderProxyURL(provider)
	if proxyURL == "" {
		return NewHTTPClient()
	}
	return NewHTTPClientWithProxy(proxyURL)
}

func resolveProviderProxyURL(provider string) string {
	switch provider {
	case "gpt":
		if config.GPTProxyURL != "" {
			return config.GPTProxyURL
		}
	case "claude":
		if config.ClaudeProxyURL != "" {
			return config.ClaudeProxyURL
		}
	case "gemini":
		if config.GeminiProxyURL != "" {
			return config.GeminiProxyURL
		}
	case "grok":
		if config.GrokProxyURL != "" {
			return config.GrokProxyURL
		}
	}

	if config.OpenRouterProxyURL != "" {
		return config.OpenRouterProxyURL
	}

	return config.AIHTTPProxyURL
}
