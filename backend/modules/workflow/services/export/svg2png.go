package export

import (
	"context"
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"
	"time"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// 从 SVG 字符串中解析出 width、height（像素），用于设置截图视口
func parseSVGViewport(svg string) (w, h int64) {
	w, h = 900, 520 // 与 chart_svg_provider 中默认画布一致
	// 匹配 width="900" 或 width='900'
	if m := regexp.MustCompile(`width\s*=\s*["']?\s*(\d+)`).FindStringSubmatch(svg); len(m) >= 2 {
		fmt.Sscanf(m[1], "%d", &w)
	}
	if m := regexp.MustCompile(`height\s*=\s*["']?\s*(\d+)`).FindStringSubmatch(svg); len(m) >= 2 {
		fmt.Sscanf(m[1], "%d", &h)
	}
	// 若无 width/height，尝试 viewBox="0 0 W H"
	if w == 0 || h == 0 {
		if m := regexp.MustCompile(`viewBox\s*=\s*["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)`).FindStringSubmatch(svg); len(m) >= 3 {
			fmt.Sscanf(m[1], "%d", &w)
			fmt.Sscanf(m[2], "%d", &h)
		}
	}
	if w <= 0 {
		w = 900
	}
	if h <= 0 {
		h = 520
	}
	return w, h
}

// SVGToPNG 使用 headless Chrome 将 SVG 转为 PNG，便于直接下载位图
func SVGToPNG(svgContent string) ([]byte, error) {
	svgContent = strings.TrimSpace(svgContent)
	if svgContent == "" {
		return nil, fmt.Errorf("svg 内容为空")
	}
	w, h := parseSVGViewport(svgContent)

	html := `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:0;background:#fff}</style></head><body>` +
		svgContent +
		`</body></html>`

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
	)
	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer allocCancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()
	ctx, timeoutCancel := context.WithTimeout(ctx, 25*time.Second)
	defer timeoutCancel()

	var pngBuf []byte
	err := chromedp.Run(ctx,
		chromedp.EmulateViewport(w, h),
		chromedp.Navigate("data:text/html;base64,"+base64.StdEncoding.EncodeToString([]byte(html))),
		chromedp.Sleep(300*time.Millisecond),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pngBuf, err = page.CaptureScreenshot().WithQuality(90).Do(ctx)
			return err
		}),
	)
	if err != nil {
		log.Printf("[export] SVGToPNG chromedp run error: %v", err)
		return nil, fmt.Errorf("SVG 转 PNG 失败: %w", err)
	}
	return pngBuf, nil
}
