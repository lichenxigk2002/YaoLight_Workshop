package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	nodeServices "yaolight-workshop/backend/modules/node/services"
)

type AdminNodeTypeController struct {
	service *nodeServices.AdminNodeTypeService
}

func NewAdminNodeTypeController() *AdminNodeTypeController {
	return &AdminNodeTypeController{
		service: nodeServices.NewAdminNodeTypeService(database.DB),
	}
}

func (c *AdminNodeTypeController) GetSummary(ctx *gin.Context) {
	summary, err := c.service.GetSummary()
	if err != nil {
		internalError(ctx, "failed to load node type summary", err)
		return
	}
	ok(ctx, "ok", summary)
}

func (c *AdminNodeTypeController) ListNodeTypes(ctx *gin.Context) {
	var isSystem *bool
	if raw := ctx.Query("is_system"); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			badRequest(ctx, "invalid is_system")
			return
		}
		isSystem = &value
	}

	var isActive *bool
	if raw := ctx.Query("is_active"); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			badRequest(ctx, "invalid is_active")
			return
		}
		isActive = &value
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	result, err := c.service.ListNodeTypes(nodeServices.AdminNodeTypeListQuery{
		Keyword:  ctx.Query("keyword"),
		Category: ctx.Query("category"),
		IsSystem: isSystem,
		IsActive: isActive,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		internalError(ctx, "failed to list node types", err)
		return
	}
	ok(ctx, "ok", result)
}

func (c *AdminNodeTypeController) GetNodeType(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	item, err := c.service.GetNodeType(id)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to load node type")
		return
	}
	ok(ctx, "ok", item)
}

func (c *AdminNodeTypeController) CreateNodeType(ctx *gin.Context) {
	var payload nodeServices.AdminNodeTypePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.CreateNodeType(&payload)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to create node type")
		return
	}
	ok(ctx, "created", item)
}

func (c *AdminNodeTypeController) UpdateNodeType(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var payload nodeServices.AdminNodeTypePayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	item, err := c.service.UpdateNodeType(id, &payload)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to update node type")
		return
	}
	ok(ctx, "updated", item)
}

func (c *AdminNodeTypeController) SetNodeTypeStatus(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var payload nodeServices.AdminNodeTypeStatusPayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	if err := c.service.SetNodeTypeStatus(id, payload.IsActive); err != nil {
		c.handleServiceError(ctx, err, "failed to update node type status")
		return
	}
	ok(ctx, "updated", gin.H{"id": id, "is_active": payload.IsActive})
}

func (c *AdminNodeTypeController) DeleteNodeType(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	if err := c.service.DeleteNodeType(id); err != nil {
		c.handleServiceError(ctx, err, "failed to delete node type")
		return
	}
	ok(ctx, "deleted", gin.H{"id": id})
}

func (c *AdminNodeTypeController) handleServiceError(ctx *gin.Context, err error, message string) {
	switch {
	case errors.Is(err, nodeServices.ErrAdminNodeTypeNotFound):
		notFound(ctx, "node type not found")
	case errors.Is(err, nodeServices.ErrAdminNodeTypeCategoryDup),
		errors.Is(err, nodeServices.ErrAdminNodeTypeInvalidPayload),
		errors.Is(err, nodeServices.ErrAdminNodeTypeSystemDelete),
		errors.Is(err, nodeServices.ErrAdminNodeTypeReferenced):
		badRequest(ctx, err.Error())
	default:
		internalError(ctx, message, err)
	}
}

func ok(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": message, "data": data})
}

func badRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": message, "data": nil})
}

func notFound(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": message, "data": nil})
}

func internalError(ctx *gin.Context, message string, err error) {
	ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": message, "data": nil})
}

func parseUintParam(ctx *gin.Context, name string) (uint, bool) {
	raw := ctx.Param(name)
	value, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		badRequest(ctx, "invalid "+name)
		return 0, false
	}
	return uint(value), true
}
