package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiServices "yaolight-workshop/backend/modules/ai/services"
)

type AdminAIController struct {
	service *aiServices.AdminAIService
}

func NewAdminAIController() *AdminAIController {
	managedModelRepo := aiRepos.NewManagedAIModelRepository(database.DB)
	providerTplRepo := aiRepos.NewProviderTemplateRepository(database.DB)
	capabilityRepo := aiRepos.NewCapabilityConfigRepository(database.DB)
	pricingRepo := aiRepos.NewPricingConfigRepository(database.DB)
	pricingRuleRepo := aiRepos.NewPricingRuleRepository(database.DB)

	return &AdminAIController{
		service: aiServices.NewAdminAIService(
			database.DB,
			managedModelRepo,
			providerTplRepo,
			capabilityRepo,
			pricingRepo,
			pricingRuleRepo,
		),
	}
}

func (c *AdminAIController) GetProviders(ctx *gin.Context) {
	providers, err := c.service.ListProviders()
	if err != nil {
		internalError(ctx, "failed to load providers", err)
		return
	}

	ok(ctx, "ok", providers)
}

func (c *AdminAIController) GetProvider(ctx *gin.Context) {
	provider, err := c.service.GetProvider(ctx.Param("provider"))
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrProviderTemplateNotFound):
			notFound(ctx, "provider not found")
		default:
			internalError(ctx, "failed to load provider", err)
		}
		return
	}

	ok(ctx, "ok", provider)
}

func (c *AdminAIController) GetModels(ctx *gin.Context) {
	models, err := c.service.ListModels()
	if err != nil {
		internalError(ctx, "failed to load models", err)
		return
	}

	ok(ctx, "ok", gin.H{
		"list":  models,
		"total": len(models),
	})
}

func (c *AdminAIController) CreateModel(ctx *gin.Context) {
	var req aiServices.CreateManagedAIModelRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	model, err := c.service.CreateModel(&req)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrInvalidManagedModel):
			badRequest(ctx, err.Error())
		case errors.Is(err, aiServices.ErrProviderTemplateNotFound):
			badRequest(ctx, "provider not found")
		case errors.Is(err, aiServices.ErrManagedModelAlreadyExists):
			conflict(ctx, "model already exists")
		default:
			internalError(ctx, "failed to create model", err)
		}
		return
	}

	ok(ctx, "created", model)
}

func (c *AdminAIController) GetModel(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	model, err := c.service.GetModel(id)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		default:
			internalError(ctx, "failed to load model", err)
		}
		return
	}

	ok(ctx, "ok", model)
}

func (c *AdminAIController) UpdateModel(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var req aiServices.UpdateManagedAIModelRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	model, err := c.service.UpdateModel(id, &req)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		case errors.Is(err, aiServices.ErrInvalidManagedModel):
			badRequest(ctx, err.Error())
		default:
			internalError(ctx, "failed to update model", err)
		}
		return
	}

	ok(ctx, "updated", model)
}

func (c *AdminAIController) DeleteModel(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	if err := c.service.DeleteModel(id); err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		default:
			internalError(ctx, "failed to delete model", err)
		}
		return
	}

	ok(ctx, "deleted", gin.H{"id": id})
}

func (c *AdminAIController) GetModelCapability(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	capability, err := c.service.GetModelCapability(id)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		default:
			internalError(ctx, "failed to load capability", err)
		}
		return
	}

	ok(ctx, "ok", capability)
}

func (c *AdminAIController) UpdateModelCapability(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var payload aiModels.ModelCapabilityConfig
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	capability, err := c.service.UpdateModelCapability(id, &payload)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		default:
			internalError(ctx, "failed to update capability", err)
		}
		return
	}

	ok(ctx, "updated", capability)
}

func (c *AdminAIController) GetModelPricing(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	rules, err := c.service.GetModelPricing(id)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		default:
			internalError(ctx, "failed to load pricing", err)
		}
		return
	}

	ok(ctx, "ok", gin.H{
		"list":  rules,
		"total": len(rules),
	})
}

func (c *AdminAIController) UpdateModelPricing(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var req aiServices.UpsertPricingRuleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	rule, err := c.service.UpsertModelPricing(id, &req)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		case errors.Is(err, aiServices.ErrInvalidManagedModel):
			badRequest(ctx, err.Error())
		default:
			internalError(ctx, "failed to update pricing", err)
		}
		return
	}

	ok(ctx, "updated", rule)
}

func (c *AdminAIController) GetPricingRules(ctx *gin.Context) {
	rules, err := c.service.ListPricingRules()
	if err != nil {
		internalError(ctx, "failed to load pricing rules", err)
		return
	}

	ok(ctx, "ok", gin.H{
		"list":  rules,
		"total": len(rules),
	})
}

func (c *AdminAIController) GetUsage(ctx *gin.Context) {
	var modelID *uint
	if modelIDRaw := ctx.Query("model_id"); modelIDRaw != "" {
		parsed, err := strconv.ParseUint(modelIDRaw, 10, 32)
		if err != nil {
			badRequest(ctx, "invalid model_id")
			return
		}
		id := uint(parsed)
		modelID = &id
	}

	records, err := c.service.GetUsage(modelID)
	if err != nil {
		switch {
		case errors.Is(err, aiServices.ErrManagedModelNotFound):
			notFound(ctx, "model not found")
		default:
			internalError(ctx, "failed to load usage", err)
		}
		return
	}

	ok(ctx, "ok", gin.H{
		"list":  records,
		"total": len(records),
	})
}

func parseUintParam(ctx *gin.Context, name string) (uint, bool) {
	raw := ctx.Param(name)
	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		badRequest(ctx, "invalid "+name)
		return 0, false
	}
	return uint(id), true
}

func ok(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": message,
		"data":    data,
	})
}

func badRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{
		"code":    400,
		"message": message,
		"data":    nil,
	})
}

func notFound(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusNotFound, gin.H{
		"code":    404,
		"message": message,
		"data":    nil,
	})
}

func conflict(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusConflict, gin.H{
		"code":    409,
		"message": message,
		"data":    nil,
	})
}

func internalError(ctx *gin.Context, message string, err error) {
	ctx.JSON(http.StatusInternalServerError, gin.H{
		"code":    500,
		"message": message + ": " + err.Error(),
		"data":    nil,
	})
}
