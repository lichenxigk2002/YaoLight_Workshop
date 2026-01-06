package controllers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"workflow-management-system/backend/infrastructure/database"
	workflowModels "workflow-management-system/backend/modules/workflow/models"
	workflowRepos "workflow-management-system/backend/modules/workflow/repositories"
	workflowService "workflow-management-system/backend/modules/workflow/services"
)

// WorkflowController 工作流控制器
type WorkflowController struct {
	workflowService *workflowService.WorkflowService
	executor        *workflowService.WorkflowExecutor
}

// NewWorkflowController 创建工作流控制器
func NewWorkflowController() *WorkflowController {
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	return &WorkflowController{
		workflowService: workflowService.NewWorkflowService(workflowRepo, workflowNodeRepo),
		executor:        workflowService.NewWorkflowExecutor(),
	}
}

// ExecuteWorkflow 执行工作流
// @Summary 执行工作流
// @Description 执行工作流，支持爬虫、AI、输出等节点
// @Tags 工作流
// @Accept json
// @Produce json
// @Param request body workflowService.ExecutionRequest true "执行请求"
// @Success 200 {object} map[string]interface{} "执行成功"
// @Router /api/workflows/execute [post]
func (c *WorkflowController) ExecuteWorkflow(ctx *gin.Context) {
	var req workflowService.ExecutionRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 执行工作流
	result, err := c.executor.Execute(req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "执行失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 返回统一格式的响应
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "执行成功",
		"data":    result,
	})
}

// GetWorkflowList 获取工作流列表
// @Summary 获取工作流列表
// @Description 获取工作流列表（支持按项目ID筛选）
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param projectId query int false "项目ID"
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(10)
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/workflows [get]
func (c *WorkflowController) GetWorkflowList(ctx *gin.Context) {
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

	var workflows []*workflowModels.Workflow
	var total int64
	var err error

	// 如果提供了项目ID，按项目ID查询；否则按用户ID查询
	// 支持 projectId 和 project_id 两种参数名
	projectIDStr := ctx.Query("projectId")
	if projectIDStr == "" {
		projectIDStr = ctx.Query("project_id")
	}
	if projectIDStr != "" {
		projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
		if err == nil {
			workflows, total, err = c.workflowService.GetWorkflowsByProjectID(uint(projectID), page, pageSize)
		} else {
			workflows, total, err = c.workflowService.GetWorkflowsByUserID(userID.(uint), page, pageSize)
		}
	} else {
		workflows, total, err = c.workflowService.GetWorkflowsByUserID(userID.(uint), page, pageSize)
	}

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取工作流列表失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": gin.H{
			"list":     workflows,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// GetWorkflowByID 获取工作流详情
// @Summary 获取工作流详情
// @Description 根据ID获取工作流详情
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "工作流不存在"
// @Router /api/workflows/{id} [get]
func (c *WorkflowController) GetWorkflowByID(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的工作流ID",
			"data":    nil,
		})
		return
	}

	workflow, err := c.workflowService.GetWorkflowByID(uint(id))
	if err != nil {
		if err == workflowService.ErrWorkflowNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "工作流不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取工作流失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    workflow,
	})
}

// CreateWorkflow 创建工作流
// @Summary 创建工作流
// @Description 创建新工作流
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body workflowService.CreateWorkflowRequest true "工作流信息"
// @Success 200 {object} map[string]interface{} "创建成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Router /api/workflows [post]
func (c *WorkflowController) CreateWorkflow(ctx *gin.Context) {
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

	var req workflowService.CreateWorkflowRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	req.UserID = userID.(uint)

	workflow, err := c.workflowService.CreateWorkflow(&req)
	if err != nil {
		log.Printf("创建工作流失败: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建工作流失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "创建成功",
		"data":    workflow,
	})
}

// UpdateWorkflow 更新工作流
// @Summary 更新工作流
// @Description 更新工作流信息
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Param request body workflowService.UpdateWorkflowRequest true "工作流信息"
// @Success 200 {object} map[string]interface{} "更新成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "工作流不存在"
// @Router /api/workflows/{id} [put]
func (c *WorkflowController) UpdateWorkflow(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的工作流ID",
			"data":    nil,
		})
		return
	}

	var req workflowService.UpdateWorkflowRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	workflow, err := c.workflowService.UpdateWorkflow(uint(id), &req)
	if err != nil {
		if err == workflowService.ErrWorkflowNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "工作流不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "更新工作流失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "更新成功",
		"data":    workflow,
	})
}

// DeleteWorkflow 删除工作流
// @Summary 删除工作流
// @Description 删除工作流（软删除）
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Success 200 {object} map[string]interface{} "删除成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "工作流不存在"
// @Router /api/workflows/{id} [delete]
func (c *WorkflowController) DeleteWorkflow(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的工作流ID",
			"data":    nil,
		})
		return
	}

	if err := c.workflowService.DeleteWorkflow(uint(id)); err != nil {
		if err == workflowService.ErrWorkflowNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "工作流不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "删除工作流失败: " + err.Error(),
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

// SaveWorkflowNodes 保存工作流节点和边
// @Summary 保存工作流节点和边
// @Description 保存工作流的节点和边数据
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Param request body workflowService.SaveWorkflowNodesRequest true "节点和边数据"
// @Success 200 {object} map[string]interface{} "保存成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "工作流不存在"
// @Router /api/workflows/{id}/nodes [put]
func (c *WorkflowController) SaveWorkflowNodes(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的工作流ID",
			"data":    nil,
		})
		return
	}

	var req workflowService.SaveWorkflowNodesRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	if err := c.workflowService.SaveWorkflowNodes(uint(id), &req); err != nil {
		if err == workflowService.ErrWorkflowNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "工作流不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "保存节点失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "保存成功",
		"data":    nil,
	})
}

// GetWorkflowNodes 获取工作流节点和边
// @Summary 获取工作流节点和边
// @Description 获取工作流的节点和边数据
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Success 200 {object} map[string]interface{} "获取成功"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "工作流不存在"
// @Router /api/workflows/{id}/nodes [get]
func (c *WorkflowController) GetWorkflowNodes(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的工作流ID",
			"data":    nil,
		})
		return
	}

	nodes, err := c.workflowService.GetWorkflowNodes(uint(id))
	if err != nil {
		if err == workflowService.ErrWorkflowNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "工作流不存在",
				"data":    nil,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取节点失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    nodes,
	})
}
