package agentic

import (
	"fmt"

	"github.com/gin-gonic/gin"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

// RunStream 是 Agentic 流入口：保存用户消息、构建上下文、做任务路由分发。
func RunStream(ctx *gin.Context, req RunStreamRequest) error {
	repo := alkaidRepos.NewAlkaidRepository()

	session, err := repo.GetSessionByID(req.SessionID)
	if err != nil {
		return err
	}
	if session.UserID != req.UserID {
		return fmt.Errorf("无权访问该会话")
	}

	if req.Interrupt {
		globalSessionRunManager.Stop(req.SessionID)
	}

	runCtx, err := globalSessionRunManager.Start(req.SessionID)
	if err != nil {
		return err
	}
	defer globalSessionRunManager.Finish(req.SessionID)

	userMsg := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "user",
		Content:   req.Message,
		Type:      "text",
	}
	if err := repo.CreateMessage(userMsg); err != nil {
		return err
	}

	historyMessages, histErr := repo.GetMessagesBySessionID(req.SessionID, 0)
	if histErr != nil {
		return histErr
	}

	turnCtx := BuildTurnContext(session, req, historyMessages, userMsg.ID)
	routeDecision := DecideRoute(turnCtx)
	turnCtx.CurrentTaskMode = routeDecision.TaskMode

	assistantMsg := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "assistant",
		Content:   "",
		Type:      "streaming",
	}
	if err := repo.CreateMessage(assistantMsg); err != nil {
		return err
	}

	session.Status = "running"
	session.CurrentTaskMode = string(routeDecision.TaskMode)
	session.CurrentPhase = ""
	session.ToolStepsJSON.Data = nil
	session.PlanStepsJSON.Data = nil
	if err := repo.UpdateSession(session); err != nil {
		return err
	}

	sw := NewSSEWriter(ctx, req.SessionID, userMsg.ID, req.Message, assistantMsg.ID)
	defer func() {
		_ = finalizeSessionAfterRun(repo, req.SessionID, runCtx.Err() != nil)
		sw.Close()
	}()
	_ = sw.WriteInteractionMode(string(routeDecision.TaskMode), routeDecision.Reason, routeDecision.ShowProgress)

	switch routeDecision.TaskMode {
	case TaskChat:
		return runDirectChatStream(runCtx, repo, sw, req, turnCtx.ConversationHistory)
	case TaskExplain:
		return runExplainMode(runCtx, repo, sw, req, turnCtx)
	case TaskGenerate:
		return runGenerateMode(runCtx, repo, sw, req, session, userMsg, turnCtx)
	case TaskRepair:
		return runRepairMode(runCtx, repo, sw, req, session, userMsg, turnCtx)
	case TaskTrialDebug:
		return runTrialDebugMode(runCtx, repo, sw, req, turnCtx)
	default:
		return runDirectChatStream(runCtx, repo, sw, req, turnCtx.ConversationHistory)
	}
}

func finalizeSessionAfterRun(repo *alkaidRepos.AlkaidRepository, sessionID uint, interrupted bool) error {
	session, err := repo.GetSessionByID(sessionID)
	if err != nil {
		return err
	}
	session.Status = "active"
	if interrupted {
		session.CurrentPhase = alkaidModels.PhaseIdle
	}
	return repo.UpdateSession(session)
}
