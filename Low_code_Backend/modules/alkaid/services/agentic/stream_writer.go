package agentic

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

// SSEWriter 向 gin 响应写入 SSE 事件（与文档 4.2 一致）
type SSEWriter struct {
	ctx                *gin.Context
	flush              func() error
	closed             bool
	sessionID          uint                         // 会话 ID，用于保存工具步
	userMessageID      uint                         // 当前用户消息ID（用于分组工具步）
	userMessageContent string                       // 用户消息内容（用于前端展示标题）
	toolSteps          []alkaidModels.AgentToolStep // 当前会话的工具步列表（内存缓存）
}

// NewSSEWriter 创建 SSE 写入器
func NewSSEWriter(ctx *gin.Context, sessionID uint, userMessageID uint, userMessageContent string) *SSEWriter {
	ctx.Header("Content-Type", "text/event-stream")
	ctx.Header("Cache-Control", "no-cache")
	ctx.Header("Connection", "keep-alive")
	ctx.Header("X-Accel-Buffering", "no")
	var flush func() error
	if f, ok := ctx.Writer.(http.Flusher); ok {
		flush = func() error { f.Flush(); return nil }
	} else {
		flush = func() error { return nil }
	}
	return &SSEWriter{
		ctx:                ctx,
		flush:              flush,
		sessionID:          sessionID,
		userMessageID:      userMessageID,
		userMessageContent: userMessageContent,
		toolSteps:          make([]alkaidModels.AgentToolStep, 0, 50),
	}
}

func (w *SSEWriter) writeEvent(event string, data interface{}) error {
	if w.closed {
		return nil
	}
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	w.ctx.Writer.WriteString("event: " + event + "\n")
	w.ctx.Writer.WriteString("data: " + string(payload) + "\n\n")
	return w.flush()
}

// WriteContent 发送 content 事件（assistant 流式文本）
func (w *SSEWriter) WriteContent(delta string) error {
	return w.writeEvent("content", alkaidModels.SSEContent{Delta: delta})
}

// WritePhaseChanged 发送 phase_changed 事件
func (w *SSEWriter) WritePhaseChanged(phase string) error {
	return w.writeEvent("phase_changed", alkaidModels.SSEPhaseChanged{
		Phase: phase,
		At:    time.Now().UTC().Format(time.RFC3339Nano),
	})
}

// WriteToolStepStarted 发送 tool_step_started 事件，并保存到内存缓存
func (w *SSEWriter) WriteToolStepStarted(stepID, toolName, phase string) error {
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339Nano)

	// 添加到内存缓存，包含用户消息信息（用于分组显示）
	step := alkaidModels.AgentToolStep{
		StepID:             stepID,
		UserMessageID:      w.userMessageID,
		UserMessageContent: w.userMessageContent,
		Phase:              phase,
		ToolName:           toolName,
		Status:             alkaidModels.ToolStepRunning,
		StartedAt:          now,
	}
	w.toolSteps = append(w.toolSteps, step)

	// 发送 SSE 事件（包含 userMessageId 用于前端分组显示）
	return w.writeEvent("tool_step_started", alkaidModels.SSEToolStepStarted{
		StepID:             stepID,
		UserMessageID:      w.userMessageID,
		UserMessageContent: w.userMessageContent,
		ToolName:           toolName,
		Phase:              phase,
		At:                 nowStr,
	})
}

// WriteToolStepFinished 发送 tool_step_finished 事件，并更新内存缓存
func (w *SSEWriter) WriteToolStepFinished(stepID, status, resultSummary, errorMessage string) error {
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339Nano)

	// 更新内存缓存中的工具步
	for i := range w.toolSteps {
		if w.toolSteps[i].StepID == stepID {
			w.toolSteps[i].Status = status
			w.toolSteps[i].FinishedAt = &now
			w.toolSteps[i].ResultSummary = resultSummary
			if errorMessage != "" {
				w.toolSteps[i].ErrorMessage = errorMessage
			}
			break
		}
	}

	// 发送 SSE 事件
	return w.writeEvent("tool_step_finished", alkaidModels.SSEToolStepFinished{
		StepID:        stepID,
		Status:        status,
		ResultSummary: resultSummary,
		ErrorMessage:  errorMessage,
		At:            nowStr,
	})
}

// WritePendingWorkflow 发送 pending_workflow 事件
func (w *SSEWriter) WritePendingWorkflow(nodeCount, edgeCount int) error {
	data := alkaidModels.SSEPendingWorkflow{}
	data.Summary.NodeCount = nodeCount
	data.Summary.EdgeCount = edgeCount
	return w.writeEvent("pending_workflow", data)
}

// WritePendingPatch 发送 pending_patch 事件
func (w *SSEWriter) WritePendingPatch(patchCount int) error {
	return w.writeEvent("pending_patch", alkaidModels.SSEPendingPatch{PatchCount: patchCount})
}

// WriteDone 发送 done 事件
func (w *SSEWriter) WriteDone() error {
	return w.writeEvent("done", alkaidModels.SSEDone{})
}

// WriteError 发送 error 事件
func (w *SSEWriter) WriteError(message string) error {
	return w.writeEvent("error", alkaidModels.SSEError{Message: message})
}

// WriteInterrupted 发送 interrupted 事件（客户端断开或主动打断）
func (w *SSEWriter) WriteInterrupted() error {
	return w.writeEvent("interrupted", alkaidModels.SSEInterrupted{
		At: time.Now().UTC().Format(time.RFC3339Nano),
	})
}

// SaveToolStepsToSession 将当前缓存的工具步保存到数据库
func (w *SSEWriter) SaveToolStepsToSession() error {
	if w.sessionID == 0 || len(w.toolSteps) == 0 {
		return nil
	}

	repo := alkaidRepos.NewAlkaidRepository()
	session, err := repo.GetSessionByID(w.sessionID)
	if err != nil {
		return err
	}

	// 读取已有的工具步（如果有）
	var existingSteps []alkaidModels.AgentToolStep
	if session.ToolStepsJSON.Data != nil {
		if stepsData, ok := session.ToolStepsJSON.Data.([]interface{}); ok {
			for _, s := range stepsData {
				if stepMap, ok := s.(map[string]interface{}); ok {
					existingSteps = append(existingSteps, mapToAgentToolStep(stepMap))
				}
			}
		}
	}

	// 合并新的工具步（追加到末尾）
	allSteps := append(existingSteps, w.toolSteps...)

	// 限制最多保存 100 条工具步（避免数据过大）
	if len(allSteps) > 100 {
		allSteps = allSteps[len(allSteps)-100:]
	}

	// 保存到数据库
	session.ToolStepsJSON.Data = allSteps
	return repo.UpdateSession(session)
}

// mapToAgentToolStep 将 map 转换为 AgentToolStep
func mapToAgentToolStep(m map[string]interface{}) alkaidModels.AgentToolStep {
	step := alkaidModels.AgentToolStep{}
	if v, ok := m["stepId"].(string); ok {
		step.StepID = v
	}
	if v, ok := m["userMessageId"].(float64); ok {
		step.UserMessageID = uint(v)
	}
	if v, ok := m["userMessageContent"].(string); ok {
		step.UserMessageContent = v
	}
	if v, ok := m["phase"].(string); ok {
		step.Phase = v
	}
	if v, ok := m["toolName"].(string); ok {
		step.ToolName = v
	}
	if v, ok := m["status"].(string); ok {
		step.Status = v
	}
	if v, ok := m["startedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			step.StartedAt = t
		}
	}
	if v, ok := m["finishedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			step.FinishedAt = &t
		}
	}
	if v, ok := m["resultSummary"].(string); ok {
		step.ResultSummary = v
	}
	if v, ok := m["errorMessage"].(string); ok {
		step.ErrorMessage = v
	}
	return step
}

// Close 标记写入器已关闭，并保存工具步到数据库
func (w *SSEWriter) Close() {
	if !w.closed {
		// 保存工具步到数据库
		_ = w.SaveToolStepsToSession()
		w.closed = true
	}
}
