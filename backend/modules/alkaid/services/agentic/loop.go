package agentic

import (
	"fmt"

	"github.com/gin-gonic/gin"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

// RunStream 是 Agentic 流入口：保存用户消息、构建上下文、做路由分发。
// 具体执行链分别由 chat / analyze / act 三种 mode 负责。
func RunStream(ctx *gin.Context, req RunStreamRequest) error {
	reqCtx := ctx.Request.Context()
	repo := alkaidRepos.NewAlkaidRepository()

	session, err := repo.GetSessionByID(req.SessionID)
	if err != nil {
		return err
	}
	if session.UserID != req.UserID {
		return fmt.Errorf("无权访问该会话")
	}
	if reqCtx.Err() != nil {
		return reqCtx.Err()
	}

	userMsg := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "user",
		Content:   req.Message,
		Type:      "text",
	}
	if err := repo.CreateMessage(userMsg); err != nil {
		return err
	}

	sw := NewSSEWriter(ctx, req.SessionID, userMsg.ID, req.Message)
	defer sw.Close()

	historyMessages, histErr := repo.GetMessagesBySessionID(req.SessionID, 0)
	if histErr != nil {
		return histErr
	}

	turnCtx := BuildTurnContext(session, req, historyMessages, userMsg.ID)
	routeDecision := DecideRoute(turnCtx)
	_ = sw.WriteInteractionMode(string(routeDecision.Mode), routeDecision.Reason, routeDecision.ShowProgress)

	switch routeDecision.Mode {
	case RouteChat:
		return runDirectChatStream(reqCtx, repo, sw, req, turnCtx.ConversationHistory)
	case RouteAnalyze:
		return runAnalyzeMode(reqCtx, repo, sw, req, turnCtx)
	case RouteAct:
		return runActMode(reqCtx, repo, sw, req, session, userMsg)
	default:
		return runDirectChatStream(reqCtx, repo, sw, req, turnCtx.ConversationHistory)
	}
}
