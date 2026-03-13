package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	rbacServices "yaolight-workshop/backend/modules/rbac/services"
)

type AdminRBACController struct {
	service *rbacServices.AdminRBACService
}

func NewAdminRBACController() *AdminRBACController {
	return &AdminRBACController{
		service: rbacServices.NewAdminRBACService(database.DB),
	}
}

func (c *AdminRBACController) ListPermissions(ctx *gin.Context) {
	items, err := c.service.ListPermissions()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": items})
}

func (c *AdminRBACController) ListRoles(ctx *gin.Context) {
	items, err := c.service.ListRoles()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": items})
}

func (c *AdminRBACController) CreateRole(ctx *gin.Context) {
	var body rbacServices.CreateRoleInput
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	item, err := c.service.CreateRole(body)
	if err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": item})
}

func (c *AdminRBACController) UpdateRole(ctx *gin.Context) {
	roleID, ok := parseRBACUintID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid role id", "data": nil})
		return
	}

	var body rbacServices.UpdateRoleInput
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	item, err := c.service.UpdateRole(roleID, body)
	if err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": item})
}

func (c *AdminRBACController) ListAdmins(ctx *gin.Context) {
	items, err := c.service.ListAdminAccounts()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": items})
}

func (c *AdminRBACController) ListPromotableUsers(ctx *gin.Context) {
	items, err := c.service.ListPromotableUsers(ctx.Query("keyword"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": items})
}

func (c *AdminRBACController) CreateAdmin(ctx *gin.Context) {
	var body rbacServices.CreateAdminInput
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	item, err := c.service.CreateAdminAccount(body)
	if err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": item})
}

func (c *AdminRBACController) PromoteAdmin(ctx *gin.Context) {
	var body rbacServices.PromoteAdminInput
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	item, err := c.service.PromoteUserToAdmin(body)
	if err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": item})
}

func (c *AdminRBACController) UpdateAdminRoles(ctx *gin.Context) {
	operatorID, _ := ctx.Get("userID")
	currentUserID, _ := operatorID.(uint)
	if currentUserID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}

	userID, ok := parseRBACUintID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid admin id", "data": nil})
		return
	}

	var body rbacServices.UpdateAdminRolesInput
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	item, err := c.service.UpdateAdminRoles(currentUserID, userID, body)
	if err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": item})
}

func (c *AdminRBACController) UpdateAdminStatus(ctx *gin.Context) {
	operatorID, _ := ctx.Get("userID")
	currentUserID, _ := operatorID.(uint)
	if currentUserID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}

	userID, ok := parseRBACUintID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid admin id", "data": nil})
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	item, err := c.service.UpdateAdminStatus(currentUserID, userID, body.Status)
	if err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": item})
}

func (c *AdminRBACController) ResetAdminPassword(ctx *gin.Context) {
	userID, ok := parseRBACUintID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid admin id", "data": nil})
		return
	}

	var body struct {
		Password string `json:"password" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request body", "data": nil})
		return
	}

	if err := c.service.ResetAdminPassword(userID, body.Password); err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": nil})
}

func (c *AdminRBACController) DemoteAdmin(ctx *gin.Context) {
	operatorID, _ := ctx.Get("userID")
	currentUserID, _ := operatorID.(uint)
	if currentUserID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "unauthorized", "data": nil})
		return
	}

	userID, ok := parseRBACUintID(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid admin id", "data": nil})
		return
	}

	if err := c.service.DemoteAdminToUser(currentUserID, userID); err != nil {
		c.renderRBACError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": gin.H{"id": userID, "role": "user"}})
}

func (c *AdminRBACController) renderRBACError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, rbacServices.ErrRBACRoleNotFound),
		errors.Is(err, rbacServices.ErrRBACAdminNotFound),
		errors.Is(err, rbacServices.ErrRBACUserNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error(), "data": nil})
	case errors.Is(err, rbacServices.ErrRBACRoleProtected),
		errors.Is(err, rbacServices.ErrRBACRoleCodeRequired),
		errors.Is(err, rbacServices.ErrRBACRoleCodeInvalid),
		errors.Is(err, rbacServices.ErrRBACRoleNameRequired),
		errors.Is(err, rbacServices.ErrRBACRoleCodeTaken),
		errors.Is(err, rbacServices.ErrRBACPermissionRequired),
		errors.Is(err, rbacServices.ErrRBACPermissionNotFound),
		errors.Is(err, rbacServices.ErrRBACAdminRolesRequired),
		errors.Is(err, rbacServices.ErrRBACAdminUsernameRequired),
		errors.Is(err, rbacServices.ErrRBACAdminEmailRequired),
		errors.Is(err, rbacServices.ErrRBACAdminUsernameTaken),
		errors.Is(err, rbacServices.ErrRBACAdminEmailTaken),
		errors.Is(err, rbacServices.ErrRBACAdminPasswordInvalid),
		errors.Is(err, rbacServices.ErrRBACAdminSelfRoleEdit),
		errors.Is(err, rbacServices.ErrRBACAdminInvalidStatus),
		errors.Is(err, rbacServices.ErrRBACAdminDisableSelf),
		errors.Is(err, rbacServices.ErrRBACAdminAlreadyExists),
		errors.Is(err, rbacServices.ErrRBACAdminSelfDemote),
		errors.Is(err, rbacServices.ErrRBACAdminLastAdmin):
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
	}
}

func parseRBACUintID(raw string) (uint, bool) {
	parsed, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		return 0, false
	}
	return uint(parsed), true
}
