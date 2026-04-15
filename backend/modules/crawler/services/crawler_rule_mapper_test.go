package services

import (
	"testing"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/crawler/models"
)

func TestMapRuleToCrawlerConfig(t *testing.T) {
	userAgent := "RuleBot/1.0"

	rule := &models.CrawlerRule{
		Method:            "post",
		Headers:           shared.JSONB{Data: map[string]interface{}{"Authorization": "Bearer token"}},
		Cookies:           &shared.JSONB{Data: map[string]interface{}{"session_id": "abc"}},
		Timeout:           45,
		RetryCount:        5,
		RetryDelay:        2,
		WaitTime:          6,
		FollowRedirects:   true,
		VerifySSL:         false,
		JavaScriptEnabled: true,
		UserAgent:         &userAgent,
		Selectors: shared.JSONB{Data: map[string]interface{}{
			"primary":           ".article",
			"wait_for_selector": ".article-ready",
		}},
		DataExtraction: &shared.JSONB{Data: map[string]interface{}{
			"mode":         "custom",
			"extract_type": "attr",
			"extract_attr": "href",
			"smart_mode":   false,
		}},
		ProxyConfig: &shared.JSONB{Data: map[string]interface{}{
			"enabled": true,
			"url":     "http://127.0.0.1:7890",
		}},
		Pagination: &shared.JSONB{Data: map[string]interface{}{
			"enabled":    true,
			"selector":   ".next",
			"max_pages":  8,
			"page_param": "page",
			"start_page": 2,
			"increment":  1,
		}},
		Body: &shared.JSONB{Data: map[string]interface{}{
			"keyword": "yaolight",
		}},
	}

	config, err := MapRuleToCrawlerConfig(rule)
	if err != nil {
		t.Fatalf("MapRuleToCrawlerConfig returned error: %v", err)
	}

	if config.Method != "POST" {
		t.Fatalf("expected method POST, got %q", config.Method)
	}
	if config.UserAgent != userAgent {
		t.Fatalf("expected userAgent %q, got %q", userAgent, config.UserAgent)
	}
	if config.Selector != ".article" {
		t.Fatalf("expected selector .article, got %q", config.Selector)
	}
	if config.WaitForSelector != ".article-ready" {
		t.Fatalf("expected waitForSelector .article-ready, got %q", config.WaitForSelector)
	}
	if config.ExtractMode != "custom" {
		t.Fatalf("expected extractMode custom, got %q", config.ExtractMode)
	}
	if config.ExtractType != "attr" {
		t.Fatalf("expected extractType attr, got %q", config.ExtractType)
	}
	if config.ExtractAttr != "href" {
		t.Fatalf("expected extractAttr href, got %q", config.ExtractAttr)
	}
	if config.Proxy != "http://127.0.0.1:7890" {
		t.Fatalf("expected proxy to be mapped, got %q", config.Proxy)
	}
	if !config.UseHeadless {
		t.Fatal("expected UseHeadless true")
	}
	if config.JavaScriptWait != 6 {
		t.Fatalf("expected JavaScriptWait 6, got %d", config.JavaScriptWait)
	}
	if config.Pagination == nil || !config.Pagination.Enabled {
		t.Fatal("expected pagination to be enabled")
	}
	if config.Pagination.Selector != ".next" {
		t.Fatalf("expected pagination selector .next, got %q", config.Pagination.Selector)
	}
	if config.BodyType != "json" {
		t.Fatalf("expected bodyType json, got %q", config.BodyType)
	}
	if config.Headers["Authorization"] != "Bearer token" {
		t.Fatalf("expected headers to be mapped, got %#v", config.Headers)
	}
	if config.Cookies["session_id"] != "abc" {
		t.Fatalf("expected cookies to be mapped, got %#v", config.Cookies)
	}
}

func TestMergeCrawlerConfigOverride(t *testing.T) {
	base := CrawlerConfig{
		URL:            "https://example.com/base",
		Method:         "GET",
		Selector:       ".base",
		UserAgent:      "BaseUA",
		Timeout:        30,
		Headers:        map[string]string{"Authorization": "Bearer base"},
		Cookies:        map[string]string{"session_id": "base-session"},
		Proxy:          "http://base-proxy",
		RetryCount:     3,
		RetryDelay:     1,
		WaitTime:       0,
		ExtractType:    "text",
		ExtractMode:    "article",
		FollowRedirect: true,
		VerifySSL:      true,
		Pagination: &PaginationConfig{
			Enabled:   true,
			Selector:  ".next-base",
			MaxPages:  3,
			PageParam: "page",
			StartPage: 1,
			Increment: 1,
		},
	}

	override := map[string]interface{}{
		"url":         "https://example.com/override",
		"method":      "post",
		"selector":    ".override",
		"timeout":     55,
		"retry_count": 6,
		"headers": map[string]interface{}{
			"X-Trace": "trace-id",
		},
		"cookies": map[string]interface{}{
			"tenant": "yaolight",
		},
		"proxy_config": map[string]interface{}{
			"enabled": false,
		},
		"data_extraction": map[string]interface{}{
			"mode":         "custom",
			"extract_type": "html",
			"extract_attr": "data-id",
		},
		"pagination": map[string]interface{}{
			"enabled":    true,
			"selector":   ".next-override",
			"max_pages":  7,
			"page_param": "p",
			"start_page": 2,
			"increment":  2,
		},
	}

	merged, err := MergeCrawlerConfig(base, override)
	if err != nil {
		t.Fatalf("MergeCrawlerConfig returned error: %v", err)
	}

	if merged.URL != "https://example.com/override" {
		t.Fatalf("expected URL override, got %q", merged.URL)
	}
	if merged.Method != "POST" {
		t.Fatalf("expected method POST, got %q", merged.Method)
	}
	if merged.Selector != ".override" {
		t.Fatalf("expected selector override, got %q", merged.Selector)
	}
	if merged.Timeout != 55 {
		t.Fatalf("expected timeout 55, got %d", merged.Timeout)
	}
	if merged.RetryCount != 6 {
		t.Fatalf("expected retryCount 6, got %d", merged.RetryCount)
	}
	if merged.Headers["Authorization"] != "Bearer base" || merged.Headers["X-Trace"] != "trace-id" {
		t.Fatalf("expected merged headers, got %#v", merged.Headers)
	}
	if merged.Cookies["session_id"] != "base-session" || merged.Cookies["tenant"] != "yaolight" {
		t.Fatalf("expected merged cookies, got %#v", merged.Cookies)
	}
	if merged.Proxy != "" {
		t.Fatalf("expected proxy to be cleared, got %q", merged.Proxy)
	}
	if merged.ExtractMode != "custom" {
		t.Fatalf("expected extractMode custom, got %q", merged.ExtractMode)
	}
	if merged.ExtractType != "html" {
		t.Fatalf("expected extractType html, got %q", merged.ExtractType)
	}
	if merged.ExtractAttr != "data-id" {
		t.Fatalf("expected extractAttr data-id, got %q", merged.ExtractAttr)
	}
	if merged.Pagination == nil {
		t.Fatal("expected pagination to exist")
	}
	if merged.Pagination.Selector != ".next-override" || merged.Pagination.MaxPages != 7 || merged.Pagination.PageParam != "p" {
		t.Fatalf("expected pagination override, got %#v", merged.Pagination)
	}
}
