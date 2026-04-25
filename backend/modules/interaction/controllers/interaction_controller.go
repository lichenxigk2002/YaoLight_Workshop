package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"yaolight-workshop/backend/infrastructure/database"
	interactionServices "yaolight-workshop/backend/modules/interaction/services"
)

type InteractionController struct {
	service *interactionServices.InteractionService
}

func NewInteractionController() *InteractionController {
	return &InteractionController{service: interactionServices.NewInteractionService(database.DB)}
}

func (c *InteractionController) GetLikeSummary(ctx *gin.Context) {
	resourceType, resourceID, ok := parseResourceParams(ctx)
	if !ok {
		return
	}
	userID := currentUserID(ctx)
	summary, err := c.service.GetLikeSummary(resourceType, resourceID, userID)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": summary})
}

func (c *InteractionController) ToggleLike(ctx *gin.Context) {
	resourceType, resourceID, ok := parseResourceParams(ctx)
	if !ok {
		return
	}
	summary, err := c.service.ToggleLike(resourceType, resourceID, currentUserID(ctx))
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": summary})
}

func (c *InteractionController) ListComments(ctx *gin.Context) {
	resourceType, resourceID, ok := parseResourceParams(ctx)
	if !ok {
		return
	}
	response, err := c.service.ListComments(resourceType, resourceID, currentUserID(ctx))
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": response})
}

func (c *InteractionController) CreateComment(ctx *gin.Context) {
	resourceType, resourceID, ok := parseResourceParams(ctx)
	if !ok {
		return
	}
	var req interactionServices.CreateCommentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	response, err := c.service.CreateComment(resourceType, resourceID, currentUserID(ctx), ctx.GetHeader("User-Agent"), req)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": response})
}

func (c *InteractionController) DeleteComment(ctx *gin.Context) {
	id, ok := parseUintParam(ctx, "id")
	if !ok {
		return
	}
	if err := c.service.DeleteComment(id, currentUserID(ctx)); err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": nil})
}

func (c *InteractionController) ToggleCommentReaction(ctx *gin.Context) {
	id, ok := parseUintParam(ctx, "id")
	if !ok {
		return
	}
	var req interactionServices.ToggleReactionRequest
	_ = ctx.ShouldBindJSON(&req)
	response, err := c.service.ToggleCommentReaction(id, currentUserID(ctx), req.Emoji)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": response})
}

func (c *InteractionController) AdminListComments(ctx *gin.Context) {
	params := interactionServices.AdminCommentListParams{
		Page:         parseIntQuery(ctx, "page", 1),
		PageSize:     parseIntQuery(ctx, "page_size", 20),
		Keyword:      ctx.Query("keyword"),
		Status:       ctx.Query("status"),
		ResourceType: ctx.Query("resource_type"),
	}
	if id, ok := parseOptionalUintQuery(ctx, "resource_id"); ok {
		params.ResourceID = &id
	}
	if id, ok := parseOptionalUintQuery(ctx, "user_id"); ok {
		params.UserID = &id
	}
	response, err := c.service.AdminListComments(params)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": response})
}

func (c *InteractionController) AdminModerateComment(ctx *gin.Context) {
	id, ok := parseUintParam(ctx, "id")
	if !ok {
		return
	}
	var req interactionServices.AdminModerateCommentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil})
		return
	}
	response, err := c.service.AdminModerateComment(id, currentUserID(ctx), req)
	if err != nil {
		c.writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "success", "data": response})
}

func parseResourceParams(ctx *gin.Context) (string, uint, bool) {
	resourceType := ctx.Param("resourceType")
	resourceID, ok := parseUintParam(ctx, "resourceId")
	return resourceType, resourceID, ok
}

func parseUintParam(ctx *gin.Context, name string) (uint, bool) {
	raw := ctx.Param(name)
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误", "data": nil})
		return 0, false
	}
	return uint(id), true
}

func parseIntQuery(ctx *gin.Context, name string, fallback int) int {
	raw := ctx.Query(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func parseOptionalUintQuery(ctx *gin.Context, name string) (uint, bool) {
	raw := ctx.Query(name)
	if raw == "" {
		return 0, false
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		return 0, false
	}
	return uint(id), true
}

func currentUserID(ctx *gin.Context) uint {
	userID, _ := ctx.Get("userID")
	if value, ok := userID.(uint); ok {
		return value
	}
	return 0
}

func (c *InteractionController) writeError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, interactionServices.ErrInvalidResource):
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "互动资源参数错误", "data": nil})
	case errors.Is(err, interactionServices.ErrCommentContentEmpty):
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "评论内容不能为空", "data": nil})
	case errors.Is(err, interactionServices.ErrCommentNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "评论不存在", "data": nil})
	case errors.Is(err, interactionServices.ErrCommentForbidden):
		ctx.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "没有权限操作该评论", "data": nil})
	case errors.Is(err, interactionServices.ErrInvalidModerationAction):
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "评论处理动作无效", "data": nil})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
	}
}
