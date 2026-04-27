package agentic

import (
	"encoding/json"
	"fmt"
	"strings"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

type TaskMode string

const (
	TaskChat       TaskMode = "chat"
	TaskExplain    TaskMode = "explain"
	TaskGenerate   TaskMode = "generate"
	TaskRepair     TaskMode = "repair"
	TaskTrialDebug TaskMode = "trial_debug"
)

// RouteMode is kept as an internal compatibility alias while the public
// interaction mode migrates to TaskMode.
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
	CurrentTaskMode     TaskMode
	CurrentWorkflow     interface{}
	ProjectID           uint
	WorkflowID          uint
}

func BuildTurnContext(session *alkaidModels.AlkaidSession, req RunStreamRequest, historyMessages []alkaidModels.AlkaidMessage, excludeMessageID uint) TurnContext {
	turnCtx := TurnContext{
		Session:             session,
		Request:             req,
		HistoryMessages:     historyMessages,
		ConversationHistory: buildTurnConversationHistory(historyMessages, excludeMessageID),
	}
	if session != nil && session.WorkflowID != nil {
		turnCtx.WorkflowID = *session.WorkflowID
	}
	if req.Context != nil {
		turnCtx.CurrentWorkflow = req.Context["currentWorkflow"]
		if projectID, ok := uintFromContext(req.Context["projectId"]); ok {
			turnCtx.ProjectID = projectID
		}
		if workflowID, ok := uintFromContext(req.Context["workflowId"]); ok {
			turnCtx.WorkflowID = workflowID
		}
	}
	return turnCtx
}

func uintFromContext(value interface{}) (uint, bool) {
	switch v := value.(type) {
	case uint:
		return v, v != 0
	case int:
		return uint(v), v > 0
	case int64:
		return uint(v), v > 0
	case float64:
		return uint(v), v > 0
	case json.Number:
		i, err := v.Int64()
		return uint(i), err == nil && i > 0
	default:
		return 0, false
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
