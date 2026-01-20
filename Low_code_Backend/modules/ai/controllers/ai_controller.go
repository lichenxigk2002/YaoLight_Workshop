package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/modules/ai/repositories"
	"yaolight-workshop/backend/modules/ai/services"
)

// AIController AI控制器
type AIController struct {
	aiService *services.AIService
}

// NewAIController 创建AI控制器
func NewAIController() *AIController {
	modelRepo := repositories.NewAIModelRepository(database.DB)
	templateRepo := repositories.NewProviderTemplateRepository(database.DB)
	return &AIController{
		aiService: services.NewAIService(modelRepo, templateRepo),
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
