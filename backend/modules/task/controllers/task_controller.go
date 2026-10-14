package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/modules/task/repositories"
	"yaolight-workshop/backend/modules/task/services"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

// TaskController 任务控制器
type TaskController struct {
	taskService *services.TaskService
}

// NewTaskController 创建任务控制器实例
func NewTaskController() *TaskController {
	taskRepo := repositories.NewTaskRepository(database.DB)
	nodeExecutionRepo := repositories.NewTaskNodeExecutionRepository(database.DB)
	logRepo := repositories.NewTaskLogRepository(database.DB)
	taskService := services.NewTaskService(taskRepo, nodeExecutionRepo, logRepo)
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	taskService.SetWorkflowExecutionServices(
		workflowServices.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo),
		workflowServices.NewWorkflowExecutor(),
	)

	return &TaskController{
		taskService: taskService,
	}
}

// GetWorkflowTasks 获取工作流的任务列表
// @Summary 获取工作流的任务历史列表
// @Description 获取指定工作流的所有任务执行记录（分页）
// @Tags 任务
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(20)
// @Success 200 {object} services.TaskListResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/workflows/{id}/tasks [get]
func (c *TaskController) GetWorkflowTasks(ctx *gin.Context) {
	workflowIDStr := ctx.Param("id")
	workflowID, err := strconv.ParseUint(workflowIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的工作流ID",
		})
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "20"))

	result, err := c.taskService.GetWorkflowTasks(uint(workflowID), page, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// GetTaskDetail 获取任务详情
// @Summary 获取任务详情
// @Description 获取指定任务的详细信息
// @Tags 任务
// @Accept json
// @Produce json
// @Param id path int true "任务ID"
// @Success 200 {object} models.Task
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/tasks/{id} [get]
func (c *TaskController) GetTaskDetail(ctx *gin.Context) {
	taskIDStr := ctx.Param("id")
	taskID, err := strconv.ParseUint(taskIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的任务ID",
		})
		return
	}

	task, err := c.taskService.GetTaskDetail(uint(taskID))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, task)
}

func (c *TaskController) CancelTask(ctx *gin.Context) {
	userIDAny, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权",
		})
		return
	}

	taskIDStr := ctx.Param("id")
	taskID, err := strconv.ParseUint(taskIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的任务ID",
		})
		return
	}

	result, err := c.taskService.CancelTask(uint(taskID), userIDAny.(uint))
	if err != nil {
		switch err {
		case services.ErrTaskNotOwned:
			ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case services.ErrTaskActionNotAllow:
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *TaskController) RetryFailedTask(ctx *gin.Context) {
	userIDAny, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权",
		})
		return
	}

	taskID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的任务ID",
		})
		return
	}

	result, err := c.taskService.RetryFailedTask(uint(taskID), userIDAny.(uint))
	if err != nil {
		switch err {
		case services.ErrTaskNotOwned:
			ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case services.ErrTaskActionNotAllow:
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			if workflowServices.IsInsufficientTokenBalanceError(err) {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			} else {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
		}
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// GetTaskNodeExecutions 获取任务的节点执行记录
// @Summary 获取任务的节点执行记录
// @Description 获取指定任务的所有节点执行详情
// @Tags 任务
// @Accept json
// @Produce json
// @Param id path int true "任务ID"
// @Success 200 {object} services.TaskNodeExecutionListResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/tasks/{id}/node-executions [get]
func (c *TaskController) GetTaskNodeExecutions(ctx *gin.Context) {
	taskIDStr := ctx.Param("id")
	taskID, err := strconv.ParseUint(taskIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的任务ID",
		})
		return
	}

	result, err := c.taskService.GetTaskNodeExecutions(uint(taskID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// GetTaskNodeExecutionDetail 获取任务单条节点执行详情
func (c *TaskController) GetTaskNodeExecutionDetail(ctx *gin.Context) {
	taskID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的任务ID",
		})
		return
	}

	executionID, err := strconv.ParseUint(ctx.Param("executionId"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的执行记录ID",
		})
		return
	}

	result, err := c.taskService.GetTaskNodeExecutionDetail(uint(taskID), uint(executionID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// GetTaskLogs 获取任务日志
// @Summary 获取任务日志
// @Description 获取指定任务的日志记录，支持按日志级别过滤
// @Tags 任务
// @Accept json
// @Produce json
// @Param id path int true "任务ID"
// @Param level query string false "日志级别 (debug, info, warn, error, fatal)"
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(100)
// @Success 200 {object} services.TaskLogListResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/tasks/{id}/logs [get]
func (c *TaskController) GetTaskLogs(ctx *gin.Context) {
	taskIDStr := ctx.Param("id")
	taskID, err := strconv.ParseUint(taskIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的任务ID",
		})
		return
	}

	level := ctx.Query("level")
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "100"))

	result, err := c.taskService.GetTaskLogs(uint(taskID), level, page, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// GetRunningTasks 获取工作流正在运行的任务
// @Summary 获取正在运行的任务
// @Description 检查指定工作流是否有正在运行的任务，用于前端判断是否需要轮询
// @Tags 任务
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Success 200 {object} services.RunningTasksResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/workflows/{id}/running-tasks [get]
func (c *TaskController) GetRunningTasks(ctx *gin.Context) {
	workflowIDStr := ctx.Param("id")
	workflowID, err := strconv.ParseUint(workflowIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的工作流ID",
		})
		return
	}

	result, err := c.taskService.GetRunningTasks(uint(workflowID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, result)
}
