package controllers

import (
	"errors"
	"net/http"
	"strconv"
	"syscall"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowService "yaolight-workshop/backend/modules/workflow/services"
)

// safeFlush 安全地刷新响应，忽略连接已关闭的错误
func safeFlush(ctx *gin.Context) error {
	defer func() {
		// 捕获panic，避免程序崩溃
		if r := recover(); r != nil {
			log.Printf("刷新SSE响应时发生panic（连接可能已关闭）: %v", r)
		}
	}()

	// Flush() 方法没有返回值，直接调用
	ctx.Writer.Flush()

	// 检查响应写入器是否有错误
	if ctx.Writer.Status() >= 400 {
		return nil // 状态码错误由其他机制处理
	}
	return nil
}

// isConnectionClosed 检查错误是否是连接已关闭
func isConnectionClosed(err error) bool {
	if err == nil {
		return false
	}

	// 检查是否是syscall错误（Windows上的wsasend错误）
	if sysErr, ok := err.(*syscall.Errno); ok {
		// WSAECONNABORTED (10053) 或 WSAECONNRESET (10054)
		if *sysErr == 10053 || *sysErr == 10054 {
			return true
		}
	}

	// 检查错误消息中是否包含连接关闭的关键词
	errStr := err.Error()
	return contains(errStr, "connection") && (contains(errStr, "aborted") || contains(errStr, "reset") || contains(errStr, "closed"))
}

// contains 检查字符串是否包含子字符串（不区分大小写）
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
			containsHelper(s, substr))))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// WorkflowController 工作流控制器
type WorkflowController struct {
	workflowService        *workflowService.WorkflowService
	templateLibraryService *workflowService.WorkflowTemplateLibraryService
	executor               *workflowService.WorkflowExecutor
}

// NewWorkflowController 创建工作流控制器
func NewWorkflowController() *WorkflowController {
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	return &WorkflowController{
		workflowService:        workflowService.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo),
		templateLibraryService: workflowService.NewWorkflowTemplateLibraryService(database.DB),
		executor:               workflowService.NewWorkflowExecutor(),
	}
}

// ExecuteWorkflowRequest 执行工作流请求（包含可选的workflowId）
type ExecuteWorkflowRequest struct {
	WorkflowID *uint                        `json:"workflowId,omitempty"` // 可选的工作流ID，如果提供则从数据库加载配置
	Nodes      []workflowService.NodeConfig `json:"nodes,omitempty"`      // 节点配置（如果workflowId为空则使用此配置）
	Edges      []workflowService.EdgeConfig `json:"edges,omitempty"`      // 边配置（如果workflowId为空则使用此配置）
}

// ExecuteWorkflow 执行工作流
// @Summary 执行工作流
// @Description 执行工作流，支持爬虫、AI、输出等节点。如果提供workflowId，则从数据库加载配置；否则使用请求中的nodes和edges配置
// @Tags 工作流
// @Accept json
// @Produce json
// @Param request body ExecuteWorkflowRequest true "执行请求"
// @Success 200 {object} map[string]interface{} "执行成功"
// @Router /api/workflows/execute [post]
func (c *WorkflowController) ExecuteWorkflow(ctx *gin.Context) {
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

	var execReq ExecuteWorkflowRequest

	if err := ctx.ShouldBindJSON(&execReq); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 构建执行请求
	var req workflowService.ExecutionRequest
	req.UserID = userID.(uint)

	// 如果提供了workflowId，从数据库加载配置
	if execReq.WorkflowID != nil && *execReq.WorkflowID > 0 {
		req.WorkflowID = *execReq.WorkflowID
		workflowNodes, err := c.workflowService.GetWorkflowNodes(*execReq.WorkflowID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": "加载工作流配置失败: " + err.Error(),
				"data":    nil,
			})
			return
		}

		// 转换为执行器需要的格式
		req.Nodes = make([]workflowService.NodeConfig, len(workflowNodes.Nodes))
		for i, node := range workflowNodes.Nodes {
			config := map[string]interface{}{}
			if node.Data != nil {
				if configMap, ok := node.Data["config"].(map[string]interface{}); ok {
					config = configMap
				}
			}
			req.Nodes[i] = workflowService.NodeConfig{
				ID:     node.ID,
				Type:   node.Type,
				Config: config,
			}
		}

		req.Edges = make([]workflowService.EdgeConfig, len(workflowNodes.Edges))
		for i, edge := range workflowNodes.Edges {
			req.Edges[i] = workflowService.EdgeConfig{
				Source:       edge.Source,
				Target:       edge.Target,
				SourceHandle: edge.SourceHandle,
				TargetHandle: edge.TargetHandle,
			}
		}
	} else {
		// 使用请求中的配置
		req.Nodes = execReq.Nodes
		req.Edges = execReq.Edges
	}

	// 总是使用流式执行接口，以便实时显示所有节点的执行结果
	// 即使没有流式输出的AI节点，也可以实时显示其他节点的执行结果
	// 这样所有节点都可以一个一个显示，而不是等所有节点执行完才显示
	log.Printf("使用流式执行接口，实时显示所有节点的执行结果")

	// 使用流式执行接口
	{
		// 设置SSE响应头
		ctx.Header("Content-Type", "text/event-stream")
		ctx.Header("Cache-Control", "no-cache")
		ctx.Header("Connection", "keep-alive")
		ctx.Header("X-Accel-Buffering", "no") // 禁用nginx缓冲

		// 创建流式回调
		callback := func(nodeID string, content string, done bool, contentType string, err error) {
			// 检查上下文是否已取消（客户端断开连接）
			select {
			case <-ctx.Request.Context().Done():
				// 连接已关闭，不再发送数据
				return
			default:
				// 连接正常，继续处理
			}

			if err != nil {
				// 发送错误事件
				ctx.SSEvent("error", map[string]interface{}{
					"nodeId": nodeID,
					"error":  err.Error(),
					"done":   true,
				})
				safeFlush(ctx)
				return
			}

			// 发送消息事件
			event := map[string]interface{}{
				"nodeId":      nodeID,
				"content":     content,
				"done":        done,
				"contentType": contentType,
			}
			ctx.SSEvent("message", event)
			safeFlush(ctx)
		}

		// 执行流式工作流
		log.Printf("流式执行: 开始执行工作流，节点数: %d", len(req.Nodes))
		err := c.executor.ExecuteWorkflowStreamConcurrent(ctx.Request.Context(), req, callback)
		if err != nil {
			log.Printf("流式执行: 执行失败: %v", err)
			// 检查上下文是否已取消
			select {
			case <-ctx.Request.Context().Done():
				// 连接已关闭，不发送错误
				log.Printf("流式执行: 连接已关闭，不发送错误")
				return
			default:
				// 连接正常，发送错误
				ctx.SSEvent("error", map[string]interface{}{
					"error": err.Error(),
					"done":  true,
				})
				safeFlush(ctx)
			}
		} else {
			log.Printf("流式执行: 执行完成")
		}
		return
	}

	// 执行工作流（非流式）
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

// ExecuteWorkflowStream 流式执行工作流（SSE）
// @Summary 流式执行工作流
// @Description 使用Server-Sent Events流式执行工作流，实时返回AI节点输出。如果提供workflowId，则从数据库加载配置；否则使用请求中的nodes和edges配置
// @Tags 工作流
// @Accept json
// @Produce text/event-stream
// @Param request body ExecuteWorkflowRequest true "执行请求"
// @Success 200 {string} text/event-stream "流式响应"
// @Router /api/workflows/execute/stream [post]
func (c *WorkflowController) ExecuteWorkflowStream(ctx *gin.Context) {
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

	var execReq ExecuteWorkflowRequest
	if err := ctx.ShouldBindJSON(&execReq); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 构建执行请求
	var req workflowService.ExecutionRequest
	req.UserID = userID.(uint)

	// 如果提供了workflowId，从数据库加载配置
	if execReq.WorkflowID != nil && *execReq.WorkflowID > 0 {
		req.WorkflowID = *execReq.WorkflowID
		workflowNodes, err := c.workflowService.GetWorkflowNodes(*execReq.WorkflowID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": "加载工作流配置失败: " + err.Error(),
				"data":    nil,
			})
			return
		}

		// 转换为执行器需要的格式
		req.Nodes = make([]workflowService.NodeConfig, len(workflowNodes.Nodes))
		for i, node := range workflowNodes.Nodes {
			config := map[string]interface{}{}
			if node.Data != nil {
				if configMap, ok := node.Data["config"].(map[string]interface{}); ok {
					config = configMap
				}
			}
			req.Nodes[i] = workflowService.NodeConfig{
				ID:     node.ID,
				Type:   node.Type,
				Config: config,
			}
		}

		req.Edges = make([]workflowService.EdgeConfig, len(workflowNodes.Edges))
		for i, edge := range workflowNodes.Edges {
			req.Edges[i] = workflowService.EdgeConfig{
				Source:       edge.Source,
				Target:       edge.Target,
				SourceHandle: edge.SourceHandle,
				TargetHandle: edge.TargetHandle,
			}
		}
	} else {
		// 使用请求中的配置
		req.Nodes = execReq.Nodes
		req.Edges = execReq.Edges
	}

	// 设置SSE响应头
	ctx.Header("Content-Type", "text/event-stream")
	ctx.Header("Cache-Control", "no-cache")
	ctx.Header("Connection", "keep-alive")
	ctx.Header("X-Accel-Buffering", "no") // 禁用nginx缓冲

	// 获取请求上下文，用于检测连接是否关闭
	requestCtx := ctx.Request.Context()

	// 创建流式回调
	callback := func(nodeID string, content string, done bool, contentType string, err error) {
		// 检查上下文是否已取消（客户端断开连接）
		select {
		case <-requestCtx.Done():
			// 连接已关闭，不再发送数据
			return
		default:
			// 连接正常，继续处理
		}

		if err != nil {
			// 发送错误事件
			ctx.SSEvent("error", map[string]interface{}{
				"nodeId": nodeID,
				"error":  err.Error(),
				"done":   true,
			})
			// 安全地刷新，忽略连接已关闭的错误
			if flushErr := safeFlush(ctx); flushErr != nil {
				log.Printf("刷新SSE响应失败（连接可能已关闭）: %v", flushErr)
			}
			return
		}

		// 发送消息事件
		event := map[string]interface{}{
			"nodeId":      nodeID,
			"content":     content,
			"done":        done,
			"contentType": contentType, // 添加内容类型：reasoning/content/""
		}
		ctx.SSEvent("message", event)
		// 安全地刷新，忽略连接已关闭的错误
		if flushErr := safeFlush(ctx); flushErr != nil {
			log.Printf("刷新SSE响应失败（连接可能已关闭）: %v", flushErr)
			return
		}
	}

	// 执行流式工作流
	err := c.executor.ExecuteWorkflowStreamConcurrent(requestCtx, req, callback)
	if err != nil {
		// 检查上下文是否已取消
		select {
		case <-requestCtx.Done():
			// 连接已关闭，不发送错误
			return
		default:
			// 连接正常，发送错误
			ctx.SSEvent("error", map[string]interface{}{
				"error": err.Error(),
				"done":  true,
			})
			safeFlush(ctx)
		}
	}
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
func (c *WorkflowController) ListPublishedTemplates(ctx *gin.Context) {
	page := 1
	pageSize := 12
	if pageStr := ctx.Query("page"); pageStr != "" {
		if parsed, err := strconv.Atoi(pageStr); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if pageSizeStr := ctx.Query("pageSize"); pageSizeStr != "" {
		if parsed, err := strconv.Atoi(pageSizeStr); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	items, total, err := c.templateLibraryService.ListPublishedTemplates(workflowService.WorkflowTemplateLibraryQuery{
		Keyword:  ctx.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "failed to load workflow templates: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data": gin.H{
			"list":     items,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func (c *WorkflowController) GetPublishedTemplateNodes(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "invalid workflow template id",
			"data":    nil,
		})
		return
	}

	canvas, err := c.templateLibraryService.GetPublishedTemplateNodes(uint(id))
	if err != nil {
		switch err {
		case workflowService.ErrWorkflowTemplateNotFound:
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": err.Error(),
				"data":    nil,
			})
		case workflowService.ErrWorkflowTemplateNotPublic:
			ctx.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": err.Error(),
				"data":    nil,
			})
		default:
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": "failed to load workflow template: " + err.Error(),
				"data":    nil,
			})
		}
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "ok",
		"data":    canvas,
	})
}

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
		if errors.Is(err, workflowService.ErrPublishedWorkflowAPICanvasInvalid) {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": err.Error(),
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

// SaveWorkflowNode 保存单个节点
// @Summary 保存单个节点
// @Description 保存工作流的单个节点配置
// @Tags 工作流
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "工作流ID"
// @Param nodeId path string true "节点ID"
// @Param request body workflowService.SaveWorkflowNodeRequest true "节点数据"
// @Success 200 {object} map[string]interface{} "保存成功"
// @Failure 400 {object} map[string]interface{} "请求参数错误"
// @Failure 401 {object} map[string]interface{} "未授权"
// @Failure 404 {object} map[string]interface{} "工作流不存在"
// @Router /api/workflows/{id}/nodes/{nodeId} [put]
func (c *WorkflowController) SaveWorkflowNode(ctx *gin.Context) {
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

	nodeID := ctx.Param("nodeId")
	if nodeID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "节点ID不能为空",
			"data":    nil,
		})
		return
	}

	var req workflowService.SaveWorkflowNodeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	if err := c.workflowService.SaveWorkflowNode(uint(id), nodeID, &req); err != nil {
		if err == workflowService.ErrWorkflowNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": "工作流不存在",
				"data":    nil,
			})
			return
		}
		if errors.Is(err, workflowService.ErrPublishedWorkflowAPICanvasInvalid) {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"code":    400,
				"message": err.Error(),
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
