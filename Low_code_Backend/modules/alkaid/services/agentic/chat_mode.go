package agentic

import (
	"context"
	"strings"

	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/services/providers/deepseek"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

func runDirectChatStream(
	reqCtx context.Context,
	repo *alkaidRepos.AlkaidRepository,
	sw *SSEWriter,
	req RunStreamRequest,
	conversationHistory string,
) error {
	alkaidSvc := alkaidServices.NewAlkaidService()
	systemPrompt := alkaidSvc.BuildGeneralChatPromptForAgentic()
	aiConfig, err := buildAIConfig(req.UserID)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}

	userPrompt := req.Message
	if conversationHistory != "" {
		userPrompt = conversationHistory + "\n\n用户：" + req.Message
	}

	aiProvider := deepseek.NewDeepSeekProvider()
	var fullContent strings.Builder
	var fullReasoning strings.Builder
	var streamErr error

	err = aiProvider.ChatStream(
		reqCtx,
		aiConfig,
		systemPrompt,
		userPrompt,
		map[string]interface{}{
			"stream":   true,
			"thinking": false,
		},
		func(content string, done bool, err error, usage *providers.TokenUsage) {
			if err != nil {
				streamErr = err
				return
			}
			processDirectChatStreamChunk(sw, &fullContent, &fullReasoning, content)
		},
	)
	if reqCtx.Err() != nil {
		_ = sw.WriteInterrupted()
		return nil
	}
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}
	if streamErr != nil {
		_ = sw.WriteError(streamErr.Error())
		return streamErr
	}

	assistantMsg := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "assistant",
		Content:   fullContent.String(),
		Type:      "text",
	}
	_ = repo.CreateMessage(assistantMsg)
	_ = sw.WriteDone()
	return nil
}

func processDirectChatStreamChunk(sw *SSEWriter, fullContent, fullReasoning *strings.Builder, content string) {
	if content == "" {
		return
	}

	if strings.HasPrefix(content, "[REASONING_DELTA]") {
		delta := strings.TrimPrefix(content, "[REASONING_DELTA]")
		fullReasoning.WriteString(delta)
		return
	}

	if strings.HasPrefix(content, "[CONTENT_DELTA]") {
		delta := strings.TrimPrefix(content, "[CONTENT_DELTA]")
		fullContent.WriteString(delta)
		if sw != nil {
			_ = sw.WriteContent(delta)
		}
		return
	}

	if strings.HasPrefix(content, "[REASONING]") && strings.Contains(content, "[/REASONING]") {
		reasoningStart := strings.Index(content, "[REASONING]") + len("[REASONING]")
		reasoningEnd := strings.Index(content, "[/REASONING]")
		if reasoningEnd > reasoningStart {
			fullReasoning.WriteString(content[reasoningStart:reasoningEnd])
		}
		return
	}

	if strings.HasPrefix(content, "[CONTENT]") && strings.Contains(content, "[/CONTENT]") {
		if fullContent.Len() == 0 {
			contentStart := strings.Index(content, "[CONTENT]") + len("[CONTENT]")
			contentEnd := strings.Index(content, "[/CONTENT]")
			if contentEnd > contentStart {
				fullContent.WriteString(content[contentStart:contentEnd])
			}
		}
		return
	}

	fullContent.WriteString(content)
	if sw != nil {
		_ = sw.WriteContent(content)
	}
}
