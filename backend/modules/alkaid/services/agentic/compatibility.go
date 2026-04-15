package agentic

import alkaidModels "yaolight-workshop/backend/modules/alkaid/models"

func buildConversationHistoryForDecision(messages []alkaidModels.AlkaidMessage, excludeMessageID uint) string {
	return buildTurnConversationHistory(messages, excludeMessageID)
}

func shouldUseAgenticPlanning(message, conversationHistory string) bool {
	decision := DecideRoute(TurnContext{
		Request:             RunStreamRequest{Message: message},
		ConversationHistory: conversationHistory,
	})
	return decision.Mode != RouteChat
}
