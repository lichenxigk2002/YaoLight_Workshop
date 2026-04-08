package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	userServices "yaolight-workshop/backend/modules/user/services"
)

type AdminUserController struct {
	service *userServices.AdminUserService
}

func NewAdminUserController() *AdminUserController {
	return &AdminUserController{
		service: userServices.NewAdminUserService(database.DB),
	}
}

func (c *AdminUserController) GetSummary(ctx *gin.Context) {
	summary, err := c.service.GetSummary()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": summary})
}

func (c *AdminUserController) GetUsers(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	page, pageSize = normalizeAdminUserPage(page, pageSize)

	params := userServices.AdminUserListParams{
		Page:        page,
		PageSize:    pageSize,
		Keyword:     ctx.Query("keyword"),
		Status:      ctx.Query("status"),
		Role:        ctx.Query("role"),
		CreatedFrom: ctx.Query("created_from"),
		CreatedTo:   ctx.Query("created_to"),
	}

	list, total, err := c.service.ListUsers(params)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data": gin.H{
			"list":      list,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func (c *AdminUserController) GetUser(ctx *gin.Context) {
	userID, ok := parseAdminUserID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid user id", "data": nil})
		return
	}

	detail, err := c.service.GetUserDetail(userID)
	if err != nil {
		if errors.Is(err, userServices.ErrAdminUserNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error(), "data": nil})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": detail})
}

func (c *AdminUserController) UpdateUserStatus(ctx *gin.Context) {
	operatorID, _ := ctx.Get("userID")
	currentUserID, _ := operatorID.(uint)
	if currentUserID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}

	userID, ok := parseAdminUserID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid user id", "data": nil})
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	item, err := c.service.UpdateUserStatus(currentUserID, userID, body.Status)
	if err != nil {
		switch {
		case errors.Is(err, userServices.ErrAdminUserNotFound):
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error(), "data": nil})
		case errors.Is(err, userServices.ErrAdminUserInvalidStatus), errors.Is(err, userServices.ErrAdminUserDisableSelf):
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		default:
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		}
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": item})
}

func (c *AdminUserController) ResetPassword(ctx *gin.Context) {
	userID, ok := parseAdminUserID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid user id", "data": nil})
		return
	}

	var body struct {
		Password string `json:"password" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	if err := c.service.ResetPassword(userID, body.Password); err != nil {
		switch {
		case errors.Is(err, userServices.ErrAdminUserNotFound):
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error(), "data": nil})
		case errors.Is(err, userServices.ErrAdminUserInvalidPass):
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		default:
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		}
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": nil})
}

func parseAdminUserID(raw string) (uint, bool) {
	parsed, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		return 0, false
	}
	return uint(parsed), true
}

func normalizeAdminUserPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}
