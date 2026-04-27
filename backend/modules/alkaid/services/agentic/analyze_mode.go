package agentic

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"yaolight-workshop/backend/modules/ai/services/providers"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
	"yaolight-workshop/backend/modules/alkaid/services/tools"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

var analyzeAllowedToolNames = map[string]struct{}{
	"search_knowledge":             {},
	"list_project_website_sources": {},
	"get_capabilities":             {},
	"get_workflow":                 {},
	"get_node_spec":                {},
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
	var currentWorkflow interface{}
	if cw, ok := req.Context["currentWorkflow"]; ok && cw != nil {
		if jsonBytes, marshalErr := json.Marshal(cw); marshalErr == nil {
			var workflow workflowSvc.SaveWorkflowNodesRequest
			if unmarshalErr := json.Unmarshal(jsonBytes, &workflow); unmarshalErr == nil {
				currentWorkflow = &workflow
			} else {
				currentWorkflow = cw
			}
		} else {
			currentWorkflow = cw
		}
	}
	systemPrompt, err := alkaidSvc.BuildSystemPromptForAgenticWithKnowledge(req.UserID, req.Message, relevantKnowledge, currentWorkflow)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}

	toolDefs := FilterToolDefsForRequest(FilterToolDefsByName(GetToolDefsForLLM(), analyzeAllowedToolNames), req.Context)
	aiProvider, err := buildAIProvider()
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}
	var workflowToolResult interface{}
	if turnCtx.CurrentTaskMode == TaskExplain {
		_ = sw.WritePhaseChanged(alkaidModels.PhasePlanning)
		result, _, toolErr := runAnalyzeTool(reqCtx, sw, runtimeDeps.Registry, req.SessionID, "get_workflow", "{}")
		if toolErr == nil {
			workflowToolResult = result
		}
	}
	messages := []providers.ChatMessage{{
		Role:    "user",
		Content: buildAnalyzeUserPrompt(req.Message, turnCtx.ConversationHistory, workflowToolResult),
	}}

	const maxTurns = 6
	var assistantContent string
	usedTools := workflowToolResult != nil

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

			if _, ok := analyzeAllowedToolNames[tc.Function.Name]; !ok {
				messages = append(messages, providers.ChatMessage{
					Role:       "tool",
					ToolCallID: tc.ID,
					Content:    `{"error":"tool_not_allowed_in_analyze_mode"}`,
				})
				continue
			}

			args := tc.Function.Arguments
			if args == "" {
				args = "{}"
			}

			result, resultSummary, toolErr := runAnalyzeTool(reqCtx, sw, runtimeDeps.Registry, req.SessionID, tc.Function.Name, args)
			if toolErr == nil && tc.Function.Name == "get_workflow" {
				workflowToolResult = result
			}

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
	}

	_ = sw.WritePhaseChanged(alkaidModels.PhaseSummarizing)
	streamAssistantText(sw, assistantContent, 12, 18*time.Millisecond)

	if turnCtx.CurrentTaskMode == TaskExplain {
		_ = sw.WriteExplainReport(buildExplainReportFromToolResult(assistantContent, workflowToolResult))
	}
	if usedTools {
		_ = sw.WritePhaseChanged(alkaidModels.PhaseIdle)
	}
	_ = sw.WriteDone()
	return nil
}

func runAnalyzeTool(reqCtx context.Context, sw *SSEWriter, registry *tools.Registry, sessionID uint, toolName string, params string) (interface{}, string, error) {
	if reqCtx.Err() != nil {
		_ = sw.WriteInterrupted()
		return nil, "", reqCtx.Err()
	}
	stepID := fmt.Sprintf("step-%d-%s", time.Now().UnixNano(), toolName)
	_ = sw.WriteToolStepStarted(stepID, toolName, alkaidModels.PhasePlanning)
	result, resultSummary, toolErr := registry.ExecuteToolForMode(string(TaskExplain), toolName, params, sessionID)
	status := alkaidModels.ToolStepSuccess
	errMsg := ""
	if toolErr != nil {
		status = alkaidModels.ToolStepError
		errMsg = toolErr.Error()
		resultSummary = errMsg
	}
	_ = sw.WriteToolStepFinished(stepID, status, resultSummary, errMsg)
	return result, resultSummary, toolErr
}

func buildAnalyzeUserPrompt(message, conversationHistory string, workflowToolResult interface{}) string {
	base := strings.TrimSpace(message)
	if conversationHistory != "" {
		base = strings.TrimSpace(conversationHistory) + "\n\n用户：" + base
	}
	if workflowToolResult != nil {
		if data, err := json.Marshal(workflowToolResult); err == nil && len(data) < 16000 {
			base += "\n\n当前工作流结构化上下文：\n" + string(data)
		}
	}

	return base + "\n\n你当前处于 workflow analyze mode。你的职责是查看、解释、分析当前工作流，并给出修改建议。你可以按需调用 get_workflow、get_capabilities、get_node_spec、search_knowledge、list_project_website_sources。不要交付待应用工作流，不要调用 validate_workflow、run_workflow_trial、propose_workflow、propose_patch，也不要假装已经修改画布。"
}
