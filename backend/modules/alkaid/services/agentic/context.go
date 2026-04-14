package agentic

import (
	"fmt"
	"strings"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

type RouteMode string

const (
	RouteChat    RouteMode = "chat"
	RouteAnalyze RouteMode = "analyze"
	RouteAct     RouteMode = "act"
)

type TurnContext struct {
	Session             *alkaidModels.AlkaidSession
	Request             RunStreamRequest
	HistoryMessages     []alkaidModels.AlkaidMessage
	ConversationHistory string
}

func BuildTurnContext(session *alkaidModels.AlkaidSession, req RunStreamRequest, historyMessages []alkaidModels.AlkaidMessage, excludeMessageID uint) TurnContext {
	return TurnContext{
		Session:             session,
		Request:             req,
		HistoryMessages:     historyMessages,
		ConversationHistory: buildTurnConversationHistory(historyMessages, excludeMessageID),
	}
}

func buildTurnConversationHistory(messages []alkaidModels.AlkaidMessage, excludeMessageID uint) string {
	if len(messages) == 0 {
		return ""
	}

	var history strings.Builder
	for _, msg := range messages {
		if excludeMessageID != 0 && msg.ID == excludeMessageID {
			continue
		}
		roleLabel := "用户"
		if msg.Role == "assistant" {
			roleLabel = "助手"
		}
		history.WriteString(fmt.Sprintf("%s：%s\n", roleLabel, msg.Content))
	}
	return strings.TrimSpace(history.String())
}
