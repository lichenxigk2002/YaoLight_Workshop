package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/modules/user/services"
)

// InvitationController 邀请控制器
type InvitationController struct {
	invitationService *services.InvitationService
}

// NewInvitationController 创建邀请控制器
func NewInvitationController() *InvitationController {
	return &InvitationController{
		invitationService: services.NewInvitationService(),
	}
}

// GetInviteLink 获取或生成专属邀请链接
// @Summary 获取邀请链接
// @Description 获取当前用户的专属邀请链接，首次调用时自动生成
// @Tags 邀请
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "邀请链接信息"
// @Router /api/users/invite/link [get]
func (c *InvitationController) GetInviteLink(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}
	uid := userID.(uint)
	baseURL := config.FrontendURL
	if baseURL == "" {
		baseURL = "http://localhost:5173" // 开发默认
	}
	code, inviteURL, err := c.invitationService.GetInviteLink(uid, baseURL)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取邀请链接失败: " + err.Error(),
			"data":    nil,
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data": gin.H{
			"inviteCode": code,
			"inviteUrl":  inviteURL,
		},
	})
}

// GetInviteStats 获取邀请统计
// @Summary 获取邀请统计
// @Description 获取当前用户已邀请人数
// @Tags 邀请
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "邀请统计"
// @Router /api/users/invite/stats [get]
func (c *InvitationController) GetInviteStats(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}
	uid := userID.(uint)
	count, err := c.invitationService.GetInviteCount(uid)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取邀请统计失败",
			"data":    nil,
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data": gin.H{
			"inviteCount": count,
		},
	})
}

// GetInvitationList 获取邀请记录列表
// @Summary 获取邀请记录
// @Description 分页获取当前用户的邀请记录
// @Tags 邀请
// @Produce json
// @Security BearerAuth
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页条数" default(10)
// @Success 200 {object} map[string]interface{} "邀请记录列表"
// @Router /api/users/invite/list [get]
func (c *InvitationController) GetInvitationList(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}
	uid := userID.(uint)
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}
	list, total, err := c.invitationService.GetInvitationList(uid, page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取邀请记录失败",
			"data":    nil,
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data": gin.H{
			"list":     list,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}
