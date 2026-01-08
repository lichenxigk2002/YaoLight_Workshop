package services

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html/charset"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

// CrawlerService 爬虫服务
type CrawlerService struct{}

// CrawlerConfig 爬虫配置
type CrawlerConfig struct {
	URL             string            `json:"url"`             // 目标URL
	Method          string            `json:"method"`          // HTTP方法：GET, POST, PUT, DELETE
	Selector        string            `json:"selector"`        // CSS选择器
	UserAgent       string            `json:"userAgent"`       // User-Agent
	Timeout         int               `json:"timeout"`         // 超时时间（秒）
	Headers         map[string]string `json:"headers"`         // 自定义请求头
	Body            string            `json:"body"`            // 请求体（POST/PUT）
	BodyType        string            `json:"bodyType"`        // 请求体类型：json, form, xml, text
	Cookies         map[string]string `json:"cookies"`         // Cookie键值对
	Proxy           string            `json:"proxy"`           // 代理地址：http://proxy:port
	RetryCount      int               `json:"retryCount"`      // 重试次数
	RetryDelay      int               `json:"retryDelay"`      // 重试延迟（秒）
	WaitTime        int               `json:"waitTime"`        // 请求后等待时间（秒）
	FollowRedirect  bool              `json:"followRedirect"`  // 是否跟随重定向
	VerifySSL       bool              `json:"verifySSL"`       // 是否验证SSL证书
	ExtractType     string            `json:"extractType"`     // 提取类型：text, html, attr, link, image, all
	ExtractAttr     string            `json:"extractAttr"`     // 提取的属性名（当extractType为attr时）
	Pagination      *PaginationConfig `json:"pagination"`      // 分页配置
	Encoding        string            `json:"encoding"`        // 页面编码：auto, utf-8, gbk, gb2312
	SmartMode       bool              `json:"smartMode"`       // 智能模式：自动检测主要内容
	ExtractMode     string            `json:"extractMode"`     // 提取模式：smart(智能), article(文章), list(列表), links(链接), images(图片)
	JavaScriptWait  int               `json:"javascriptWait"`  // JavaScript等待时间（秒），用于等待动态内容加载
	WaitForSelector string            `json:"waitForSelector"` // 等待选择器出现（无头浏览器模式）
	UseHeadless     bool              `json:"useHeadless"`     // 是否使用无头浏览器（用于SPA应用）
	DisableImages   bool              `json:"disableImages"`   // 禁用图片加载（提升速度，仅无头浏览器模式）
}

// PaginationConfig 分页配置
type PaginationConfig struct {
	Enabled   bool   `json:"enabled"`   // 是否启用分页
	Selector  string `json:"selector"`  // 下一页链接选择器
	MaxPages  int    `json:"maxPages"`  // 最大页数
	PageParam string `json:"pageParam"` // 页码参数名（如：page, p）
	StartPage int    `json:"startPage"` // 起始页码
	Increment int    `json:"increment"` // 页码增量
}

// CrawlerResult 爬虫执行结果
type CrawlerResult struct {
	Success      bool                   `json:"success"`
	Data         interface{}            `json:"data"`
	RawHTML      string                 `json:"raw_html,omitempty"`
	Error        string                 `json:"error,omitempty"`
	Extracted    map[string]interface{} `json:"extracted,omitempty"`
	StatusCode   int                    `json:"status_code,omitempty"`
	ResponseTime int64                  `json:"response_time,omitempty"` // 响应时间（毫秒）
	URL          string                 `json:"url,omitempty"`           // 最终请求的URL（可能经过重定向）
	Cookies      map[string]string      `json:"cookies,omitempty"`       // 响应中的Cookie
	Pages        []PageResult           `json:"pages,omitempty"`         // 分页结果
}

// PageResult 单页结果
type PageResult struct {
	Page      int                    `json:"page"`
	URL       string                 `json:"url"`
	Data      interface{}            `json:"data"`
	Extracted map[string]interface{} `json:"extracted,omitempty"`
}

// NewCrawlerService 创建爬虫服务
func NewCrawlerService() *CrawlerService {
	return &CrawlerService{}
}

// Execute 执行爬虫任务
func (s *CrawlerService) Execute(config CrawlerConfig) (*CrawlerResult, error) {
	// 设置默认值
	if config.Method == "" {
		config.Method = "GET"
	}
	if config.Timeout == 0 {
		config.Timeout = 30
	}
	if config.UserAgent == "" {
		config.UserAgent = s.getRandomUserAgent()
	}
	if config.RetryCount == 0 {
		config.RetryCount = 3
	}
	if config.RetryDelay == 0 {
		config.RetryDelay = 1
	}
	// FollowRedirect 默认为 true
	if !config.FollowRedirect {
		config.FollowRedirect = false
	} else {
		config.FollowRedirect = true
	}
	// VerifySSL 默认为 true
	if !config.VerifySSL {
		config.VerifySSL = false
	} else {
		config.VerifySSL = true
	}
	if config.ExtractType == "" {
		config.ExtractType = "text"
	}
	if config.Encoding == "" {
		config.Encoding = "auto"
	}

	// 如果启用无头浏览器模式，使用chromedp
	if config.UseHeadless {
		log.Printf("使用无头浏览器模式爬取SPA应用: %s", config.URL)
		return s.executeWithHeadless(config)
	}

	// 如果有分页配置，执行分页爬取
	if config.Pagination != nil && config.Pagination.Enabled {
		return s.executeWithPagination(config)
	}

	// 执行单页爬取（带重试）
	var result *CrawlerResult
	var err error
	startTime := time.Now()

	for attempt := 0; attempt <= config.RetryCount; attempt++ {
		if attempt > 0 {
			// 重试前等待
			time.Sleep(time.Duration(config.RetryDelay) * time.Second)
		}

		result, err = s.executeSinglePage(config)
		if err == nil && result.Success {
			break
		}
	}

	if err != nil {
		return &CrawlerResult{
			Success: false,
			Error:   err.Error(),
		}, err
	}

	// 计算响应时间
	result.ResponseTime = time.Since(startTime).Milliseconds()

	// 等待时间
	if config.WaitTime > 0 {
		time.Sleep(time.Duration(config.WaitTime) * time.Second)
	}

	return result, nil
}

// executeWithHeadless 使用无头浏览器执行爬取
func (s *CrawlerService) executeWithHeadless(config CrawlerConfig) (*CrawlerResult, error) {
	startTime := time.Now()

	// 创建无头浏览器爬虫
	headless := NewHeadlessCrawler()

	// 构建无头浏览器配置
	headlessConfig := HeadlessConfig{
		URL:             config.URL,
		WaitForSelector: config.WaitForSelector,
		WaitTime:        time.Duration(config.JavaScriptWait) * time.Second,
		Timeout:         time.Duration(config.Timeout) * time.Second,
		UserAgent:       config.UserAgent,
		DisableImages:   config.DisableImages,
	}

	// 使用无头浏览器获取页面内容
	rawHTML, err := headless.FetchWithHeadless(headlessConfig)
	if err != nil {
		return &CrawlerResult{
			Success: false,
			Error:   fmt.Sprintf("无头浏览器获取页面失败: %v", err),
		}, err
	}

	log.Printf("无头浏览器成功获取页面，HTML长度: %d", len(rawHTML))

	// 使用goquery解析HTML
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(rawHTML))
	if err != nil {
		return &CrawlerResult{
			Success: false,
			Error:   fmt.Sprintf("解析HTML失败: %v", err),
			RawHTML: rawHTML,
		}, err
	}

	// 智能模式或选择器为空时，自动检测并提取内容
	var extracted map[string]interface{}
	if config.SmartMode || config.Selector == "" {
		extracted = s.smartExtract(doc, config)
	} else {
		extracted = s.extractData(doc, config)
	}

	// 添加无头浏览器标记
	extracted["headless_mode"] = true
	extracted["javascript_executed"] = true

	return &CrawlerResult{
		Success:      true,
		Data:         extracted,
		Extracted:    extracted,
		RawHTML:      rawHTML,
		URL:          config.URL,
		ResponseTime: time.Since(startTime).Milliseconds(),
	}, nil
}

// executeSinglePage 执行单页爬取
func (s *CrawlerService) executeSinglePage(config CrawlerConfig) (*CrawlerResult, error) {
	// 创建Cookie Jar
	jar, err := cookiejar.New(nil)
	if err != nil {
		return &CrawlerResult{
			Success: false,
			Error:   fmt.Sprintf("创建Cookie Jar失败: %v", err),
		}, err
	}

	// 配置HTTP客户端
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: !config.VerifySSL,
		},
	}

	// 配置代理
	if config.Proxy != "" {
		proxyURL, err := url.Parse(config.Proxy)
		if err != nil {
			return &CrawlerResult{
				Success: false,
				Error:   fmt.Sprintf("代理地址格式错误: %v", err),
			}, err
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	client := &http.Client{
		Timeout:   time.Duration(config.Timeout) * time.Second,
		Jar:       jar,
		Transport: transport,
	}

	// 配置重定向
	if !config.FollowRedirect {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	// 创建请求体
	var bodyReader io.Reader
	if config.Body != "" && (config.Method == "POST" || config.Method == "PUT" || config.Method == "PATCH") {
		bodyReader = strings.NewReader(config.Body)
	}

	// 创建请求
	req, err := http.NewRequest(config.Method, config.URL, bodyReader)
	if err != nil {
		return &CrawlerResult{
			Success: false,
			Error:   fmt.Sprintf("创建请求失败: %v", err),
		}, err
	}

	// 设置User-Agent
	req.Header.Set("User-Agent", config.UserAgent)

	// 设置Content-Type
	if config.Body != "" {
		switch config.BodyType {
		case "json":
			req.Header.Set("Content-Type", "application/json")
		case "form":
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		case "xml":
			req.Header.Set("Content-Type", "application/xml")
		case "text":
			req.Header.Set("Content-Type", "text/plain")
		default:
			req.Header.Set("Content-Type", "application/json")
		}
	}

	// 设置自定义Headers（会覆盖默认值）
	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	// 设置Cookie
	if len(config.Cookies) > 0 {
		for key, value := range config.Cookies {
			req.AddCookie(&http.Cookie{
				Name:  key,
				Value: value,
			})
		}
	}

	// 执行请求
	resp, err := client.Do(req)
	if err != nil {
		return &CrawlerResult{
			Success: false,
			Error:   fmt.Sprintf("请求失败: %v", err),
		}, err
	}
	defer resp.Body.Close()

	// 记录最终URL（可能经过重定向）
	finalURL := resp.Request.URL.String()

	// 提取响应Cookie
	responseCookies := make(map[string]string)
	for _, cookie := range resp.Cookies() {
		responseCookies[cookie.Name] = cookie.Value
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &CrawlerResult{
			Success:    false,
			Error:      fmt.Sprintf("读取响应失败: %v", err),
			StatusCode: resp.StatusCode,
		}, err
	}

	// 处理编码
	body, err = s.decodeBody(body, config.Encoding, resp.Header.Get("Content-Type"))
	if err != nil {
		return &CrawlerResult{
			Success:    false,
			Error:      fmt.Sprintf("解码失败: %v", err),
			StatusCode: resp.StatusCode,
		}, err
	}

	rawHTML := string(body)

	// 检查状态码（允许2xx和3xx）
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		errorMsg := s.getErrorMessage(resp.StatusCode, config.Method)
		return &CrawlerResult{
			Success:    false,
			Error:      errorMsg,
			StatusCode: resp.StatusCode,
			RawHTML:    rawHTML,
		}, fmt.Errorf(errorMsg)
	}

	// 检测是否为JavaScript渲染的页面（包含加载组件）
	// 如果检测到加载组件，等待一段时间让JavaScript执行
	if s.isLoadingPage(rawHTML) {
		waitTime := config.JavaScriptWait
		if waitTime == 0 {
			waitTime = 5 // 默认等待5秒
		}
		log.Printf("检测到加载组件，等待 %d 秒让JavaScript执行...", waitTime)
		time.Sleep(time.Duration(waitTime) * time.Second)

		// 注意：这只是简单方案，真正的SPA需要无头浏览器
		// 这里我们只是等待，然后提示用户可能需要使用无头浏览器
		log.Printf("等待完成，但请注意：如果内容仍未加载，可能需要使用无头浏览器（如Chrome Headless）")
	}

	// 使用goquery解析HTML
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(rawHTML))
	if err != nil {
		return &CrawlerResult{
			Success:    false,
			Error:      fmt.Sprintf("解析HTML失败: %v", err),
			RawHTML:    rawHTML,
			StatusCode: resp.StatusCode,
		}, err
	}

	// 智能模式或选择器为空时，自动检测并提取内容
	if config.SmartMode || config.Selector == "" {
		extracted := s.smartExtract(doc, config)
		return &CrawlerResult{
			Success:    true,
			Data:       extracted,
			Extracted:  extracted,
			RawHTML:    rawHTML,
			StatusCode: resp.StatusCode,
			URL:        finalURL,
			Cookies:    responseCookies,
		}, nil
	}

	// 使用指定选择器提取数据
	extracted := s.extractData(doc, config)

	return &CrawlerResult{
		Success:    true,
		Data:       extracted,
		Extracted:  extracted,
		RawHTML:    rawHTML,
		StatusCode: resp.StatusCode,
		URL:        finalURL,
		Cookies:    responseCookies,
	}, nil
}

// extractData 提取数据
func (s *CrawlerService) extractData(doc *goquery.Document, config CrawlerConfig) map[string]interface{} {
	extracted := make(map[string]interface{})
	var extractedData []map[string]interface{}

	doc.Find(config.Selector).Each(func(i int, sel *goquery.Selection) {
		item := make(map[string]interface{})

		switch config.ExtractType {
		case "text":
			text := strings.TrimSpace(sel.Text())
			if text != "" {
				item["text"] = text
				item["index"] = i
			}
		case "html":
			sel.Find("img").Each(func(_ int, img *goquery.Selection) {
				if src, ok := img.Attr("src"); ok && src != "" {
					img.SetAttr("src", s.proxyImageURL(src, config.URL))
				}
				if dsrc, ok := img.Attr("data-src"); ok && dsrc != "" {
					img.SetAttr("data-src", s.proxyImageURL(dsrc, config.URL))
				}
			})
			html, _ := sel.Html()
			if html != "" {
				item["html"] = html
				item["index"] = i
			}
		case "attr":
			if config.ExtractAttr != "" {
				attr, exists := sel.Attr(config.ExtractAttr)
				if exists {
					item["attr"] = attr
					item["attrName"] = config.ExtractAttr
					item["index"] = i
				}
			} else {
				// 提取所有属性
				attrs := make(map[string]string)
				for _, attr := range sel.Get(0).Attr {
					attrs[attr.Key] = attr.Val
				}
				item["attrs"] = attrs
				item["index"] = i
			}
		case "link":
			href, exists := sel.Attr("href")
			if exists {
				item["link"] = href
				item["text"] = strings.TrimSpace(sel.Text())
				item["index"] = i
			}
		case "image":
			src, exists := sel.Attr("src")
			if !exists {
				src, exists = sel.Attr("data-src")
			}
			if exists {
				item["image"] = s.proxyImageURL(src, config.URL)
				alt, _ := sel.Attr("alt")
				item["alt"] = alt
				item["index"] = i
			}
		case "all":
			// 提取所有信息
			item["text"] = strings.TrimSpace(sel.Text())
			sel.Find("img").Each(func(_ int, img *goquery.Selection) {
				if src, ok := img.Attr("src"); ok && src != "" {
					img.SetAttr("src", s.proxyImageURL(src, config.URL))
				}
				if dsrc, ok := img.Attr("data-src"); ok && dsrc != "" {
					img.SetAttr("data-src", s.proxyImageURL(dsrc, config.URL))
				}
			})
			html, _ := sel.Html()
			item["html"] = html
			attrs := make(map[string]string)
			for _, attr := range sel.Get(0).Attr {
				attrs[attr.Key] = attr.Val
			}
			item["attrs"] = attrs
			item["index"] = i
		default:
			text := strings.TrimSpace(sel.Text())
			if text != "" {
				item["text"] = text
				item["index"] = i
			}
		}

		if len(item) > 0 {
			extractedData = append(extractedData, item)
		}
	})

	if len(extractedData) == 0 {
		// 提供调试信息，帮助用户找到正确的选择器
		debugInfo := s.getSelectorDebugInfo(doc, config.Selector)
		extracted["message"] = fmt.Sprintf("未找到匹配的元素（选择器: %s）", config.Selector)
		extracted["count"] = 0
		extracted["debug"] = debugInfo
		extracted["suggestion"] = "请检查选择器是否正确。建议：1) 在浏览器中按F12打开开发者工具 2) 使用'选择元素'工具点击要提取的内容 3) 查看Elements面板中的class或id 4) 更新选择器"
	} else if len(extractedData) == 1 {
		extracted["value"] = extractedData[0]
		extracted["data"] = extractedData
		extracted["count"] = 1
	} else {
		extracted["data"] = extractedData
		extracted["count"] = len(extractedData)
	}

	return extracted
}

func (s *CrawlerService) proxyImageURL(imageURL, referer string) string {
	return fmt.Sprintf("/api/proxy/image?url=%s&referer=%s", url.QueryEscape(imageURL), url.QueryEscape(referer))
}

// decodeBody 解码响应体
func (s *CrawlerService) decodeBody(body []byte, encoding, contentType string) ([]byte, error) {
	if encoding == "auto" {
		// 自动检测编码
		_, name, _ := charset.DetermineEncoding(body, contentType)
		encoding = name
	}

	switch strings.ToLower(encoding) {
	case "utf-8", "utf8", "":
		return body, nil
	case "gbk", "gb2312":
		decoder := simplifiedchinese.GBK.NewDecoder()
		reader := transform.NewReader(bytes.NewReader(body), decoder)
		return io.ReadAll(reader)
	default:
		// 如果无法识别编码，返回原始数据
		return body, nil
	}
}

// getRandomUserAgent 获取随机User-Agent
func (s *CrawlerService) getRandomUserAgent() string {
	userAgents := []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	}
	return userAgents[rand.Intn(len(userAgents))]
}

// executeWithPagination 执行分页爬取
func (s *CrawlerService) executeWithPagination(config CrawlerConfig) (*CrawlerResult, error) {
	pagination := config.Pagination
	if pagination.MaxPages == 0 {
		pagination.MaxPages = 10
	}
	if pagination.StartPage == 0 {
		pagination.StartPage = 1
	}
	if pagination.Increment == 0 {
		pagination.Increment = 1
	}

	var allPages []PageResult
	allExtracted := make(map[string]interface{})
	var allData []interface{}

	// 如果使用选择器方式分页
	if pagination.Selector != "" {
		// 先爬取第一页获取下一页链接
		firstResult, err := s.executeSinglePage(config)
		if err != nil || !firstResult.Success {
			return firstResult, err
		}

		allPages = append(allPages, PageResult{
			Page:      1,
			URL:       firstResult.URL,
			Data:      firstResult.Data,
			Extracted: firstResult.Extracted,
		})

		// 解析第一页获取下一页链接
		doc, err := goquery.NewDocumentFromReader(strings.NewReader(firstResult.RawHTML))
		if err == nil {
			nextLink, exists := doc.Find(pagination.Selector).First().Attr("href")
			if exists {
				// 构建完整URL
				baseURL, _ := url.Parse(config.URL)
				nextURL, _ := url.Parse(nextLink)
				nextURL = baseURL.ResolveReference(nextURL)

				// 继续爬取下一页
				config.URL = nextURL.String()
				for page := 2; page <= pagination.MaxPages; page++ {
					pageResult, err := s.executeSinglePage(config)
					if err != nil || !pageResult.Success {
						break
					}

					allPages = append(allPages, PageResult{
						Page:      page,
						URL:       pageResult.URL,
						Data:      pageResult.Data,
						Extracted: pageResult.Extracted,
					})

					// 查找下一页链接
					doc, err := goquery.NewDocumentFromReader(strings.NewReader(pageResult.RawHTML))
					if err != nil {
						break
					}
					nextLink, exists := doc.Find(pagination.Selector).First().Attr("href")
					if !exists {
						break
					}
					nextURL, _ := url.Parse(nextLink)
					nextURL = baseURL.ResolveReference(nextURL)
					config.URL = nextURL.String()
				}
			}
		}
	} else {
		// 使用页码参数方式分页
		baseURL, _ := url.Parse(config.URL)
		for page := pagination.StartPage; page < pagination.StartPage+pagination.MaxPages; page += pagination.Increment {
			// 构建带页码的URL
			pageURL := *baseURL
			q := pageURL.Query()
			q.Set(pagination.PageParam, fmt.Sprintf("%d", page))
			pageURL.RawQuery = q.Encode()

			config.URL = pageURL.String()
			pageResult, err := s.executeSinglePage(config)
			if err != nil || !pageResult.Success {
				break
			}

			allPages = append(allPages, PageResult{
				Page:      page,
				URL:       pageResult.URL,
				Data:      pageResult.Data,
				Extracted: pageResult.Extracted,
			})

			// 合并数据
			if pageResult.Extracted != nil {
				if data, ok := pageResult.Extracted["data"].([]map[string]interface{}); ok {
					// 将 []map[string]interface{} 转换为 []interface{}
					for _, item := range data {
						allData = append(allData, item)
					}
				}
			}
		}
	}

	// 合并所有页面的数据
	allExtracted["pages"] = len(allPages)
	allExtracted["data"] = allData
	allExtracted["count"] = len(allData)

	return &CrawlerResult{
		Success:   true,
		Data:      allExtracted,
		Extracted: allExtracted,
		Pages:     allPages,
	}, nil
}

// ExecuteFromJSON 从JSON配置执行爬虫
func (s *CrawlerService) ExecuteFromJSON(configJSON string) (*CrawlerResult, error) {
	var config CrawlerConfig
	if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
		return &CrawlerResult{
			Success: false,
			Error:   fmt.Sprintf("解析配置失败: %v", err),
		}, err
	}

	return s.Execute(config)
}

// getErrorMessage 根据HTTP状态码生成友好的错误提示
func (s *CrawlerService) getErrorMessage(statusCode int, method string) string {
	switch statusCode {
	case 400:
		return fmt.Sprintf("HTTP 400 - 请求错误: 请求参数不正确，请检查URL和请求体格式")
	case 401:
		return fmt.Sprintf("HTTP 401 - 未授权: 需要登录或提供认证信息")
	case 403:
		return fmt.Sprintf("HTTP 403 - 禁止访问: 服务器拒绝请求，可能需要登录或权限不足")
	case 404:
		return fmt.Sprintf("HTTP 404 - 未找到: 请求的URL不存在，请检查URL是否正确")
	case 405:
		if method == "POST" {
			return fmt.Sprintf("HTTP 405 - 方法不允许: 该URL不支持POST方法，请将请求方法改为GET")
		} else if method == "PUT" {
			return fmt.Sprintf("HTTP 405 - 方法不允许: 该URL不支持PUT方法，请将请求方法改为GET或POST")
		} else if method == "DELETE" {
			return fmt.Sprintf("HTTP 405 - 方法不允许: 该URL不支持DELETE方法")
		}
		return fmt.Sprintf("HTTP 405 - 方法不允许: 该URL不支持%s方法，请尝试使用GET方法", method)
	case 408:
		return fmt.Sprintf("HTTP 408 - 请求超时: 服务器等待请求超时，请增加超时时间或检查网络连接")
	case 429:
		return fmt.Sprintf("HTTP 429 - 请求过多: 请求频率过高，请增加请求间隔时间（waitTime）")
	case 500:
		return fmt.Sprintf("HTTP 500 - 服务器错误: 服务器内部错误，请稍后重试")
	case 502:
		return fmt.Sprintf("HTTP 502 - 网关错误: 服务器作为网关或代理时收到无效响应")
	case 503:
		return fmt.Sprintf("HTTP 503 - 服务不可用: 服务器暂时无法处理请求，请稍后重试")
	case 504:
		return fmt.Sprintf("HTTP 504 - 网关超时: 服务器作为网关时未及时收到响应")
	default:
		if statusCode >= 400 && statusCode < 500 {
			return fmt.Sprintf("HTTP %d - 客户端错误: 请检查请求参数和URL", statusCode)
		} else if statusCode >= 500 {
			return fmt.Sprintf("HTTP %d - 服务器错误: 服务器出现问题，请稍后重试", statusCode)
		}
		return fmt.Sprintf("HTTP状态码: %d", statusCode)
	}
}

// getSelectorDebugInfo 获取选择器调试信息
func (s *CrawlerService) getSelectorDebugInfo(doc *goquery.Document, selector string) map[string]interface{} {
	debugInfo := make(map[string]interface{})

	// 检查常见的选择器
	commonSelectors := []string{
		"article", ".article", "#article",
		".content", "#content", ".main-content",
		".post", ".post-content", ".entry",
		".result", "#result", ".result-content",
		"main", "#main", ".main",
		"body", "#body", ".body",
		"div.content", "div.article", "div.post",
	}

	foundSelectors := make([]string, 0)
	for _, commonSel := range commonSelectors {
		count := doc.Find(commonSel).Length()
		if count > 0 {
			foundSelectors = append(foundSelectors, fmt.Sprintf("%s (找到 %d 个)", commonSel, count))
		}
	}

	debugInfo["common_selectors_found"] = foundSelectors
	debugInfo["page_title"] = doc.Find("title").Text()

	// 检查是否有任何 div、article、section 等常见容器
	containerCounts := make(map[string]int)
	containerCounts["div"] = doc.Find("div").Length()
	containerCounts["article"] = doc.Find("article").Length()
	containerCounts["section"] = doc.Find("section").Length()
	containerCounts["main"] = doc.Find("main").Length()
	containerCounts["p"] = doc.Find("p").Length()
	debugInfo["container_counts"] = containerCounts

	// 获取一些常见的 class 和 id
	classes := make(map[string]int)
	ids := make([]string, 0)

	doc.Find("[class]").Each(func(i int, s *goquery.Selection) {
		if i < 20 { // 只取前20个
			class, _ := s.Attr("class")
			if class != "" {
				classes[class]++
			}
		}
	})

	doc.Find("[id]").Each(func(i int, s *goquery.Selection) {
		if i < 20 { // 只取前20个
			id, _ := s.Attr("id")
			if id != "" {
				ids = append(ids, id)
			}
		}
	})

	debugInfo["common_classes"] = classes
	debugInfo["common_ids"] = ids

	return debugInfo
}

// smartExtract 智能提取内容（无需选择器）
func (s *CrawlerService) smartExtract(doc *goquery.Document, config CrawlerConfig) map[string]interface{} {
	extracted := make(map[string]interface{})

	// 根据提取模式选择不同的策略
	mode := config.ExtractMode
	if mode == "" {
		mode = "smart" // 默认智能模式
	}

	switch mode {
	case "article":
		extracted = s.extractArticle(doc, config.URL)
	case "list":
		extracted = s.extractList(doc, config.URL)
	case "links":
		// 链接模式：提取所有链接
		extracted = s.extractLinks(doc)
	case "images":
		extracted = s.extractImages(doc, config.URL)
	case "smart":
		fallthrough
	default:
		// 智能模式：自动检测主要内容
		extracted = s.extractSmart(doc, config.URL)
	}

	return extracted
}

// extractSmart 智能检测并提取主要内容
func (s *CrawlerService) extractSmart(doc *goquery.Document, referer string) map[string]interface{} {
	extracted := make(map[string]interface{})

	// 优先级顺序：article > main > .content/.post/.article > body
	selectors := []string{
		"article",
		"main",
		".article-content", ".post-content", ".entry-content", ".content",
		".article", ".post", ".entry",
		"#article", "#post", "#content", "#main",
		"body",
	}

	var mainContent *goquery.Selection
	for _, selector := range selectors {
		selection := doc.Find(selector).First()
		if selection.Length() > 0 {
			text := strings.TrimSpace(selection.Text())
			// 确保内容不为空且有一定长度
			if len(text) > 50 {
				mainContent = selection
				extracted["selector_used"] = selector
				break
			}
		}
	}

	if mainContent != nil {
		mainContent.Find("img").Each(func(_ int, img *goquery.Selection) {
			if src, ok := img.Attr("src"); ok && src != "" {
				img.SetAttr("src", s.proxyImageURL(src, referer))
			}
			if dsrc, ok := img.Attr("data-src"); ok && dsrc != "" {
				img.SetAttr("data-src", s.proxyImageURL(dsrc, referer))
			}
		})
		html, _ := mainContent.Html()
		extracted["text"] = strings.TrimSpace(mainContent.Text())
		extracted["html"] = html
		extracted["count"] = 1
		extracted["mode"] = "smart"
	} else {
		// 如果都没找到，返回body的文本内容
		bodyText := strings.TrimSpace(doc.Find("body").Text())
		extracted["text"] = bodyText
		extracted["count"] = 1
		extracted["mode"] = "smart"
		extracted["note"] = "未找到特定内容区域，已提取页面全部文本"
	}

	return extracted
}

// extractArticle 提取文章内容
func (s *CrawlerService) extractArticle(doc *goquery.Document, referer string) map[string]interface{} {
	extracted := make(map[string]interface{})

	// 尝试找到文章标题
	title := ""
	titleSelectors := []string{"h1", ".title", ".post-title", ".article-title", "title"}
	for _, sel := range titleSelectors {
		titleText := strings.TrimSpace(doc.Find(sel).First().Text())
		if titleText != "" && len(titleText) < 200 {
			title = titleText
			break
		}
	}

	// 提取文章正文
	contentSelectors := []string{
		"article", ".article-content", ".post-content", ".entry-content",
		".content", ".article-body", ".post-body",
	}

	var content *goquery.Selection
	for _, selector := range contentSelectors {
		selection := doc.Find(selector).First()
		if selection.Length() > 0 {
			text := strings.TrimSpace(selection.Text())
			if len(text) > 50 {
				content = selection
				break
			}
		}
	}

	if content != nil {
		content.Find("img").Each(func(_ int, img *goquery.Selection) {
			if src, ok := img.Attr("src"); ok && src != "" {
				img.SetAttr("src", s.proxyImageURL(src, referer))
			}
			if dsrc, ok := img.Attr("data-src"); ok && dsrc != "" {
				img.SetAttr("data-src", s.proxyImageURL(dsrc, referer))
			}
		})
		html, _ := content.Html()
		extracted["title"] = title
		extracted["content"] = strings.TrimSpace(content.Text())
		extracted["html"] = html
		extracted["count"] = 1
		extracted["mode"] = "article"
	} else {
		extracted["title"] = title
		extracted["content"] = strings.TrimSpace(doc.Find("body").Text())
		extracted["count"] = 1
		extracted["mode"] = "article"
		extracted["note"] = "未找到标准文章结构，已提取页面主要内容"
	}

	return extracted
}

// extractList 提取列表项
func (s *CrawlerService) extractList(doc *goquery.Document, referer string) map[string]interface{} {
	extracted := make(map[string]interface{})
	items := make([]map[string]interface{}, 0)

	// 尝试找到列表容器
	listSelectors := []string{
		"ul", "ol", ".list", ".items", ".item-list",
		".article-list", ".post-list", ".entry-list",
	}

	var listContainer *goquery.Selection
	for _, selector := range listSelectors {
		selection := doc.Find(selector).First()
		if selection.Length() > 0 {
			listContainer = selection
			break
		}
	}

	if listContainer != nil {
		listContainer.Find("li, .item, .list-item, article, .post").Each(func(i int, sel *goquery.Selection) {
			text := strings.TrimSpace(sel.Text())
			if text != "" {
				sel.Find("img").Each(func(_ int, img *goquery.Selection) {
					if src, ok := img.Attr("src"); ok && src != "" {
						img.SetAttr("src", s.proxyImageURL(src, referer))
					}
					if dsrc, ok := img.Attr("data-src"); ok && dsrc != "" {
						img.SetAttr("data-src", s.proxyImageURL(dsrc, referer))
					}
				})
				html, _ := sel.Html()
				items = append(items, map[string]interface{}{
					"index": i,
					"text":  text,
					"html":  html,
				})
			}
		})
	} else {
		// 如果没有找到列表，尝试提取所有链接作为列表
		doc.Find("a").Each(func(i int, s *goquery.Selection) {
			text := strings.TrimSpace(s.Text())
			href, _ := s.Attr("href")
			if text != "" && href != "" {
				items = append(items, map[string]interface{}{
					"index": i,
					"text":  text,
					"link":  href,
				})
			}
		})
	}

	extracted["items"] = items
	extracted["count"] = len(items)
	extracted["mode"] = "list"

	return extracted
}

// extractLinks 提取所有链接
func (s *CrawlerService) extractLinks(doc *goquery.Document) map[string]interface{} {
	extracted := make(map[string]interface{})
	links := make([]map[string]interface{}, 0)

	doc.Find("a").Each(func(i int, s *goquery.Selection) {
		href, exists := s.Attr("href")
		if exists && href != "" {
			text := strings.TrimSpace(s.Text())
			links = append(links, map[string]interface{}{
				"index": i,
				"link":  href,
				"text":  text,
			})
		}
	})

	extracted["links"] = links
	extracted["count"] = len(links)
	extracted["mode"] = "links"

	return extracted
}

// extractImages 提取所有图片
func (s *CrawlerService) extractImages(doc *goquery.Document, referer string) map[string]interface{} {
	extracted := make(map[string]interface{})
	images := make([]map[string]interface{}, 0)

	doc.Find("img").Each(func(i int, sel *goquery.Selection) {
		src, exists := sel.Attr("src")
		if !exists {
			src, exists = sel.Attr("data-src")
		}
		if exists && src != "" {
			alt, _ := sel.Attr("alt")
			images = append(images, map[string]interface{}{
				"index": i,
				"src":   s.proxyImageURL(src, referer),
				"alt":   alt,
			})
		}
	})

	extracted["images"] = images
	extracted["count"] = len(images)
	extracted["mode"] = "images"

	return extracted
}

// isLoadingPage 检测页面是否包含加载组件
func (s *CrawlerService) isLoadingPage(html string) bool {
	// 检测常见的加载组件关键词
	loadingKeywords := []string{
		"Loading", "loading", "正在加载", "加载中",
		"LoadingSpinner", "loading-spinner", "spinner",
		"loader", "Loader", "加载器",
		"waiting", "Waiting", "等待中",
		"opacity:0", "display:none", // 加载组件通常初始隐藏
	}

	lowerHTML := strings.ToLower(html)
	for _, keyword := range loadingKeywords {
		if strings.Contains(lowerHTML, strings.ToLower(keyword)) {
			// 进一步检查：如果包含加载关键词且内容很少，可能是加载页面
			if len(html) < 5000 { // 如果HTML很小，可能是初始骨架
				return true
			}
			// 检查是否包含明显的加载文本
			if strings.Contains(html, "正在加载") ||
				strings.Contains(html, "Loading") && strings.Contains(html, "spinner") {
				return true
			}
		}
	}

	return false
}
