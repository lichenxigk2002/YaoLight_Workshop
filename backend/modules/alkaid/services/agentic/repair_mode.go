package agentic

import (
	"context"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

func runRepairMode(
	reqCtx context.Context,
	repo *alkaidRepos.AlkaidRepository,
	sw *SSEWriter,
	req RunStreamRequest,
	session *alkaidModels.AlkaidSession,
	userMsg *alkaidModels.AlkaidMessage,
	turnCtx TurnContext,
) error {
	if req.Context == nil {
		req.Context = map[string]interface{}{}
	}
	req.Context["taskMode"] = string(turnCtx.CurrentTaskMode)
	return runActMode(reqCtx, repo, sw, req, session, userMsg)
}
