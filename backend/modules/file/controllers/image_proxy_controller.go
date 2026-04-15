package controllers

import (
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
)

type ImageProxyController struct{}

func NewImageProxyController() *ImageProxyController {
	return &ImageProxyController{}
}

func (c *ImageProxyController) ProxyImage(ctx *gin.Context) {
	raw := ctx.Query("url")
	if raw == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "missing url"})
		return
	}

	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid url"})
		return
	}

	req, err := http.NewRequest(http.MethodGet, parsed.String(), nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "request error"})
		return
	}

	referer := ctx.Query("referer")
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, gin.H{"code": 502, "message": "fetch error"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		ctx.JSON(resp.StatusCode, gin.H{"code": resp.StatusCode, "message": "upstream error"})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	ctx.Header("Content-Type", contentType)
	ctx.Status(http.StatusOK)
	io.Copy(ctx.Writer, resp.Body)
}
