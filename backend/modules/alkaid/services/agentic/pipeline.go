package agentic

import alkaidModels "yaolight-workshop/backend/modules/alkaid/models"

type PipelineInput struct {
	TaskMode         TaskMode
	SessionID        uint
	UserID           uint
	Message          string
	WorkflowJSON     string
	PatchJSON        string
	TargetWorkflowID uint
}

type PipelineResult struct {
	WorkflowDraft    *alkaidModels.WorkflowDraft    `json:"workflowDraft,omitempty"`
	PatchDraft       *alkaidModels.PatchDraft       `json:"patchDraft,omitempty"`
	ValidationReport *alkaidModels.ValidationReport `json:"validationReport,omitempty"`
	TrialReport      *alkaidModels.TrialReport      `json:"trialReport,omitempty"`
	ExplainReport    *alkaidModels.ExplainReport    `json:"explainReport,omitempty"`
}

func RunPipeline(input PipelineInput) (*PipelineResult, error) {
	result := &PipelineResult{}
	if input.WorkflowJSON != "" {
		draft, err := BuildWorkflowDraft(input.WorkflowJSON, "Workflow draft created", "pipeline")
		if err != nil {
			return nil, err
		}
		result.WorkflowDraft = draft
	}
	if input.PatchJSON != "" {
		draft, err := BuildPatchDraft(input.PatchJSON, "Patch draft created", input.TargetWorkflowID)
		if err != nil {
			return nil, err
		}
		result.PatchDraft = draft
	}
	return result, nil
}
