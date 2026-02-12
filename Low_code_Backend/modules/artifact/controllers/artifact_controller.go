package controllers

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
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
	if a.Storage != "local" {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "暂不支持该存储类型", "data": nil})
		return
	}

	root := artifactServices.ArtifactStorageRoot()
	absPath := filepath.Join(root, filepath.FromSlash(a.Path))
	if _, err := os.Stat(absPath); err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "文件不存在", "data": nil})
		return
	}
	ctx.Header("Content-Type", a.MimeType)
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(a.Name)))
	ctx.File(absPath)
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
