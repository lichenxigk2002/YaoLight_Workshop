package agentic

import (
	"context"
	"fmt"
	"strings"
	"time"

	"yaolight-workshop/backend/modules/ai/services/providers"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

var chatAllowedToolNames = map[string]struct{}{
	"search_knowledge":             {},
	"list_project_website_sources": {},
	"get_capabilities":             {},
	"get_workflow":                 {},
	"get_node_spec":                {},
	"list_workflows":               {},
	"get_available_models":         {},
}

func runDirectChatStream(
	reqCtx context.Context,
	repo *alkaidRepos.AlkaidRepository,
	sw *SSEWriter,
	req RunStreamRequest,
	conversationHistory string,
) error {
	alkaidSvc := alkaidServices.NewAlkaidService()
	systemPrompt := alkaidSvc.BuildGeneralChatPromptForAgentic()
	runtimeDeps := buildAgentRuntimeDeps(repo, req)
	aiConfig, err := buildAIConfig(req.UserID)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}

	aiProvider, err := buildAIProvider()
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}

	toolDefs := FilterToolDefsForRequest(FilterToolDefsByName(GetToolDefsForLLM(), chatAllowedToolNames), req.Context)
	messages := []providers.ChatMessage{{
		Role:    "user",
		Content: buildChatUserPrompt(req.Message, conversationHistory),
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

			if _, ok := chatAllowedToolNames[tc.Function.Name]; !ok {
				messages = append(messages, providers.ChatMessage{
					Role:       "tool",
					ToolCallID: tc.ID,
					Content:    `{"error":"tool_not_allowed_in_chat_mode"}`,
				})
				continue
			}

			args := tc.Function.Arguments
			if args == "" {
				args = "{}"
			}

			stepID := fmt.Sprintf("step-%d-%s", time.Now().UnixNano(), tc.Function.Name)
			_ = sw.WriteToolStepStarted(stepID, tc.Function.Name, alkaidModels.PhasePlanning)
			result, resultSummary, toolErr := runtimeDeps.Registry.ExecuteToolForMode(string(TaskChat), tc.Function.Name, args, req.SessionID)
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

	if reqCtx.Err() != nil {
		_ = sw.WriteInterrupted()
		return nil
	}

	if usedTools {
		_ = sw.WritePhaseChanged(alkaidModels.PhaseSummarizing)
	}

	if assistantContent == "" {
		assistantContent = findLatestAssistantContent(messages, true)
	}
	if assistantContent == "" {
		assistantContent = "我已经看过当前问题，但暂时没有足够信息给出稳定答案。你可以再具体一点，我会继续帮你查。"
	}

	streamPlainAssistantContent(sw, assistantContent)
	if usedTools {
		_ = sw.WritePhaseChanged(alkaidModels.PhaseIdle)
	}
	_ = sw.WriteDone()
	return nil
}

func buildChatUserPrompt(message, conversationHistory string) string {
	base := strings.TrimSpace(message)
	if conversationHistory != "" {
		base = strings.TrimSpace(conversationHistory) + "\n\n用户：" + base
	}

	return base + "\n\n你当前处于 workflow chat mode。你的职责是作为 YaoLight 平台内的工作流助手回答问题。必要时可以调用只读工具来查询知识库、能力说明、节点规格、当前工作流、工作流列表、项目网站源或可用模型。不要调用 validate_workflow、run_workflow_trial、propose_workflow、propose_patch，也不要假装已经修改画布。"
}

func streamPlainAssistantContent(sw *SSEWriter, content string) {
	if sw == nil || content == "" {
		return
	}

	streamAssistantText(sw, content, 12, 0)
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
