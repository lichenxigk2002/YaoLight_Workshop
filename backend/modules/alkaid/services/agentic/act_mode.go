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
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

func runActMode(
	reqCtx context.Context,
	repo *alkaidRepos.AlkaidRepository,
	sw *SSEWriter,
	req RunStreamRequest,
	session *alkaidModels.AlkaidSession,
	userMsg *alkaidModels.AlkaidMessage,
) error {
	allow, reason, hookErr := CallBeforeGenerate(req.SessionID, req.UserID, req.Message)
	if hookErr != nil {
		_ = sw.WriteError(fmt.Sprintf("BeforeGenerate hook failed: %s", hookErr.Error()))
		return hookErr
	}
	if !allow {
		_ = sw.WriteError(fmt.Sprintf("Request blocked by guardrail: %s", reason))
		_ = sw.WriteDone()
		return fmt.Errorf("BeforeGenerate hook blocked request: %s", reason)
	}

	checkCancel := func() bool {
		if reqCtx.Err() != nil {
			_ = sw.WriteInterrupted()
			return true
		}
		return false
	}

	runtimeDeps := buildAgentRuntimeDeps(repo, req)
	registry := runtimeDeps.Registry
	taskMode := taskModeFromRequest(req, TaskGenerate)
	forceCrawlerPreparation := shouldForceCrawlerPreparation(req.Message)
	explicitSourceURLs := extractAbsoluteURLsFromText(req.Message)
	var crawlerKnowledge interface{}
	var crawlerNodeSpec interface{}
	validatedExplicitCrawlerURLs := make([]string, 0)

	var currentWorkflowForDiff *workflowSvc.SaveWorkflowNodesRequest
	if cw, ok := req.Context["currentWorkflow"]; ok && cw != nil {
		if jsonBytes, err := json.Marshal(cw); err == nil {
			var w workflowSvc.SaveWorkflowNodesRequest
			if err := json.Unmarshal(jsonBytes, &w); err == nil {
				currentWorkflowForDiff = &w
			}
		}
	}

	if forceCrawlerPreparation {
		_ = sw.WritePhaseChanged(alkaidModels.PhasePlanning)

		knowledgeStepID := fmt.Sprintf("step-%d-crawler-knowledge-prefetch", time.Now().UnixNano())
		_ = sw.WriteToolStepStarted(knowledgeStepID, "search_knowledge", alkaidModels.PhasePlanning)
		knowledgeResult, resultSummary, toolErr := registry.ExecuteToolForMode(
			string(taskMode),
			"search_knowledge",
			`{"query":"crawler node configuration URL extract mode selector extractAttr","target":"crawler","maxResults":6,"includeGeneralFallback":true}`,
			req.SessionID,
		)
		status := alkaidModels.ToolStepSuccess
		errMsg := ""
		if toolErr != nil {
			status = alkaidModels.ToolStepError
			errMsg = toolErr.Error()
			resultSummary = errMsg
		} else {
			crawlerKnowledge = knowledgeResult
		}
		_ = sw.WriteToolStepFinished(knowledgeStepID, status, resultSummary, errMsg)

		specStepID := fmt.Sprintf("step-%d-crawler-spec-prefetch", time.Now().UnixNano())
		_ = sw.WriteToolStepStarted(specStepID, "get_node_spec", alkaidModels.PhasePlanning)
		specResult, specSummary, specErr := registry.ExecuteToolForMode(string(taskMode), "get_node_spec", `{"nodeType":"crawler"}`, req.SessionID)
		specStatus := alkaidModels.ToolStepSuccess
		specErrMsg := ""
		if specErr != nil {
			specStatus = alkaidModels.ToolStepError
			specErrMsg = specErr.Error()
			specSummary = specErrMsg
		} else {
			crawlerNodeSpec = specResult
		}
		_ = sw.WriteToolStepFinished(specStepID, specStatus, specSummary, specErrMsg)

		for i, rawURL := range explicitSourceURLs {
			urlStepID := fmt.Sprintf("step-%d-crawler-url-prefetch-%d", time.Now().UnixNano(), i+1)
			_ = sw.WriteToolStepStarted(urlStepID, "check_url_accessibility", alkaidModels.PhasePlanning)
			result, resultSummary, toolErr := registry.ExecuteToolForMode(
				string(taskMode),
				"check_url_accessibility",
				fmt.Sprintf(`{"url":%q}`, rawURL),
				req.SessionID,
			)
			status := alkaidModels.ToolStepSuccess
			errMsg := ""
			if toolErr != nil {
				status = alkaidModels.ToolStepError
				errMsg = toolErr.Error()
				resultSummary = errMsg
			}
			_ = sw.WriteToolStepFinished(urlStepID, status, resultSummary, errMsg)

			if toolErr != nil {
				_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
				_ = sw.WriteError(fmt.Sprintf("Crawler source precheck failed: %s (%s)", rawURL, errMsg))
				_ = sw.WriteDone()
				return nil
			}

			report, ok := result.(map[string]interface{})
			if !ok {
				_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
				_ = sw.WriteError(fmt.Sprintf("Crawler source precheck returned invalid result: %s", rawURL))
				_ = sw.WriteDone()
				return nil
			}

			if accessible, _ := report["ok"].(bool); accessible {
				validatedExplicitCrawlerURLs = append(validatedExplicitCrawlerURLs, rawURL)
				continue
			}

			reason, _ := report["reason"].(string)
			if reason == "" {
				reason = "URL is not suitable for crawler source"
			}
			_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
			_ = sw.WriteError(fmt.Sprintf("Crawler source URL did not pass accessibility validation: %s (%s)", rawURL, reason))
			_ = sw.WriteDone()
			return nil
		}
	}

	alkaidSvc := alkaidServices.NewAlkaidService()
	relevantKnowledge, _ := alkaidSvc.GetRelevantKnowledgeForAgentic(req.UserID, req.Message, 8)
	systemPrompt, err := alkaidSvc.BuildSystemPromptForAgenticWithKnowledge(req.UserID, req.Message, relevantKnowledge, currentWorkflowForDiff)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}
	contentForLLM := req.Message
	if forceCrawlerPreparation {
		contentForLLM += "\n\nIf you generate or modify crawler nodes, make the crawler configuration explicit and complete. Include concrete source URLs, extraction mode or method, and any required selector or extractAttr fields when the chosen extraction strategy needs them."
		if len(validatedExplicitCrawlerURLs) > 0 {
			contentForLLM += "\n\nValidated crawler source URLs:\n- " + strings.Join(validatedExplicitCrawlerURLs, "\n- ")
		}
		if crawlerKnowledge != nil {
			if b, marshalErr := json.Marshal(crawlerKnowledge); marshalErr == nil && len(b) < 12000 {
				contentForLLM += "\n\nCrawler knowledge:\n" + string(b)
			}
		}
		if crawlerNodeSpec != nil {
			if b, marshalErr := json.Marshal(crawlerNodeSpec); marshalErr == nil && len(b) < 12000 {
				contentForLLM += "\n\nCrawler node spec:\n" + string(b)
			}
		}
	}
	if historyStr, histErr := alkaidSvc.GetConversationHistoryForAgentic(req.SessionID, 20); histErr == nil && strings.TrimSpace(historyStr) != "" {
		contentForLLM = buildAgenticConversationPrompt(historyStr, req.Message)
	}
	if forceCrawlerPreparation && strings.Contains(contentForLLM, "Continue from the existing conversation history") {
		contentForLLM += "\n\nCrawler-related requests require complete and explicit configuration. Make sure generated crawler nodes include source URLs, extraction settings, and any selector or attribute fields required by the chosen extraction mode."
	}

	aiConfig, err := buildAIConfig(req.UserID)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}
	toolDefs := FilterToolDefsForRequest(GetToolDefsForLLM(), req.Context)
	aiProvider, err := buildAIProvider()
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}
	streamer, canStreamWithTools := aiProvider.(toolStreamingProvider)

	planSteps := generateAgentPlan(reqCtx, aiProvider, aiConfig, systemPrompt, contentForLLM, userMsg.ID, req.Message)
	if len(planSteps) > 0 {
		_ = sw.WritePlanCreated(planSteps)
	}

	activePlanStepID := ""
	startPlanStep := func(step *alkaidModels.AgentPlanStep) {
		if step == nil {
			return
		}
		if activePlanStepID == step.PlanStepID && step.Status == alkaidModels.PlanStepRunning {
			return
		}
		if activePlanStepID != "" && activePlanStepID != step.PlanStepID {
			_ = sw.WritePlanStepFinished(activePlanStepID, alkaidModels.PlanStepSuccess, "Completed current plan step", "")
			for i := range planSteps {
				if planSteps[i].PlanStepID == activePlanStepID {
					planSteps[i].Status = alkaidModels.PlanStepSuccess
					break
				}
			}
		}
		step.Status = alkaidModels.PlanStepRunning
		activePlanStepID = step.PlanStepID
		_ = sw.WritePlanStepStarted(*step)
	}

	finishPlanStep := func(planStepID, status, resultSummary, errorMessage string) {
		if planStepID == "" {
			return
		}
		_ = sw.WritePlanStepFinished(planStepID, status, resultSummary, errorMessage)
		for i := range planSteps {
			if planSteps[i].PlanStepID == planStepID {
				planSteps[i].Status = status
				planSteps[i].ResultSummary = resultSummary
				planSteps[i].ErrorMessage = errorMessage
				break
			}
		}
		if activePlanStepID == planStepID {
			activePlanStepID = ""
		}
	}

	updatePlanStep := func(planStepID string, mutate func(step *alkaidModels.AgentPlanStep)) {
		if planStepID == "" || mutate == nil {
			return
		}
		for i := range planSteps {
			if planSteps[i].PlanStepID != planStepID {
				continue
			}
			mutate(&planSteps[i])
			_ = sw.WritePlanStepUpdated(planSteps[i])
			return
		}
	}

	nextPendingPlanStepByPhase := func(phase string) *alkaidModels.AgentPlanStep {
		for i := range planSteps {
			if planSteps[i].Status == alkaidModels.PlanStepSuccess || planSteps[i].Status == alkaidModels.PlanStepError {
				continue
			}
			if planSteps[i].Phase == phase {
				return &planSteps[i]
			}
		}
		return nil
	}

	if len(planSteps) > 0 {
		startPlanStep(&planSteps[0])
	}

	messages := []providers.ChatMessage{{Role: "user", Content: contentForLLM}}
	const maxTurns = 15
	var assistantContent string
	assistantContentStreamed := false
	usedToolCalls := false
	draftingStepID := ""

	startDraftingStep := func() {
		if draftingStepID != "" {
			return
		}
		step := nextPendingPlanStepByPhase(alkaidModels.PhaseGenerating)
		if step == nil {
			step = ensureSyntheticPlanStep(
				&planSteps,
				userMsg.ID,
				req.Message,
				"Draft final workflow response",
				"Enough context has been collected. Draft the final workflow response for the user.",
				alkaidModels.PhaseGenerating,
				nil,
			)
		}
		startPlanStep(step)
		draftingStepID = fmt.Sprintf("step-%d-draft_workflow", time.Now().UnixNano())
		_ = sw.WritePhaseChanged(alkaidModels.PhaseGenerating)
		_ = sw.WriteToolStepStartedWithPlan(draftingStepID, "draft_workflow", alkaidModels.PhaseGenerating, step.PlanStepID)
	}

	finishDraftingStep := func(summary string) {
		if draftingStepID == "" {
			return
		}
		_ = sw.WriteToolStepFinished(draftingStepID, alkaidModels.ToolStepSuccess, summary, "")
		finishPlanStep(activePlanStepID, alkaidModels.PlanStepSuccess, summary, "")
		draftingStepID = ""
	}

	for turn := 0; turn < maxTurns; turn++ {
		if checkCancel() {
			return nil
		}
		if turn > 0 {
			startDraftingStep()
		}
		if draftingStepID == "" {
			_ = sw.WritePhaseChanged(alkaidModels.PhasePlanning)
		}
		var resp *providers.ChatResponseWithTools
		var err error
		if streamer != nil && taskMode == TaskGenerate {
			if turn > 0 {
				startDraftingStep()
			}
			resp, err = streamer.ChatWithToolsStream(
				reqCtx,
				aiConfig,
				systemPrompt,
				messages,
				toolDefs,
				map[string]interface{}{"thinking": false},
				func(content string, done bool, streamErr error, usage *providers.TokenUsage) {
					if streamErr != nil {
						return
					}
					if content != "" {
						startDraftingStep()
						assistantContentStreamed = true
						_ = sw.WriteContent(content)
					}
				},
			)
		} else if turn > 0 {
			type chatWithToolsResult struct {
				resp *providers.ChatResponseWithTools
				err  error
			}

			resultCh := make(chan chatWithToolsResult, 1)
			go func() {
				chatResp, chatErr := aiProvider.ChatWithTools(reqCtx, aiConfig, systemPrompt, messages, toolDefs, map[string]interface{}{"thinking": false})
				resultCh <- chatWithToolsResult{resp: chatResp, err: chatErr}
			}()

			ticker := time.NewTicker(8 * time.Second)
			defer ticker.Stop()

		waitForPlanning:
			for {
				select {
				case <-reqCtx.Done():
					_ = sw.WriteInterrupted()
					return nil
				case result := <-resultCh:
					resp = result.resp
					err = result.err
					break waitForPlanning
				case <-ticker.C:
					startDraftingStep()
					continue
				}
			}
		} else {
			resp, err = aiProvider.ChatWithTools(reqCtx, aiConfig, systemPrompt, messages, toolDefs, map[string]interface{}{"thinking": false})
		}
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "context deadline exceeded") {
				err = fmt.Errorf("AI 生成超时，请稍后重试，或缩小一次生成的范围")
			}
			if draftingStepID != "" {
				_ = sw.WriteToolStepFinished(draftingStepID, alkaidModels.ToolStepError, "Failed to draft workflow response", err.Error())
				draftingStepID = ""
			}
			_ = sw.WriteError(err.Error())
			return err
		}
		if reqCtx.Err() != nil {
			_ = sw.WriteInterrupted()
			return nil
		}

		if len(resp.ToolCalls) == 0 {
			for i := range planSteps {
				if planSteps[i].PlanStepID == activePlanStepID && planSteps[i].Phase == alkaidModels.PhasePlanning {
					finishPlanStep(activePlanStepID, alkaidModels.PlanStepSuccess, "Planning finished and the agent is ready to answer", "")
					break
				}
			}
			assistantContent = strings.TrimSpace(resp.Content)
			if draftingStepID != "" {
				finishDraftingStep("Drafted workflow response")
			}
			break
		}
		finishDraftingStep("Prepared next drafting step and continued gathering context")
		usedToolCalls = true
		messages = append(messages, providers.ChatMessage{
			Role:      "assistant",
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		for _, tc := range resp.ToolCalls {
			if checkCancel() {
				return nil
			}
			selectedPlanStep := selectPlanStepForTool(planSteps, tc.Function.Name)
			if selectedPlanStep == nil {
				selectedPlanStep = ensureSyntheticPlanStep(
					&planSteps,
					userMsg.ID,
					req.Message,
					fmt.Sprintf("Use tool %s", tc.Function.Name),
					"Use the tool to gather missing context or validate the workflow before continuing.",
					alkaidModels.PhasePlanning,
					[]string{tc.Function.Name},
				)
			}
			startPlanStep(selectedPlanStep)
			stepID := fmt.Sprintf("step-%d-%s", time.Now().UnixNano(), tc.Function.Name)
			_ = sw.WriteToolStepStartedWithPlan(stepID, tc.Function.Name, alkaidModels.PhasePlanning, selectedPlanStep.PlanStepID)
			args := tc.Function.Arguments
			if args == "" {
				args = "{}"
			}
			result, resultSummary, toolErr := registry.ExecuteToolForMode(string(taskMode), tc.Function.Name, args, req.SessionID)
			status := alkaidModels.ToolStepSuccess
			errMsg := ""
			if toolErr != nil {
				status = alkaidModels.ToolStepError
				errMsg = toolErr.Error()
				resultSummary = errMsg
			}
			_ = sw.WriteToolStepFinished(stepID, status, resultSummary, errMsg)
			if status == alkaidModels.ToolStepSuccess {
				updatePlanStep(selectedPlanStep.PlanStepID, func(step *alkaidModels.AgentPlanStep) {
					step.ResultSummary = resultSummary
				})
			}
			if toolErr != nil {
				finishPlanStep(selectedPlanStep.PlanStepID, alkaidModels.PlanStepError, resultSummary, errMsg)
			}

			toolContent := buildToolContentForLLM(tc.Function.Name, result, resultSummary)
			messages = append(messages, providers.ChatMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Content:    toolContent,
			})
		}
	}

	if assistantContent == "" && len(messages) > 0 {
		assistantContent = findLatestAssistantContent(messages, false)
	}

	if assistantContent == "" && usedToolCalls {
		finalPrompt := "Based on the conversation history and completed tool results, provide the final answer to the user now. Do not say you will continue checking or gathering more information. If the user asked for a workflow, deliver the complete final workflow response."
		finalResp, finalErr := aiProvider.ChatWithTools(
			reqCtx,
			aiConfig,
			systemPrompt,
			append(messages, providers.ChatMessage{Role: "user", Content: finalPrompt}),
			nil,
			map[string]interface{}{"thinking": false},
		)
		if finalErr == nil && finalResp != nil {
			assistantContent = strings.TrimSpace(finalResp.Content)
		}
	}

	if assistantContent != "" && !assistantContentStreamed {
		_ = sw.WritePhaseChanged(alkaidModels.PhaseGenerating)

		streamWorkflowJSON := extractWorkflowJSON(assistantContent)
		prefix := assistantContent
		jsonPart := ""
		textAfter := ""
		if streamWorkflowJSON != "" {
			if idx := strings.Index(assistantContent, streamWorkflowJSON); idx >= 0 {
				prefix = assistantContent[:idx]
				jsonPart = assistantContent[idx : idx+len(streamWorkflowJSON)]
				if idx+len(streamWorkflowJSON) < len(assistantContent) {
					textAfter = assistantContent[idx+len(streamWorkflowJSON):]
				}
			}
		}

		streamText := func(text string) {
			if text == "" {
				return
			}
			const chunkSize = 3
			const sleepPerChunk = 18 * time.Millisecond
			runes := []rune(text)
			for i := 0; i < len(runes); i += chunkSize {
				end := i + chunkSize
				if end > len(runes) {
					end = len(runes)
				}
				_ = sw.WriteContent(string(runes[i:end]))
				time.Sleep(sleepPerChunk)
			}
		}

		streamText(prefix)
		if jsonPart != "" {
			_ = sw.WriteContent(jsonPart)
		}
		streamText(textAfter)
	}

	if checkCancel() {
		return nil
	}

	pipelineCtx := &actPipelineContext{
		reqCtx:                 reqCtx,
		req:                    req,
		session:                session,
		userMsg:                userMsg,
		sw:                     sw,
		registry:               registry,
		aiProvider:             aiProvider,
		streamer:               streamer,
		canStreamWithTools:     canStreamWithTools,
		aiConfig:               aiConfig,
		systemPrompt:           systemPrompt,
		messages:               messages,
		assistantContent:       assistantContent,
		currentWorkflowForDiff: currentWorkflowForDiff,
		planSteps:              &planSteps,
		callbacks: actPlanCallbacks{
			start:  startPlanStep,
			finish: finishPlanStep,
			update: updatePlanStep,
		},
	}
	finalized, pipelineErr := runActWorkflowPipeline(pipelineCtx)
	if pipelineErr != nil {
		return pipelineErr
	}
	if finalized {
		return nil
	}
	if activePlanStepID != "" {
		finishPlanStep(activePlanStepID, alkaidModels.PlanStepSuccess, "Completed current plan step", "")
	}
	_ = sw.WritePhaseChanged(alkaidModels.PhaseIdle)
	_ = sw.WriteDone()
	return nil
}

func findLatestAssistantContent(messages []providers.ChatMessage, includeToolCallPreface bool) string {
	for i := len(messages) - 1; i >= 0; i-- {
		msg := messages[i]
		if msg.Role != "assistant" || strings.TrimSpace(msg.Content) == "" {
			continue
		}
		if !includeToolCallPreface && len(msg.ToolCalls) > 0 {
			continue
		}
		return msg.Content
	}
	return ""
}

func buildAgenticConversationPrompt(history, currentMessage string) string {
	trimmedHistory := strings.TrimSpace(history)
	if len(trimmedHistory) > 12000 {
		trimmedHistory = trimmedHistory[len(trimmedHistory)-12000:]
	}

	return trimmedHistory +
		"\n\nCurrent user request:\n" + strings.TrimSpace(currentMessage) +
		"\n\nContinue from the existing conversation history. Focus on the latest user request first. Keep the response grounded in the current workflow, call tools only when they add needed context, and avoid repeating tool calls that were already completed unless the information is stale or missing."
}
