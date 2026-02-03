package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/tencentyun/cos-go-sdk-v5"
	"yaolight-workshop/backend/infrastructure/config"
)

// UploadAvatar 将头像上传到 COS，路径为 user/avatar/{userNo}/{filename}，返回公网可访问 URL
func UploadAvatar(ctx context.Context, body io.Reader, contentLength int64, userNo int64, filename string, contentType string) (publicURL string, err error) {
	if !config.COSEnabled || config.COSBucket == "" || config.COSRegion == "" {
		return "", fmt.Errorf("COS not enabled or missing bucket/region")
	}
	bucketURL := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", config.COSBucket, config.COSRegion)
	u, err := url.Parse(bucketURL)
	if err != nil {
		return "", err
	}
	b := &cos.BaseURL{BucketURL: u}
	client := cos.NewClient(b, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  config.COSSecretID,
			SecretKey: config.COSSecretKey,
		},
	})
	key := "user/avatar/" + strconv.FormatInt(userNo, 10) + "/" + filename
	opt := &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
			ContentLength: contentLength,
		},
		ACLHeaderOptions: &cos.ACLHeaderOptions{
			XCosACL: "public-read",
		},
	}
	_, err = client.Object.Put(ctx, key, body, opt)
	if err != nil {
		log.Printf("COS Put failed: %v", err)
		return "", err
	}
	if config.COSPublicBaseURL != "" {
		base := strings.TrimSuffix(config.COSPublicBaseURL, "/")
		return base + "/" + key, nil
	}
	return bucketURL + "/" + key, nil
}

// UploadAvatarFromURL 从图片 URL 下载并上传到 COS（用于 OAuth 头像），返回公网 URL；扩展名根据 Content-Type 推断
func UploadAvatarFromURL(ctx context.Context, imageURL string, userNo int64) (publicURL string, err error) {
	client := &http.Client{}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("avatar url returned %d", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		return "", fmt.Errorf("not an image: %s", ct)
	}
	const maxSize = 5 * 1024 * 1024
	body := io.LimitReader(resp.Body, maxSize+1)
	// 需要知道 ContentLength；LimitReader 无法直接取长度，先读入内存
	data, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}
	if len(data) > maxSize {
		return "", fmt.Errorf("image too large")
	}
	contentType := ct
	if contentType == "" {
		contentType = "image/jpeg"
	}
	ext := ".jpg"
	if strings.Contains(ct, "png") {
		ext = ".png"
	} else if strings.Contains(ct, "gif") {
		ext = ".gif"
	} else if strings.Contains(ct, "webp") {
		ext = ".webp"
	}
	filename := strconv.FormatInt(userNo, 10) + "_" + strconv.FormatInt(int64(len(data)), 10) + ext
	return UploadAvatar(ctx, io.NopCloser(bytes.NewReader(data)), int64(len(data)), userNo, filename, contentType)
}
