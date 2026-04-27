package agentic

import (
	"context"

	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

func runExplainMode(
	reqCtx context.Context,
	repo *alkaidRepos.AlkaidRepository,
	sw *SSEWriter,
	req RunStreamRequest,
	turnCtx TurnContext,
) error {
	return runAnalyzeMode(reqCtx, repo, sw, req, turnCtx)
}
