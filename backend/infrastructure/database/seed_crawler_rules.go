package database

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	crawlerModels "yaolight-workshop/backend/modules/crawler/models"
)

// SeedCrawlerRules 写入一组平台级通用爬虫规则，便于测试/正式环境直接验证规则中心与工作流复用。
// 启动时仅补齐缺失规则，不覆盖已有平台规则配置。
func SeedCrawlerRules() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	seeds := []crawlerModels.CrawlerRule{
		{
			Name:           "通用正文抽取（文章页）",
			Description:    stringPtr("适合新闻、博客、帮助中心等正文页。优先按文章模式抽取标题与正文，兼容常见 article/main/content 结构。"),
			Version:        "1.0.0",
			URLPattern:     stringPtr(`^https?://.+`),
			URLPatternType: "regex",
			Method:         "GET",
			Headers:        shared.JSONB{Data: map[string]interface{}{}},
			Params:         shared.JSONB{Data: map[string]interface{}{}},
			Selectors: shared.JSONB{Data: map[string]interface{}{
				"primary":           "article, main, .article-content, .post-content, .entry-content, .content",
				"fallback":          []interface{}{".article", ".post", "#content", "#main", "body"},
				"wait_for_selector": "article, main, .article-content, .post-content, .entry-content, .content",
			}},
			DataExtraction: jsonbPtr(map[string]interface{}{
				"mode":         "article",
				"extract_type": "html",
				"smart_mode":   false,
			}),
			Timeout:           30,
			RetryCount:        2,
			RetryDelay:        1,
			FollowRedirects:   true,
			VerifySSL:         true,
			WaitTime:          0,
			JavaScriptEnabled: false,
			Screenshot:        false,
			IsActive:          true,
		},
		{
			Name:           "通用链接列表抽取（导航/目录页）",
			Description:    stringPtr("适合频道页、聚合页、目录页。按 links 模式抽取页面链接，便于后续工作流做二次遍历。"),
			Version:        "1.0.0",
			URLPattern:     stringPtr(`^https?://.+`),
			URLPatternType: "regex",
			Method:         "GET",
			Headers:        shared.JSONB{Data: map[string]interface{}{}},
			Params:         shared.JSONB{Data: map[string]interface{}{}},
			Selectors: shared.JSONB{Data: map[string]interface{}{
				"primary":           "a[href]",
				"wait_for_selector": "body",
			}},
			DataExtraction: jsonbPtr(map[string]interface{}{
				"mode":         "links",
				"extract_type": "link",
				"smart_mode":   false,
			}),
			Timeout:           20,
			RetryCount:        2,
			RetryDelay:        1,
			FollowRedirects:   true,
			VerifySSL:         true,
			WaitTime:          0,
			JavaScriptEnabled: false,
			Screenshot:        false,
			IsActive:          true,
		},
		{
			Name:           "通用动态正文抽取（JS 页面）",
			Description:    stringPtr("适合前端渲染页面。启用 Headless，等待正文容器出现后再按文章模式抽取内容。"),
			Version:        "1.0.0",
			URLPattern:     stringPtr(`^https?://.+`),
			URLPatternType: "regex",
			Method:         "GET",
			Headers:        shared.JSONB{Data: map[string]interface{}{}},
			Params:         shared.JSONB{Data: map[string]interface{}{}},
			Selectors: shared.JSONB{Data: map[string]interface{}{
				"primary":           "article, main, .article-content, .post-content, .entry-content, .content",
				"fallback":          []interface{}{".article", ".post", "#content", "#main", "body"},
				"wait_for_selector": "article, main, .article-content, .post-content, .entry-content, .content",
			}},
			DataExtraction: jsonbPtr(map[string]interface{}{
				"mode":         "article",
				"extract_type": "html",
				"smart_mode":   false,
			}),
			Timeout:           45,
			RetryCount:        2,
			RetryDelay:        1,
			FollowRedirects:   true,
			VerifySSL:         true,
			WaitTime:          3,
			JavaScriptEnabled: true,
			Screenshot:        false,
			IsActive:          true,
		},
	}

	for _, seed := range seeds {
		if err := upsertCrawlerRuleSeed(seed); err != nil {
			return err
		}
	}

	return nil
}

func upsertCrawlerRuleSeed(seed crawlerModels.CrawlerRule) error {
	var existing crawlerModels.CrawlerRule
	err := DB.Unscoped().
		Where("name = ? AND created_by IS NULL", seed.Name).
		First(&existing).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return DB.Create(&seed).Error
	}
	if err != nil {
		return err
	}
	return nil
}

func stringPtr(value string) *string {
	return &value
}

func jsonbPtr(value interface{}) *shared.JSONB {
	return &shared.JSONB{Data: value}
}
