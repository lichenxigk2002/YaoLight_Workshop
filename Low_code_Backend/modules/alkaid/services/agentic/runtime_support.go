package agentic

import (
	"yaolight-workshop/backend/infrastructure/database"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
	"yaolight-workshop/backend/modules/alkaid/services/tools"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

type agentRuntimeDeps struct {
	CapabilitiesService *alkaidServices.CapabilitiesService
	WorkflowService     *workflowSvc.WorkflowService
	Registry            *tools.Registry
}

func buildAgentRuntimeDeps(repo *alkaidRepos.AlkaidRepository, req RunStreamRequest) *agentRuntimeDeps {
	capSvc := alkaidServices.NewCapabilitiesService()
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	workflowService := workflowSvc.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo)
	executor := workflowSvc.NewWorkflowExecutor()
	workflowProvider := &workflowServiceAdapter{workflowService}
	capAdapter := &capabilitiesProviderAdapter{capSvc}

	runner := &tools.Runner{
		CapabilitiesService: capAdapter,
		Repo:                repo,
		WorkflowService:     workflowProvider,
		Executor:            executor,
		RequestContext:      req.Context,
		NodeSpecByType: func(nodeType string) (interface{}, error) {
			cap, err := capSvc.GetCapabilities()
			if err != nil {
				return nil, err
			}
			for _, nt := range cap.NodeTypes {
				if nt.Type == nodeType {
					return nt, nil
				}
			}
			return nil, nil
		},
	}

	return &agentRuntimeDeps{
		CapabilitiesService: capSvc,
		WorkflowService:     workflowService,
		Registry:            tools.NewRegistry(runner),
	}
}
