package models

import "time"

// Phase 瑶光星 Agent 执行阶段（与前端、SSE 协议一致）
const (
	PhaseIdle            = "idle"
	PhasePlanning        = "planning"
	PhaseGenerating      = "generating"
	PhaseValidating      = "validating"
	PhaseRepairing       = "repairing"
	PhaseRunningTrial    = "running_trial"
	PhaseSummarizing     = "summarizing"
	PhaseWaitingApproval = "waiting_approval"
	PhaseError           = "error"
)

// AgentToolStep 工具步（单次工具调用的进度记录）
type AgentToolStep struct {
	StepID             string                 `json:"stepId"`
	UserMessageID      uint                   `json:"userMessageId"`                // 所属的用户消息ID（用于分组显示）
	UserMessageContent string                 `json:"userMessageContent,omitempty"` // 用户消息内容（用于前端展示标题）
	Phase              string                 `json:"phase"`
	ToolName           string                 `json:"toolName"`
	ToolInput          map[string]interface{} `json:"toolInput,omitempty"`
	Status             string                 `json:"status"` // pending, running, success, error
	StartedAt          time.Time              `json:"startedAt"`
	FinishedAt         *time.Time             `json:"finishedAt,omitempty"`
	ResultSummary      string                 `json:"resultSummary,omitempty"`
	ErrorMessage       string                 `json:"errorMessage,omitempty"`
}

// ToolStepStatus 工具步状态
const (
	ToolStepPending = "pending"
	ToolStepRunning = "running"
	ToolStepSuccess = "success"
	ToolStepError   = "error"
)

// SSE 事件 payload 结构（与前端解析一致）

// SSEPhaseChanged phase_changed 事件 data
type SSEPhaseChanged struct {
	Phase string `json:"phase"`
	At    string `json:"at"` // ISO8601
}

// SSEToolStepStarted tool_step_started 事件 data
type SSEToolStepStarted struct {
	StepID             string `json:"stepId"`
	UserMessageID      uint   `json:"userMessageId"`
	UserMessageContent string `json:"userMessageContent,omitempty"`
	ToolName           string `json:"toolName"`
	Phase              string `json:"phase"`
	At                 string `json:"at"`
}

// SSEToolStepFinished tool_step_finished 事件 data
type SSEToolStepFinished struct {
	StepID        string `json:"stepId"`
	Status        string `json:"status"`
	ResultSummary string `json:"resultSummary,omitempty"`
	ErrorMessage  string `json:"errorMessage,omitempty"`
	At            string `json:"at"`
}

// SSEContent content 事件 data（assistant 流式文本）
type SSEContent struct {
	Delta string `json:"delta"`
}

// SSEDone done 事件 data
type SSEDone struct{}

// SSEError error 事件 data
type SSEError struct {
	Message string `json:"message"`
}

// SSEPendingWorkflow pending_workflow 事件 data
type SSEPendingWorkflow struct {
	Summary struct {
		NodeCount int `json:"nodeCount"`
		EdgeCount int `json:"edgeCount"`
	} `json:"summary"`
}

// SSEPendingPatch pending_patch 事件 data
type SSEPendingPatch struct {
	PatchCount int `json:"patchCount"`
}

// SSEInterrupted interrupted 事件 data（客户端断开或主动打断）
type SSEInterrupted struct {
	At string `json:"at"` // ISO8601
}
