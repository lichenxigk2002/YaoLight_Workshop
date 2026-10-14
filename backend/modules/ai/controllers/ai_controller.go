package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/modules/ai/repositories"
	"yaolight-workshop/backend/modules/ai/services"

	"github.com/gin-gonic/gin"
)

// AIController AI控制器
type AIController struct {
	aiService *services.AIService
}

// NewAIController 创建AI控制器
func NewAIController() *AIController {
	modelRepo := repositories.NewAIModelRepository(database.DB)
	templateRepo := repositories.NewProviderTemplateRepository(database.DB)
	pricingRepo := repositories.NewPricingConfigRepository(database.DB)
	capabilityRepo := repositories.NewCapabilityConfigRepository(database.DB)
	return &AIController{
		aiService: services.NewAIService(modelRepo, templateRepo, pricingRepo, capabilityRepo),
	}
}

// GetProviderTemplates 获取供应商模板列表
func (c *AIController) GetProviderTemplates(ctx *gin.Context) {
	templates, err := c.aiService.GetProviderTemplates()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取供应商模板失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    templates,
	})
}

// GetSystemPresetModels 获取系统预设模型列表
func (c *AIController) GetSystemPresetModels(ctx *gin.Context) {
	models := c.aiService.GetSystemPresetModels()
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    models,
	})
}

// GetModelCapability 按 provider+model_name 获取模型能力配置
func (c *AIController) GetModelCapability(ctx *gin.Context) {
	provider := ctx.Query("provider")
	modelName := ctx.Query("model_name")
	if provider == "" || modelName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "缺少 provider 或 model_name",
			"data":    nil,
		})
		return
	}
	cap := c.aiService.GetModelCapability(provider, modelName)
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    cap,
	})
}

// GetModels 获取用户自己的模型列表
func (c *AIController) GetModels(ctx *gin.Context) {
	// 从中间件获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	// 获取分页参数
	page := 1
	pageSize := 10
	if pageStr := ctx.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if pageSizeStr := ctx.Query("pageSize"); pageSizeStr != "" {
		if ps, err := strconv.Atoi(pageSizeStr); err == nil && ps > 0 {
			pageSize = ps
		}
	}

	models, total, err := c.aiService.GetModelsByUserID(userID.(uint), page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取模型列表失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 为 __provider_default__ 模型添加 supportedModels 字段
	// 获取所有供应商的子模型列表
	pricingRepo := repositories.NewPricingConfigRepository(database.DB)
	allPricingConfigs, err := pricingRepo.FindAll()
	if err == nil {
		// 按 provider 分组模型
		modelsByProvider := make(map[string][]string)
		for _, config := range allPricingConfigs {
			if config.IsActive {
				modelsByProvider[config.Provider] = append(modelsByProvider[config.Provider], config.ModelName)
			}
		}

		// 构建包含 supportedModels 的模型列表
		modelsWithSupported := make([]map[string]interface{}, len(models))
		for i, model := range models {
			modelMap := map[string]interface{}{
				"id":          model.ID,
				"name":        model.Name,
				"provider":    model.Provider,
				"modelName":   model.ModelName,
				"status":      model.Status,
				"temperature": model.Temperature,
				"maxTokens":   model.MaxTokens,
				"baseUrl":     model.BaseURL,
				"endpoint":    model.Endpoint,
				"params":      model.Params,
				"createdAt":   model.CreatedAt,
				"updatedAt":   model.UpdatedAt,
			}
			modelIcon, providerIcon := c.aiService.ResolveModelIcons(model.Provider, model.ModelName)
			modelMap["modelIcon"] = modelIcon
			modelMap["providerIcon"] = providerIcon
			// 如果是 __provider_default__，添加 supportedModels
			if model.ModelName == "__provider_default__" {
				if supportedModels, exists := modelsByProvider[model.Provider]; exists {
					modelMap["supportedModels"] = supportedModels
				} else {
					modelMap["supportedModels"] = []string{}
				}
			}
			modelsWithSupported[i] = modelMap
		}
		ctx.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "获取成功",
			"data": gin.H{
				"list":     modelsWithSupported,
				"total":    total,
				"page":     page,
				"pageSize": pageSize,
			},
		})
		return
	}

	// 如果查询失败，返回原始数据
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": gin.H{
			"list":     models,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// CreateModel 创建模型配置
func (c *AIController) CreateModel(ctx *gin.Context) {
	// 从中间件获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	var req services.CreateModelRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	req.UserID = userID.(uint)

	model, err := c.aiService.CreateModel(&req)
	if err != nil {
		if errors.Is(err, services.ErrUnsupportedProvider) {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "创建模型失败: " + err.Error(),
				"data":    nil,
			})
			return
		}
		if errors.Is(err, services.ErrInvalidAPIKey) {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": "创建模型失败: " + err.Error(),
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建模型失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "创建成功",
		"data":    model,
	})
}

// UpdateModel 更新模型配置
func (c *AIController) UpdateModel(ctx *gin.Context) {
	// 从中间件获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的模型ID",
			"data":    nil,
		})
		return
	}

	var req services.UpdateModelRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	model, err := c.aiService.UpdateModel(uint(id), userID.(uint), &req)
	if err != nil {
		if err == services.ErrModelNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "模型不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "更新模型失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "更新成功",
		"data":    model,
	})
}

// DeleteModel 删除模型配置
func (c *AIController) DeleteModel(ctx *gin.Context) {
	// 从中间件获取用户ID
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的模型ID",
			"data":    nil,
		})
		return
	}

	err = c.aiService.DeleteModel(uint(id), userID.(uint))
	if err != nil {
		if err == services.ErrModelNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "模型不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "删除模型失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "删除成功",
		"data":    nil,
	})
}

// RepairCode 使用 AI 修复代码节点脚本
func (c *AIController) RepairCode(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	var req services.CodeRepairRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	result, err := c.aiService.RepairCode(userID.(uint), &req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "AI 修复代码失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "修复成功",
		"data":    result,
	})
}
