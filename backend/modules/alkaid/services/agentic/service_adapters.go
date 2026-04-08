package agentic

import (
	"fmt"

	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

type capabilitiesProviderAdapter struct {
	*alkaidServices.CapabilitiesService
}

func (c *capabilitiesProviderAdapter) GetCapabilities() (interface{}, error) {
	return c.CapabilitiesService.GetCapabilities()
}

type workflowServiceAdapter struct {
	*workflowSvc.WorkflowService
}

func (a *workflowServiceAdapter) GetWorkflowByID(workflowID uint) (interface{}, error) {
	return a.WorkflowService.GetWorkflowByID(workflowID)
}

func (a *workflowServiceAdapter) GetWorkflowNodes(workflowID uint) (interface{}, error) {
	return a.WorkflowService.GetWorkflowNodes(workflowID)
}

func (a *workflowServiceAdapter) SaveWorkflowNodes(workflowID uint, req interface{}) error {
	r, ok := req.(*workflowSvc.SaveWorkflowNodesRequest)
	if !ok {
		return fmt.Errorf("invalid request type")
	}
	return a.WorkflowService.SaveWorkflowNodes(workflowID, r)
}

func (a *workflowServiceAdapter) ListWorkflowsByUserID(userID uint, page, pageSize int) (interface{}, int64, error) {
	list, total, err := a.WorkflowService.GetWorkflowsByUserID(userID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	var _ []*workflowModels.Workflow = list
	out := make([]map[string]interface{}, 0, len(list))
	for _, w := range list {
		if w == nil {
			continue
		}
		desc := ""
		if w.Description != nil {
			desc = *w.Description
		}
		out = append(out, map[string]interface{}{
			"id": w.ID, "name": w.Name, "description": desc, "status": w.Status,
		})
	}
	return out, total, nil
}
