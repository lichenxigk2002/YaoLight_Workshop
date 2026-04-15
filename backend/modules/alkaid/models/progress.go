package models

import "time"

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

const (
	ToolStepPending = "pending"
	ToolStepRunning = "running"
	ToolStepSuccess = "success"
	ToolStepError   = "error"
)

const (
	PlanStepPending = "pending"
	PlanStepRunning = "running"
	PlanStepSuccess = "success"
	PlanStepError   = "error"
	PlanStepSkipped = "skipped"
)

const (
	PlanStepSourcePlanned   = "planned"
	PlanStepSourceSynthetic = "synthetic"
)

type AgentPlanStep struct {
	PlanStepID         string     `json:"planStepId"`
	UserMessageID      uint       `json:"userMessageId"`
	UserMessageContent string     `json:"userMessageContent,omitempty"`
	Phase              string     `json:"phase"`
	Source             string     `json:"source,omitempty"`
	Title              string     `json:"title"`
	Reason             string     `json:"reason"`
	ExpectedOutput     string     `json:"expectedOutput,omitempty"`
	ToolHints          []string   `json:"toolHints,omitempty"`
	Status             string     `json:"status"`
	StartedAt          time.Time  `json:"startedAt"`
	FinishedAt         *time.Time `json:"finishedAt,omitempty"`
	ResultSummary      string     `json:"resultSummary,omitempty"`
	ErrorMessage       string     `json:"errorMessage,omitempty"`
}

type AgentToolStep struct {
	StepID             string                 `json:"stepId"`
	PlanStepID         string                 `json:"planStepId,omitempty"`
	UserMessageID      uint                   `json:"userMessageId"`
	UserMessageContent string                 `json:"userMessageContent,omitempty"`
	Phase              string                 `json:"phase"`
	ToolName           string                 `json:"toolName"`
	ToolInput          map[string]interface{} `json:"toolInput,omitempty"`
	Status             string                 `json:"status"`
	StartedAt          time.Time              `json:"startedAt"`
	FinishedAt         *time.Time             `json:"finishedAt,omitempty"`
	ResultSummary      string                 `json:"resultSummary,omitempty"`
	ErrorMessage       string                 `json:"errorMessage,omitempty"`
}

type SSEPhaseChanged struct {
	Phase string `json:"phase"`
	At    string `json:"at"`
}

type SSEInteractionMode struct {
	Mode         string `json:"mode"`
	Reason       string `json:"reason,omitempty"`
	ShowProgress bool   `json:"showProgress"`
	At           string `json:"at"`
}

type SSEPlanCreated struct {
	Steps []AgentPlanStep `json:"steps"`
}

type SSEPlanStepStarted struct {
	PlanStepID         string   `json:"planStepId"`
	UserMessageID      uint     `json:"userMessageId"`
	UserMessageContent string   `json:"userMessageContent,omitempty"`
	Phase              string   `json:"phase"`
	Source             string   `json:"source,omitempty"`
	Title              string   `json:"title"`
	Reason             string   `json:"reason"`
	ExpectedOutput     string   `json:"expectedOutput,omitempty"`
	ToolHints          []string `json:"toolHints,omitempty"`
	Status             string   `json:"status"`
	At                 string   `json:"at"`
}

type SSEPlanStepUpdated struct {
	PlanStepID     string   `json:"planStepId"`
	Phase          string   `json:"phase,omitempty"`
	Source         string   `json:"source,omitempty"`
	Title          string   `json:"title,omitempty"`
	Reason         string   `json:"reason,omitempty"`
	ExpectedOutput string   `json:"expectedOutput,omitempty"`
	ToolHints      []string `json:"toolHints,omitempty"`
	Status         string   `json:"status,omitempty"`
	ResultSummary  string   `json:"resultSummary,omitempty"`
	ErrorMessage   string   `json:"errorMessage,omitempty"`
	At             string   `json:"at"`
}

type SSEPlanStepFinished struct {
	PlanStepID    string `json:"planStepId"`
	Status        string `json:"status"`
	ResultSummary string `json:"resultSummary,omitempty"`
	ErrorMessage  string `json:"errorMessage,omitempty"`
	At            string `json:"at"`
}

type SSEToolStepStarted struct {
	StepID             string `json:"stepId"`
	PlanStepID         string `json:"planStepId,omitempty"`
	UserMessageID      uint   `json:"userMessageId"`
	UserMessageContent string `json:"userMessageContent,omitempty"`
	ToolName           string `json:"toolName"`
	Phase              string `json:"phase"`
	At                 string `json:"at"`
}

type SSEToolStepFinished struct {
	StepID        string `json:"stepId"`
	Status        string `json:"status"`
	ResultSummary string `json:"resultSummary,omitempty"`
	ErrorMessage  string `json:"errorMessage,omitempty"`
	At            string `json:"at"`
}

type SSEContent struct {
	Delta string `json:"delta"`
}

type SSEDone struct{}

type SSEError struct {
	Message string `json:"message"`
}

type SSEPendingWorkflow struct {
	Summary struct {
		NodeCount int `json:"nodeCount"`
		EdgeCount int `json:"edgeCount"`
	} `json:"summary"`
}

type SSEPendingPatch struct {
	PatchCount int `json:"patchCount"`
}

type SSEInterrupted struct {
	At string `json:"at"`
}
