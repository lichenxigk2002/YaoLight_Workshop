package controllers

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	workflowAPIServices "yaolight-workshop/backend/modules/workflowapi/services"
)

type WorkflowAPIController struct {
	service *workflowAPIServices.WorkflowAPIService
}

func NewWorkflowAPIController() *WorkflowAPIController {
	return &WorkflowAPIController{
		service: workflowAPIServices.NewWorkflowAPIService(database.DB),
	}
}

func (c *WorkflowAPIController) GetEndpoint(ctx *gin.Context) {
	userID, ok := ctx.Get("userID")
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}
	workflowID, valid := parseUintParam(ctx.Param("id"))
	if !valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid workflow id", "data": nil})
		return
	}
	data, err := c.service.GetEndpoint(userID.(uint), workflowID)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) UpsertEndpoint(ctx *gin.Context) {
	userID, ok := ctx.Get("userID")
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}
	workflowID, valid := parseUintParam(ctx.Param("id"))
	if !valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid workflow id", "data": nil})
		return
	}
	var req workflowAPIServices.EndpointUpsertRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	data, err := c.service.UpsertEndpoint(userID.(uint), workflowID, req)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) ListKeys(ctx *gin.Context) {
	userID, ok := ctx.Get("userID")
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}
	workflowID, valid := parseUintParam(ctx.Param("id"))
	if !valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid workflow id", "data": nil})
		return
	}
	data, err := c.service.ListKeys(userID.(uint), workflowID)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) CreateKey(ctx *gin.Context) {
	userID, ok := ctx.Get("userID")
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}
	workflowID, valid := parseUintParam(ctx.Param("id"))
	if !valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid workflow id", "data": nil})
		return
	}
	var req workflowAPIServices.CreateAPIKeyRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	data, err := c.service.CreateKey(userID.(uint), workflowID, req)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) ListInvocations(ctx *gin.Context) {
	userID, ok := ctx.Get("userID")
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}
	workflowID, valid := parseUintParam(ctx.Param("id"))
	if !valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid workflow id", "data": nil})
		return
	}
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "20"))
	data, err := c.service.ListInvocations(userID.(uint), workflowID, page, pageSize)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) PublicInvoke(ctx *gin.Context) {
	var req workflowAPIServices.PublicInvokeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	data, err := c.service.PublicInvoke(ctx.Request.Context(), ctx.Param("slug"), extractAPIKey(ctx), req, ctx.ClientIP(), ctx.Request.UserAgent())
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) GetInvocation(ctx *gin.Context) {
	data, err := c.service.GetInvocation(ctx.Param("slug"), extractAPIKey(ctx), ctx.Param("requestId"))
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) ListInvocationArtifacts(ctx *gin.Context) {
	data, err := c.service.ListInvocationArtifacts(ctx.Param("slug"), extractAPIKey(ctx), ctx.Param("requestId"))
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) DownloadInvocationArtifact(ctx *gin.Context) {
	artifactID, valid := parseUintParam(ctx.Param("artifactId"))
	if !valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid artifact id", "data": nil})
		return
	}
	artifact, err := c.service.GetInvocationArtifact(ctx.Param("slug"), extractAPIKey(ctx), ctx.Param("requestId"), artifactID)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	content, err := workflowAPIServices.OpenArtifactContent(artifact)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "failed to read artifact", "data": nil})
		return
	}
	ctx.Header("Content-Type", artifact.MimeType)
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(artifact.Name)))
	ctx.Header("Content-Length", strconv.FormatInt(int64(len(content)), 10))
	ctx.Writer.WriteHeader(http.StatusOK)
	_, _ = ctx.Writer.Write(content)
}

func (c *WorkflowAPIController) GetDocs(ctx *gin.Context) {
	data, err := c.service.GetDocs(buildBaseURL(ctx), ctx.Param("slug"))
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": data})
}

func (c *WorkflowAPIController) writeError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, workflowAPIServices.ErrWorkflowNotFound), errors.Is(err, workflowAPIServices.ErrEndpointNotFound), errors.Is(err, workflowAPIServices.ErrInvocationNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error(), "data": nil})
	case errors.Is(err, workflowAPIServices.ErrAPIKeyInvalid):
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": err.Error(), "data": nil})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
	}
}

func extractAPIKey(ctx *gin.Context) string {
	return strings.TrimSpace(ctx.GetHeader("X-API-Key"))
}

func parseUintParam(value string) (uint, bool) {
	parsed, err := strconv.ParseUint(value, 10, 32)
	if err != nil || parsed == 0 {
		return 0, false
	}
	return uint(parsed), true
}

func buildBaseURL(ctx *gin.Context) string {
	scheme := "http"
	if ctx.Request.TLS != nil {
		scheme = "https"
	}
	if forwardedProto := ctx.GetHeader("X-Forwarded-Proto"); forwardedProto != "" {
		scheme = forwardedProto
	}
	return scheme + "://" + ctx.Request.Host
}
