package tools

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRunCheckURLAccessibilityAcceptsReadableArticlePage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`
			<html>
				<head><title>关羽形象研究正文</title></head>
				<body>
					<article>
						<p>关羽形象在历代叙事中的变化非常明显，这里有足够长的正文内容用于抓取和分析。</p>
						<p>本页面不是搜索页，也不需要登录，适合作为工作流中的爬虫目标。</p>
					</article>
				</body>
			</html>
		`))
	}))
	defer server.Close()

	result, summary, err := runCheckURLAccessibility(map[string]interface{}{
		"url":          server.URL + "/article",
		"timeoutMs":    2000,
		"maxReadBytes": 4096,
	})
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if summary == "" {
		t.Fatalf("expected non-empty summary")
	}
	report, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected result type: %T", result)
	}
	if report["ok"] != true {
		t.Fatalf("expected article page to be accessible, got %#v", report)
	}
}

func TestRunCheckURLAccessibilityRejectsSearchPage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`
			<html>
				<head><title>搜索结果 - 关羽 形象</title></head>
				<body>
					<div>这是一个搜索结果页，不是正文详情页。</div>
				</body>
			</html>
		`))
	}))
	defer server.Close()

	result, _, err := runCheckURLAccessibility(map[string]interface{}{
		"url": server.URL + "/search?keyword=关羽",
	})
	if err != nil {
		t.Fatalf("expected tool to return report instead of error: %v", err)
	}
	report := result.(map[string]interface{})
	if report["ok"] == true {
		t.Fatalf("expected search page to be rejected")
	}
	if report["is_search_page"] != true {
		t.Fatalf("expected search page marker, got %#v", report)
	}
}

func TestRunCheckURLAccessibilityRequiresValidURL(t *testing.T) {
	_, _, err := runCheckURLAccessibility(map[string]interface{}{
		"url":       "not-a-valid-url",
		"timeoutMs": int((2 * time.Second).Milliseconds()),
	})
	if err == nil {
		t.Fatalf("expected invalid URL to fail")
	}
}
