package controllers

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/email"
	artifactModels "yaolight-workshop/backend/modules/artifact/models"
	artifactRepos "yaolight-workshop/backend/modules/artifact/repositories"
	artifactServices "yaolight-workshop/backend/modules/artifact/services"
)

// ArtifactController 对外提供导出制品查询/下载 API
type ArtifactController struct {
	repo artifactRepos.ArtifactRepository
}

func NewArtifactController() *ArtifactController {
	return &ArtifactController{
		repo: artifactRepos.NewArtifactRepository(database.DB),
	}
}

type SendArtifactEmailRequest struct {
	To          string  `json:"to" binding:"required,email"`
	Subject     string  `json:"subject" binding:"required"`
	Body        *string `json:"body"`
	ArtifactIDs []uint  `json:"artifactIds" binding:"required"`
}

// ListByTask 获取某任务生成的制品列表（分页）
// GET /api/tasks/:id/artifacts?page=1&pageSize=20
func (c *ArtifactController) ListByTask(ctx *gin.Context) {
	userIDAny, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	userID := userIDAny.(uint)

	taskIDStr := ctx.Param("id")
	taskID64, err := strconv.ParseUint(taskIDStr, 10, 32)
	if err != nil || taskID64 == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 task id", "data": nil})
		return
	}
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "20"))

	list, total, err := c.repo.ListByTask(userID, uint(taskID64), page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	out := make([]map[string]interface{}, 0, len(list))
	for i := range list {
		out = append(out, artifactToDTO(&list[i]))
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data": gin.H{
			"list":  out,
			"total": total,
		},
	})
}

// GetByID 获取制品元信息
// GET /api/artifacts/:id
func (c *ArtifactController) GetByID(ctx *gin.Context) {
	userIDAny, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	userID := userIDAny.(uint)

	idStr := ctx.Param("id")
	id64, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id64 == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 id", "data": nil})
		return
	}
	a, err := c.repo.GetByIDAndUser(uint(id64), userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "制品不存在", "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": artifactToDTO(a)})
}

// Download 下载制品文件
// GET /api/artifacts/:id/download
func (c *ArtifactController) Download(ctx *gin.Context) {
	userIDAny, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	userID := userIDAny.(uint)

	idStr := ctx.Param("id")
	id64, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id64 == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 id", "data": nil})
		return
	}
	a, err := c.repo.GetByIDAndUser(uint(id64), userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "制品不存在", "data": nil})
		return
	}

	switch a.Storage {
	case "local":
		absPath := artifactServices.ArtifactAbsolutePath(a.Path)
		if _, err := os.Stat(absPath); err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "文件不存在", "data": nil})
			return
		}
		ctx.Header("Content-Type", a.MimeType)
		ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(a.Name)))
		ctx.File(absPath)
	case "cos":
		// 为避免浏览器在 XHR/fetch 中跟随 302 跳转到 COS 域名而触发 CORS，
		// 这里不再重定向到 COS 预签名 URL，而是由后端拉取文件内容并直接返回给前端。
		content, err := artifactServices.ArtifactContent(a)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "读取文件失败", "data": nil})
			return
		}
		ctx.Header("Content-Type", a.MimeType)
		ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(a.Name)))
		ctx.Header("Content-Length", strconv.FormatInt(int64(len(content)), 10))
		ctx.Writer.WriteHeader(http.StatusOK)
		if _, err := ctx.Writer.Write(content); err != nil {
			// 写回客户端失败只能记录日志，这里简单返回
			return
		}
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "暂不支持该存储类型", "data": nil})
	}
}

func (c *ArtifactController) SendByEmail(ctx *gin.Context) {
	userIDAny, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	userID := userIDAny.(uint)

	var req SendArtifactEmailRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误", "data": nil})
		return
	}
	if len(req.ArtifactIDs) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "缺少附件", "data": nil})
		return
	}

	attachments := make([]email.Attachment, 0, len(req.ArtifactIDs))
	body := ""
	if req.Body != nil {
		body = strings.TrimSpace(*req.Body)
	}

	for _, id := range req.ArtifactIDs {
		a, err := c.repo.GetByIDAndUser(id, userID)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "制品不存在", "data": nil})
			return
		}

		b, err := artifactServices.ArtifactContent(a)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "读取文件失败", "data": nil})
			return
		}

		attachments = append(attachments, email.Attachment{
			Filename: a.Name,
			MimeType: a.MimeType,
			Data:     b,
		})

		if body == "" {
			if strings.EqualFold(a.Kind, "markdown") || strings.HasPrefix(strings.ToLower(a.MimeType), "text/markdown") {
				body = string(b)
			}
		}
	}

	if body == "" {
		body = "请查收附件。"
	}

	svc := email.NewEmailService()
	if err := svc.SendWithAttachments(req.To, req.Subject, body, attachments); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "邮件已发送", "data": nil})
}

func artifactToDTO(a *artifactModels.Artifact) map[string]interface{} {
	dto := map[string]interface{}{
		"id":          a.ID,
		"userId":      a.UserID,
		"workflowId":  a.WorkflowID,
		"taskId":      a.TaskID,
		"nodeId":      a.NodeID,
		"name":        a.Name,
		"kind":        a.Kind,
		"mimeType":    a.MimeType,
		"size":        a.Size,
		"storage":     a.Storage,
		"path":        a.Path,
		"createdAt":   a.CreatedAt,
		"downloadUrl": fmt.Sprintf("/api/artifacts/%d/download", a.ID),
	}
	if a.Metadata != nil && a.Metadata.Data != nil {
		dto["metadata"] = a.Metadata.Data
	}
	if a.Description != nil {
		dto["description"] = *a.Description
	}
	return dto
}
