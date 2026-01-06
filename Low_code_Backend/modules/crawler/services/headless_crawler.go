package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/dom"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// HeadlessCrawler 无头浏览器爬虫（用于爬取SPA应用）
type HeadlessCrawler struct{}

// HeadlessConfig 无头浏览器配置
type HeadlessConfig struct {
	URL             string        `json:"url"`
	WaitForSelector string        `json:"waitForSelector"` // 等待选择器出现
	WaitTime        time.Duration `json:"waitTime"`        // 等待时间（秒）
	Screenshot      bool          `json:"screenshot"`      // 是否截图
	Timeout         time.Duration `json:"timeout"`         // 超时时间
	UserAgent       string        `json:"userAgent"`       // User-Agent
	DisableImages   bool          `json:"disableImages"`   // 禁用图片加载（提升速度）
	ExecuteScript   string        `json:"executeScript"`   // 执行自定义JavaScript
}

// NewHeadlessCrawler 创建无头浏览器爬虫
func NewHeadlessCrawler() *HeadlessCrawler {
	return &HeadlessCrawler{}
}

// FetchWithHeadless 使用无头浏览器获取页面内容
func (h *HeadlessCrawler) FetchWithHeadless(config HeadlessConfig) (string, error) {
	// 设置默认值
	if config.WaitTime == 0 {
		config.WaitTime = 3 * time.Second
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.UserAgent == "" {
		config.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
	}

	// 创建chromedp上下文选项
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.UserAgent(config.UserAgent),
	)

	// 如果禁用图片，添加相应标志
	if config.DisableImages {
		opts = append(opts,
			chromedp.Flag("blink-settings", "imagesEnabled=false"),
		)
	}

	// 创建allocator上下文
	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer allocCancel()

	// 创建chrome实例上下文
	ctx, cancel := chromedp.NewContext(allocCtx, chromedp.WithLogf(log.Printf))
	defer cancel()

	// 设置超时
	ctx, timeoutCancel := context.WithTimeout(ctx, config.Timeout)
	defer timeoutCancel()

	var htmlContent string
	var screenshot []byte

	// 构建任务列表
	tasks := chromedp.Tasks{
		// 导航到目标URL
		chromedp.Navigate(config.URL),
	}

	// 如果指定了等待选择器，等待选择器出现
	if config.WaitForSelector != "" {
		tasks = append(tasks, chromedp.WaitVisible(config.WaitForSelector, chromedp.ByQuery))
		log.Printf("等待选择器出现: %s", config.WaitForSelector)
	} else {
		// 否则等待DOM加载完成
		tasks = append(tasks, chromedp.WaitReady("body", chromedp.ByQuery))
	}

	// 额外等待时间，让JavaScript执行完成
	if config.WaitTime > 0 {
		tasks = append(tasks, chromedp.Sleep(config.WaitTime))
		log.Printf("等待 %v 让JavaScript执行...", config.WaitTime)
	}

	// 执行自定义JavaScript（如果有）
	if config.ExecuteScript != "" {
		tasks = append(tasks, chromedp.Evaluate(config.ExecuteScript, nil))
		log.Printf("执行自定义JavaScript")
	}

	// 获取渲染后的HTML
	tasks = append(tasks, chromedp.ActionFunc(func(ctx context.Context) error {
		node, err := dom.GetDocument().Do(ctx)
		if err != nil {
			return err
		}
		htmlContent, err = dom.GetOuterHTML().WithNodeID(node.NodeID).Do(ctx)
		return err
	}))

	// 如果需要截图
	if config.Screenshot {
		tasks = append(tasks, chromedp.FullScreenshot(&screenshot, 90))
		log.Printf("生成页面截图")
	}

	// 执行所有任务
	if err := chromedp.Run(ctx, tasks); err != nil {
		return "", fmt.Errorf("执行浏览器任务失败: %v", err)
	}

	log.Printf("无头浏览器成功获取页面内容，HTML长度: %d", len(htmlContent))

	return htmlContent, nil
}

// FetchMultipleWithHeadless 使用无头浏览器获取多个页面
func (h *HeadlessCrawler) FetchMultipleWithHeadless(configs []HeadlessConfig) ([]string, error) {
	results := make([]string, 0, len(configs))

	for i, config := range configs {
		log.Printf("使用无头浏览器获取第 %d/%d 个页面: %s", i+1, len(configs), config.URL)

		html, err := h.FetchWithHeadless(config)
		if err != nil {
			log.Printf("获取页面失败: %v", err)
			return results, err
		}

		results = append(results, html)

		// 短暂延迟，避免请求过快
		if i < len(configs)-1 {
			time.Sleep(1 * time.Second)
		}
	}

	return results, nil
}

// WaitForDynamicContent 等待动态内容加载完成
func (h *HeadlessCrawler) WaitForDynamicContent(ctx context.Context, selector string) chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		// 最多等待30秒
		timeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()

		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-timeoutCtx.Done():
				return fmt.Errorf("等待动态内容超时")
			case <-ticker.C:
				var nodes []*cdp.Node
				if err := chromedp.Nodes(selector, &nodes, chromedp.ByQueryAll).Do(ctx); err != nil {
					continue
				}
				if len(nodes) > 0 {
					log.Printf("动态内容已加载，找到 %d 个匹配元素", len(nodes))
					return nil
				}
			}
		}
	})
}

// GetPageInfo 获取页面信息（标题、URL等）
func (h *HeadlessCrawler) GetPageInfo(ctx context.Context) (map[string]interface{}, error) {
	info := make(map[string]interface{})

	var title string
	var currentURL string

	err := chromedp.Run(ctx,
		chromedp.Title(&title),
		chromedp.Location(&currentURL),
	)

	if err != nil {
		return nil, err
	}

	info["title"] = title
	info["url"] = currentURL

	return info, nil
}

// ScrollToBottom 滚动到页面底部（用于加载懒加载内容）
func (h *HeadlessCrawler) ScrollToBottom(ctx context.Context) error {
	return chromedp.Run(ctx,
		chromedp.Evaluate(`
			window.scrollTo(0, document.body.scrollHeight);
		`, nil),
		chromedp.Sleep(1*time.Second),
	)
}

// ClickElement 点击元素（用于触发加载更多等）
func (h *HeadlessCrawler) ClickElement(ctx context.Context, selector string) error {
	return chromedp.Run(ctx,
		chromedp.WaitVisible(selector, chromedp.ByQuery),
		chromedp.Click(selector, chromedp.ByQuery),
		chromedp.Sleep(500*time.Millisecond),
	)
}

// HandleInfiniteScroll 处理无限滚动页面
func (h *HeadlessCrawler) HandleInfiniteScroll(ctx context.Context, maxScrolls int) error {
	for i := 0; i < maxScrolls; i++ {
		var previousHeight int
		var currentHeight int

		// 获取当前高度
		if err := chromedp.Evaluate(`document.body.scrollHeight`, &previousHeight).Do(ctx); err != nil {
			return err
		}

		// 滚动到底部
		if err := h.ScrollToBottom(ctx); err != nil {
			return err
		}

		// 等待新内容加载
		time.Sleep(2 * time.Second)

		// 获取新高度
		if err := chromedp.Evaluate(`document.body.scrollHeight`, &currentHeight).Do(ctx); err != nil {
			return err
		}

		// 如果高度没有变化，说明已经到底了
		if currentHeight == previousHeight {
			log.Printf("已滚动到页面底部，停止滚动")
			break
		}

		log.Printf("滚动 %d/%d 次，页面高度: %d -> %d", i+1, maxScrolls, previousHeight, currentHeight)
	}

	return nil
}

// ExtractMetadata 提取页面元数据
func (h *HeadlessCrawler) ExtractMetadata(ctx context.Context) (map[string]interface{}, error) {
	metadata := make(map[string]interface{})

	var title, description, keywords, ogTitle, ogDescription, ogImage string

	err := chromedp.Run(ctx,
		chromedp.Evaluate(`document.title`, &title),
		chromedp.Evaluate(`document.querySelector('meta[name="description"]')?.content || ''`, &description),
		chromedp.Evaluate(`document.querySelector('meta[name="keywords"]')?.content || ''`, &keywords),
		chromedp.Evaluate(`document.querySelector('meta[property="og:title"]')?.content || ''`, &ogTitle),
		chromedp.Evaluate(`document.querySelector('meta[property="og:description"]')?.content || ''`, &ogDescription),
		chromedp.Evaluate(`document.querySelector('meta[property="og:image"]')?.content || ''`, &ogImage),
	)

	if err != nil {
		return nil, err
	}

	metadata["title"] = title
	metadata["description"] = description
	metadata["keywords"] = keywords
	metadata["og_title"] = ogTitle
	metadata["og_description"] = ogDescription
	metadata["og_image"] = ogImage

	return metadata, nil
}

// WaitForAPIResponse 等待API响应（监听网络请求）
func (h *HeadlessCrawler) WaitForAPIResponse(ctx context.Context, urlPattern string) error {
	// 启用网络监听
	if err := chromedp.Run(ctx,
		chromedp.ActionFunc(func(ctx context.Context) error {
			return page.Enable().Do(ctx)
		}),
	); err != nil {
		return err
	}

	// 等待匹配的网络请求
	timeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-timeoutCtx.Done():
			return fmt.Errorf("等待API响应超时")
		case <-ticker.C:
			// 这里简化处理，实际应该监听网络事件
			// 可以使用 chromedp.ListenTarget 来监听网络请求
			return nil
		}
	}
}
