package models

type WorkflowDraft struct {
	WorkflowJSON   string  `json:"workflowJson"`
	Summary        string  `json:"summary,omitempty"`
	Source         string  `json:"source,omitempty"`
	Confidence     float64 `json:"confidence,omitempty"`
	ValidationPass bool    `json:"validationPass"`
	TrialPass      bool    `json:"trialPass"`
}

type PatchDraft struct {
	PatchJSON      string  `json:"patchJson"`
	Summary        string  `json:"summary,omitempty"`
	TargetWorkflow uint    `json:"targetWorkflow,omitempty"`
	Confidence     float64 `json:"confidence,omitempty"`
	ValidationPass bool    `json:"validationPass"`
	TrialPass      bool    `json:"trialPass"`
}

type ValidationReport struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
	Summary  string   `json:"summary,omitempty"`
}

type TrialReport struct {
	Success         bool     `json:"success"`
	FailedNodeID    string   `json:"failedNodeId,omitempty"`
	FailedNodeLabel string   `json:"failedNodeLabel,omitempty"`
	Observations    []string `json:"observations,omitempty"`
	Summary         string   `json:"summary,omitempty"`
}

type ExplainReport struct {
	Summary      string   `json:"summary,omitempty"`
	NodeCount    int      `json:"nodeCount,omitempty"`
	EdgeCount    int      `json:"edgeCount,omitempty"`
	Risks        []string `json:"risks,omitempty"`
	Suggestions  []string `json:"suggestions,omitempty"`
	VariableFlow []string `json:"variableFlow,omitempty"`
}
