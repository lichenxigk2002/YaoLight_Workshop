package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
	"yaolight-workshop/backend/modules/alkaid/services/agentic"
)

// AlkaidController 瑶光星控制器
type AlkaidController struct {
	alkaidService *alkaidServices.AlkaidService
}

// NewAlkaidController 创建瑶光星控制器
func NewAlkaidController() *AlkaidController {
	return &AlkaidController{
		alkaidService: alkaidServices.NewAlkaidService(),
	}
}

// CreateSession 创建会话
func (c *AlkaidController) CreateSession(ctx *gin.Context) {
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

	var req alkaidServices.CreateSessionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	req.UserID = userID.(uint)

	// 如果没有提供标题，使用默认标题
	if req.Title == "" {
		req.Title = "新对话"
	}

	session, err := c.alkaidService.CreateSession(req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建会话失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "创建成功",
		"data":    session,
	})
}

// GetSessions 获取会话列表
func (c *AlkaidController) GetSessions(ctx *gin.Context) {
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
	pageSize := 20
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

	sessions, total, err := c.alkaidService.GetUserSessions(userID.(uint), page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取会话列表失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": gin.H{
			"list":     sessions,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// GetSession 获取会话详情
func (c *AlkaidController) GetSession(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	sessionIDStr := ctx.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的会话ID",
			"data":    nil,
		})
		return
	}

	session, err := c.alkaidService.GetSession(uint(sessionID))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "会话不存在",
			"data":    nil,
		})
		return
	}

	// 验证会话属于该用户
	if session.UserID != userID.(uint) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"code":    403,
			"message": "无权访问该会话",
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    session,
	})
}

// UpdateSessionTitle 更新会话标题
func (c *AlkaidController) UpdateSessionTitle(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	sessionIDStr := ctx.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的会话ID",
			"data":    nil,
		})
		return
	}

	var req struct {
		Title string `json:"title" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 验证会话存在且属于该用户
	session, err := c.alkaidService.GetSession(uint(sessionID))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "会话不存在",
			"data":    nil,
		})
		return
	}

	if session.UserID != userID.(uint) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"code":    403,
			"message": "无权访问该会话",
			"data":    nil,
		})
		return
	}

	if err := c.alkaidService.UpdateSessionTitle(uint(sessionID), req.Title); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "更新会话标题失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "更新成功",
		"data":    nil,
	})
}

// DeleteSession 删除会话
func (c *AlkaidController) DeleteSession(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	sessionIDStr := ctx.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的会话ID",
			"data":    nil,
		})
		return
	}

	// 验证会话存在且属于该用户
	session, err := c.alkaidService.GetSession(uint(sessionID))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "会话不存在",
			"data":    nil,
		})
		return
	}

	if session.UserID != userID.(uint) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"code":    403,
			"message": "无权访问该会话",
			"data":    nil,
		})
		return
	}

	if err := c.alkaidService.DeleteSession(uint(sessionID)); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "删除会话失败: " + err.Error(),
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

// SendMessage 发送消息
func (c *AlkaidController) SendMessage(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	var req alkaidServices.SendMessageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	req.UserID = userID.(uint)

	response, err := c.alkaidService.SendMessage(req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "发送消息失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "发送成功",
		"data":    response,
	})
}

// SendMessageStream 流式发送消息
func (c *AlkaidController) SendMessageStream(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	var req alkaidServices.SendMessageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "请求参数错误: " + err.Error(),
			"data":    nil,
		})
		return
	}

	req.UserID = userID.(uint)

	// 设置SSE响应头
	ctx.Header("Content-Type", "text/event-stream")
	ctx.Header("Cache-Control", "no-cache")
	ctx.Header("Connection", "keep-alive")
	ctx.Header("X-Accel-Buffering", "no")

	// 安全刷新函数
	safeFlush := func() error {
		if f, ok := ctx.Writer.(http.Flusher); ok {
			f.Flush()
			return nil
		}
		return nil
	}

	// 监听客户端断开
	clientGone := ctx.Request.Context().Done()

	// 调用Service流式处理
	_, err := c.alkaidService.SendMessageStream(req, func(content string, step string, done bool, err error) {
		select {
		case <-clientGone:
			return
		default:
			if err != nil {
				// 发送错误事件
				eventData := map[string]interface{}{
					"error": err.Error(),
					"done":  true,
				}
				data, _ := json.Marshal(eventData)
				ctx.Writer.WriteString("event: error\n")
				ctx.Writer.WriteString("data: " + string(data) + "\n\n")
				safeFlush()
				return
			}

			// 发送消息事件
			eventData := map[string]interface{}{
				"content": content,
				"step":    step,
				"done":    done,
			}
			data, _ := json.Marshal(eventData)
			ctx.Writer.WriteString("event: message\n")
			ctx.Writer.WriteString("data: " + string(data) + "\n\n")
			safeFlush()
		}
	})

	if err != nil {
		// 如果Service返回错误，且连接未断开，发送错误事件
		select {
		case <-clientGone:
			return
		default:
			eventData := map[string]interface{}{
				"error": err.Error(),
				"done":  true,
			}
			data, _ := json.Marshal(eventData)
			ctx.Writer.WriteString("event: error\n")
			ctx.Writer.WriteString("data: " + string(data) + "\n\n")
			safeFlush()
		}
	}
}

// SessionStream Agentic 流式接口：POST /alkaid/sessions/:id/stream，SSE 推送 content/phase_changed/tool_step_*/done/error
func (c *AlkaidController) SessionStream(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code": 401, "message": "未授权", "data": nil,
		})
		return
	}
	sessionIDStr := ctx.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code": 400, "message": "无效的会话ID", "data": nil,
		})
		return
	}
	var body struct {
		Message   string                 `json:"message"`
		Interrupt bool                   `json:"interrupt"`
		Context   map[string]interface{} `json:"context"` // 新增 context 字段
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code": 400, "message": "请求参数错误: " + err.Error(), "data": nil,
		})
		return
	}
	if body.Message == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code": 400, "message": "message 不能为空", "data": nil,
		})
		return
	}
	err = agentic.RunStream(ctx, agentic.RunStreamRequest{
		SessionID: uint(sessionID),
		UserID:    userID.(uint),
		Message:   body.Message,
		Interrupt: body.Interrupt,
		Context:   body.Context, // 传递 context
	})
	if err != nil {
		// 若尚未开始写 SSE，可返回 JSON 错误；否则 RunStream 内部已写 error 事件
		if ctx.Writer.Written() {
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code": 500, "message": "流式处理失败: " + err.Error(), "data": nil,
		})
	}
}

// ApplyWorkflow 将会话的 pendingWorkflow 应用到画布
func (c *AlkaidController) ApplyWorkflow(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var body struct {
		SessionID  uint `json:"sessionId"`
		WorkflowID uint `json:"workflowId"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error(), "data": nil})
		return
	}
	if body.SessionID == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "sessionId 必填", "data": nil})
		return
	}
	if err := agentic.ApplyWorkflow(agentic.ApplyWorkflowRequest{
		SessionID: body.SessionID, UserID: userID.(uint), WorkflowID: body.WorkflowID,
	}); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已应用到画布", "data": nil})
}

// ApplyPatch 将会话的 pendingPatch 应用到画布
func (c *AlkaidController) ApplyPatch(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var body struct {
		SessionID  uint `json:"sessionId"`
		WorkflowID uint `json:"workflowId"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error(), "data": nil})
		return
	}
	if body.SessionID == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "sessionId 必填", "data": nil})
		return
	}
	if err := agentic.ApplyPatch(agentic.ApplyPatchRequest{
		SessionID: body.SessionID, UserID: userID.(uint), WorkflowID: body.WorkflowID,
	}); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已应用补丁", "data": nil})
}

// GetCapabilities 获取瑶光星能力说明（供智能体/前端使用）
func (c *AlkaidController) GetCapabilities(ctx *gin.Context) {
	_, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	capabilities, err := c.alkaidService.GetCapabilities()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取能力说明失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data":    capabilities,
	})
}

// GetMessages 获取会话的消息列表
func (c *AlkaidController) GetMessages(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"code":    401,
			"message": "未授权",
			"data":    nil,
		})
		return
	}

	sessionIDStr := ctx.Param("id")
	sessionID, err := strconv.ParseUint(sessionIDStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "无效的会话ID",
			"data":    nil,
		})
		return
	}

	// 验证会话存在且属于该用户
	session, err := c.alkaidService.GetSession(uint(sessionID))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "会话不存在",
			"data":    nil,
		})
		return
	}

	if session.UserID != userID.(uint) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"code":    403,
			"message": "无权访问该会话",
			"data":    nil,
		})
		return
	}

	// 获取limit参数（可选）
	limit := 0
	if limitStr := ctx.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	messages, err := c.alkaidService.GetMessages(uint(sessionID), limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "获取消息列表失败: " + err.Error(),
			"data":    nil,
		})
		return
	}

	// 同时返回历史工具步/计划步（用于前端展示执行过程，不传给 AI）
	var toolSteps []interface{}
	if session.ToolStepsJSON.Data != nil {
		if stepsData, ok := session.ToolStepsJSON.Data.([]interface{}); ok {
			toolSteps = stepsData
		}
	}
	var planSteps []interface{}
	if session.PlanStepsJSON.Data != nil {
		if stepsData, ok := session.PlanStepsJSON.Data.([]interface{}); ok {
			planSteps = stepsData
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "获取成功",
		"data": gin.H{
			"messages":  messages,
			"toolSteps": toolSteps, // 历史工具步，仅用于前端展示
			"planSteps": planSteps, // 历史计划步，仅用于前端展示
		},
	})
}

// DiscardPending 放弃待处理内容
func (c *AlkaidController) DiscardPending(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	var body struct {
		SessionID uint   `json:"sessionId"`
		Type      string `json:"type"` // "workflow" or "patch"
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error(), "data": nil})
		return
	}
	if body.SessionID == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "sessionId 必填", "data": nil})
		return
	}
	if err := agentic.DiscardPending(agentic.DiscardPendingRequest{
		SessionID: body.SessionID, UserID: userID.(uint), Type: body.Type,
	}); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "已放弃", "data": nil})
}
