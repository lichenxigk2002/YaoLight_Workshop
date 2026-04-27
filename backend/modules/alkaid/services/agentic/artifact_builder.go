package agentic

import (
	"encoding/json"
	"fmt"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

func BuildWorkflowDraft(workflowJSON string, summary string, source string) (*alkaidModels.WorkflowDraft, error) {
	if workflowJSON == "" {
		return nil, fmt.Errorf("workflow json is empty")
	}
	var workflow map[string]interface{}
	if err := json.Unmarshal([]byte(workflowJSON), &workflow); err != nil {
		return nil, fmt.Errorf("invalid workflow json: %w", err)
	}
	return &alkaidModels.WorkflowDraft{
		WorkflowJSON: workflowJSON,
		Summary:      summary,
		Source:       source,
		Confidence:   0.7,
	}, nil
}

func BuildPatchDraft(patchJSON string, summary string, targetWorkflow uint) (*alkaidModels.PatchDraft, error) {
	if patchJSON == "" {
		return nil, fmt.Errorf("patch json is empty")
	}
	var patch interface{}
	if err := json.Unmarshal([]byte(patchJSON), &patch); err != nil {
		return nil, fmt.Errorf("invalid patch json: %w", err)
	}
	return &alkaidModels.PatchDraft{
		PatchJSON:      patchJSON,
		Summary:        summary,
		TargetWorkflow: targetWorkflow,
		Confidence:     0.7,
	}, nil
}

func BuildValidationReport(valid bool, errors []string, warnings []string, summary string) alkaidModels.ValidationReport {
	return alkaidModels.ValidationReport{
		Valid:    valid,
		Errors:   errors,
		Warnings: warnings,
		Summary:  summary,
	}
}

func BuildTrialReport(success bool, failedNodeID string, observations []string, summary string) alkaidModels.TrialReport {
	return alkaidModels.TrialReport{
		Success:      success,
		FailedNodeID: failedNodeID,
		Observations: observations,
		Summary:      summary,
	}
}
