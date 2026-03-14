package tools

import (
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var (
	titleTagRe    = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	scriptTagRe   = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	styleTagRe    = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
	noScriptTagRe = regexp.MustCompile(`(?is)<noscript[^>]*>.*?</noscript>`)
	htmlTagRe     = regexp.MustCompile(`(?is)<[^>]+>`)
	spaceRe       = regexp.MustCompile(`\s+`)
)

func toolCheckURLAccessibility(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return runCheckURLAccessibility(params)
}

func (r *Registry) runCheckURLAccessibility(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return runCheckURLAccessibility(params)
}

func runCheckURLAccessibility(params map[string]interface{}) (result interface{}, resultSummary string, err error) {
	rawURL, ok := params["url"].(string)
	if !ok || strings.TrimSpace(rawURL) == "" {
		return nil, "", fmt.Errorf("url 参数不能为空")
	}

	timeout := 8 * time.Second
	if v := intParam(params, "timeoutMs"); v > 0 {
		timeout = time.Duration(v) * time.Millisecond
	}

	maxReadBytes := 64 * 1024
	if v := intParam(params, "maxReadBytes"); v > 0 {
		maxReadBytes = v
	}

	report, err := inspectURLAccessibility(rawURL, timeout, maxReadBytes)
	if err != nil {
		return nil, "", err
	}

	summary := reportSummary(report)
	return report, summary, nil
}

func inspectURLAccessibility(rawURL string, timeout time.Duration, maxReadBytes int) (map[string]interface{}, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("无效 URL: %s", rawURL)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("暂不支持的 URL 协议: %s", parsed.Scheme)
	}

	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequest("GET", parsed.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "YaoLightBot/1.0 (+workflow-url-check)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("访问失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, int64(maxReadBytes)))
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	bodyText := string(body)
	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	finalURL := resp.Request.URL.String()
	title := extractTitle(bodyText)
	extractableText := extractReadableText(bodyText)
	extractableTextLength := len([]rune(extractableText))
	isHTML := strings.Contains(contentType, "text/html") || strings.Contains(strings.ToLower(bodyText), "<html")
	isSearchPage := detectSearchPage(finalURL, title, extractableText)
	needsLogin := detectLoginPage(finalURL, title, extractableText)
	likelyJSHeavy := detectJSHeavyPage(isHTML, bodyText, extractableTextLength)

	ok := resp.StatusCode >= 200 && resp.StatusCode < 300 && isHTML && !isSearchPage && !needsLogin && !likelyJSHeavy && extractableTextLength >= 60

	reason := buildAccessibilityReason(resp.StatusCode, isHTML, isSearchPage, needsLogin, likelyJSHeavy, extractableTextLength)
	suggestion := buildAccessibilitySuggestion(isHTML, isSearchPage, needsLogin, likelyJSHeavy, extractableTextLength)

	report := map[string]interface{}{
		"url":                     rawURL,
		"ok":                      ok,
		"status_code":             resp.StatusCode,
		"final_url":               finalURL,
		"content_type":            contentType,
		"content_length":          max(resp.ContentLength, int64(len(body))),
		"page_title":              title,
		"is_html":                 isHTML,
		"is_search_page":          isSearchPage,
		"needs_login":             needsLogin,
		"likely_js_heavy":         likelyJSHeavy,
		"extractable_text_length": extractableTextLength,
		"reason":                  reason,
		"suggestion":              suggestion,
	}
	return report, nil
}

func extractTitle(body string) string {
	matches := titleTagRe.FindStringSubmatch(body)
	if len(matches) < 2 {
		return ""
	}
	return strings.TrimSpace(spaceRe.ReplaceAllString(html.UnescapeString(matches[1]), " "))
}

func extractReadableText(body string) string {
	clean := scriptTagRe.ReplaceAllString(body, " ")
	clean = styleTagRe.ReplaceAllString(clean, " ")
	clean = noScriptTagRe.ReplaceAllString(clean, " ")
	clean = htmlTagRe.ReplaceAllString(clean, " ")
	clean = html.UnescapeString(clean)
	clean = spaceRe.ReplaceAllString(clean, " ")
	return strings.TrimSpace(clean)
}

func detectSearchPage(finalURL, title, text string) bool {
	combined := strings.ToLower(finalURL + " " + title)
	keywords := []string{
		"/search", "search?", "keyword=", "query=", "检索", "搜索", "搜索结果", "检索结果",
	}
	for _, keyword := range keywords {
		if strings.Contains(combined, keyword) {
			return true
		}
	}
	return false
}

func detectLoginPage(finalURL, title, text string) bool {
	combined := strings.ToLower(finalURL + " " + title)
	keywords := []string{
		"login", "sign in", "signin", "passport", "验证码", "登录", "注册", "扫码登录", "手机号登录",
	}
	for _, keyword := range keywords {
		if strings.Contains(combined, keyword) {
			return true
		}
	}
	lowerText := strings.ToLower(text)
	if strings.Contains(lowerText, "type=password") || strings.Contains(lowerText, "name=password") {
		return true
	}
	return false
}

func detectJSHeavyPage(isHTML bool, body string, extractableTextLength int) bool {
	if !isHTML {
		return false
	}
	if extractableTextLength >= 80 {
		return false
	}
	lower := strings.ToLower(body)
	scriptCount := strings.Count(lower, "<script")
	return scriptCount >= 3 || strings.Contains(lower, "__next_data__") || strings.Contains(lower, "window.__") || strings.Contains(lower, "webpack")
}

func buildAccessibilityReason(statusCode int, isHTML, isSearchPage, needsLogin, likelyJSHeavy bool, extractableTextLength int) string {
	switch {
	case statusCode < 200 || statusCode >= 300:
		return fmt.Sprintf("页面返回状态码 %d", statusCode)
	case !isHTML:
		return "目标页面不是可直接提取正文的 HTML 页面"
	case isSearchPage:
		return "目标链接更像搜索页或检索入口，不是正文详情页"
	case needsLogin:
		return "目标页面需要登录或包含明显登录限制"
	case likelyJSHeavy:
		return "目标页面依赖前端脚本渲染，直接抓取正文的成功率较低"
	case extractableTextLength < 80:
		return fmt.Sprintf("可提取正文过少，当前仅检测到约 %d 字", extractableTextLength)
	default:
		return fmt.Sprintf("页面可直接访问，可提取正文约 %d 字", extractableTextLength)
	}
}

func buildAccessibilitySuggestion(isHTML, isSearchPage, needsLogin, likelyJSHeavy bool, extractableTextLength int) string {
	switch {
	case !isHTML:
		return "请换成直接正文页链接，而不是下载流、附件或非 HTML 链接"
	case isSearchPage:
		return "请换成文章详情页、词条页或正文页链接，不要使用搜索结果页"
	case needsLogin:
		return "请换成无需登录即可访问的公开页面"
	case likelyJSHeavy:
		return "请换成静态正文页，或使用更易抓取的公开来源"
	case extractableTextLength < 80:
		return "请换成正文更完整的页面，避免目录页、摘要页或跳转页"
	default:
		return "该链接适合作为 crawler 节点的数据源"
	}
}

func reportSummary(report map[string]interface{}) string {
	ok, _ := report["ok"].(bool)
	reason, _ := report["reason"].(string)
	if ok {
		return "URL 可访问，适合作为爬虫数据源"
	}
	if reason == "" {
		return "URL 预检未通过"
	}
	return "URL 预检未通过: " + reason
}

func intParam(params map[string]interface{}, key string) int {
	switch v := params[key].(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
