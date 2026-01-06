package controllers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/modules/project/repositories"
	"yaolight-workshop/backend/modules/project/services"
)

// ProjectController 项目控制器
type ProjectController struct {
	projectService *services.ProjectService
}

// NewProjectController 创建项目控制器
func NewProjectController() *ProjectController {
	projectRepo := repositories.NewProjectRepository(database.DB)
	return &ProjectController{
		projectService: services.NewProjectService(projectRepo),
	}
}

// GetProjectList 获取项目列表
// @Summary 获取项目列表
// @Description 获取当前用户的项目列表（分页）
// @Tags 项目
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(10)
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/projects [get]
func (c *ProjectController) GetProjectList(ctx *gin.Context) {
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

	projects, total, err := c.projectService.GetProjectsByUserID(userID.(uint), page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取项目列表失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": gin.H{
			"list":     projects,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// GetProjectByID 获取项目详情
// @Summary 获取项目详情
// @Description 根据ID获取项目详情
// @Tags 项目
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "项目ID"
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "项目不存在"
// @Router /api/projects/{id} [get]
func (c *ProjectController) GetProjectByID(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的项目ID",
			"data":    nil,
		})
		return
	}

	project, err := c.projectService.GetProjectByID(uint(id))
	if err != nil {
		if err == services.ErrProjectNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "项目不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取项目失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    project,
	})
}

// CreateProject 创建项目
// @Summary 创建项目
// @Description 创建新项目
// @Tags 项目
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body services.CreateProjectRequest true "项目信息"
// @Success 200 {object} map[string]interface{} "创建成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/projects [post]
func (c *ProjectController) CreateProject(ctx *gin.Context) {
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

	var req services.CreateProjectRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	req.UserID = userID.(uint)

	project, err := c.projectService.CreateProject(&req)
	if err != nil {
		log.Printf("创建项目失败: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建项目失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "创建成功",
		"data":    project,
	})
}

// UpdateProject 更新项目
// @Summary 更新项目
// @Description 更新项目信息
// @Tags 项目
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "项目ID"
// @Param request body services.UpdateProjectRequest true "项目信息"
// @Success 200 {object} map[string]interface{} "更新成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "项目不存在"
// @Router /api/projects/{id} [put]
func (c *ProjectController) UpdateProject(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的项目ID",
			"data":    nil,
		})
		return
	}

	var req services.UpdateProjectRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	project, err := c.projectService.UpdateProject(uint(id), &req)
	if err != nil {
		if err == services.ErrProjectNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "项目不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "更新项目失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "更新成功",
		"data":    project,
	})
}

// DeleteProject 删除项目
// @Summary 删除项目
// @Description 删除项目（软删除）
// @Tags 项目
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "项目ID"
// @Success 200 {object} map[string]interface{} "删除成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "项目不存在"
// @Router /api/projects/{id} [delete]
func (c *ProjectController) DeleteProject(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的项目ID",
			"data":    nil,
		})
		return
	}

	if err := c.projectService.DeleteProject(uint(id)); err != nil {
		if err == services.ErrProjectNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "项目不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "删除项目失败: " + err.Error(),
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
