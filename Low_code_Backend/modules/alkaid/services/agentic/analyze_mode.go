package agentic

import (
	"context"
	"fmt"
	"strings"
	"time"

	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/services/providers/deepseek"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

var analyzeAllowedToolNames = map[string]struct{}{
	"search_knowledge": {},
	"get_capabilities": {},
	"get_workflow":     {},
	"get_node_spec":    {},
}

func runAnalyzeMode(
	reqCtx context.Context,
	repo *alkaidRepos.AlkaidRepository,
	sw *SSEWriter,
	req RunStreamRequest,
	turnCtx TurnContext,
) error {
	aiConfig, err := buildAIConfig(req.UserID)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}

	runtimeDeps := buildAgentRuntimeDeps(repo, req)
	alkaidSvc := alkaidServices.NewAlkaidService()
	relevantKnowledge, _ := alkaidSvc.GetRelevantKnowledgeForAgentic(req.UserID, req.Message, 6)
	systemPrompt, err := alkaidSvc.BuildSystemPromptForAgenticWithKnowledge(req.UserID, req.Message, relevantKnowledge, nil)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}

	toolDefs := FilterToolDefsByName(GetToolDefsForLLM(), analyzeAllowedToolNames)
	aiProvider := deepseek.NewDeepSeekProvider()
	messages := []providers.ChatMessage{{
		Role:    "user",
		Content: buildAnalyzeUserPrompt(req.Message, turnCtx.ConversationHistory),
	}}

	const maxTurns = 6
	var assistantContent string
	usedTools := false

	for turn := 0; turn < maxTurns; turn++ {
		if reqCtx.Err() != nil {
			_ = sw.WriteInterrupted()
			return nil
		}

		resp, chatErr := aiProvider.ChatWithTools(reqCtx, aiConfig, systemPrompt, messages, toolDefs, map[string]interface{}{"thinking": false})
		if chatErr != nil {
			_ = sw.WriteError(chatErr.Error())
			return chatErr
		}
		if resp == nil {
			break
		}

		if len(resp.ToolCalls) == 0 {
			assistantContent = strings.TrimSpace(resp.Content)
			if assistantContent != "" {
				_ = sw.WriteContent(assistantContent)
			}
			break
		}

		messages = append(messages, providers.ChatMessage{
			Role:      "assistant",
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		if !usedTools {
			usedTools = true
			_ = sw.WritePhaseChanged(alkaidModels.PhasePlanning)
		}

		for _, tc := range resp.ToolCalls {
			if reqCtx.Err() != nil {
				_ = sw.WriteInterrupted()
				return nil
			}

			if _, ok := analyzeAllowedToolNames[tc.Function.Name]; !ok {
				messages = append(messages, providers.ChatMessage{
					Role:       "tool",
					ToolCallID: tc.ID,
					Content:    `{"error":"tool_not_allowed_in_analyze_mode"}`,
				})
				continue
			}

			stepID := fmt.Sprintf("step-%d-%s", time.Now().UnixNano(), tc.Function.Name)
			_ = sw.WriteToolStepStarted(stepID, tc.Function.Name, alkaidModels.PhasePlanning)

			args := tc.Function.Arguments
			if args == "" {
				args = "{}"
			}

			result, resultSummary, toolErr := runtimeDeps.Registry.ExecuteTool(tc.Function.Name, args, req.SessionID)
			status := alkaidModels.ToolStepSuccess
			errMsg := ""
			if toolErr != nil {
				status = alkaidModels.ToolStepError
				errMsg = toolErr.Error()
				resultSummary = errMsg
			}
			_ = sw.WriteToolStepFinished(stepID, status, resultSummary, errMsg)

			messages = append(messages, providers.ChatMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Content:    buildToolContentForLLM(tc.Function.Name, result, resultSummary),
			})
		}
	}

	if usedTools {
		_ = sw.WritePhaseChanged(alkaidModels.PhaseIdle)
	}

	if assistantContent == "" {
		for i := len(messages) - 1; i >= 0; i-- {
			if messages[i].Role == "assistant" && strings.TrimSpace(messages[i].Content) != "" {
				assistantContent = strings.TrimSpace(messages[i].Content)
				break
			}
		}
	}

	if assistantContent == "" {
		assistantContent = "我已经查看了当前请求，但暂时没有足够信息形成稳定结论。你可以继续告诉我希望我重点分析哪一部分工作流。"
		_ = sw.WriteContent(assistantContent)
	}

	assistantMsg := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "assistant",
		Content:   assistantContent,
		Type:      "text",
	}
	_ = repo.CreateMessage(assistantMsg)
	_ = sw.WriteDone()
	return nil
}

func buildAnalyzeUserPrompt(message, conversationHistory string) string {
	base := strings.TrimSpace(message)
	if conversationHistory != "" {
		base = strings.TrimSpace(conversationHistory) + "\n\n用户：" + base
	}

	return base + "\n\n你当前处于 workflow analyze mode。你的职责是查看、解释、分析当前工作流，并给出修改建议。你可以按需调用 get_workflow、get_capabilities、get_node_spec、search_knowledge。不要交付待应用工作流，不要调用 validate_workflow、run_workflow_trial、propose_workflow、propose_patch，也不要假装已经修改画布。"
}
