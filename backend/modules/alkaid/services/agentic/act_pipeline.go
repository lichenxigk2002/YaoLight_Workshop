package agentic

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"yaolight-workshop/backend/modules/ai/services/providers"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	"yaolight-workshop/backend/modules/alkaid/services/tools"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

type actPlanCallbacks struct {
	start  func(*alkaidModels.AgentPlanStep)
	finish func(string, string, string, string)
	update func(string, func(step *alkaidModels.AgentPlanStep))
}

type actPipelineContext struct {
	reqCtx                 context.Context
	req                    RunStreamRequest
	session                *alkaidModels.AlkaidSession
	userMsg                *alkaidModels.AlkaidMessage
	sw                     *SSEWriter
	registry               *tools.Registry
	aiProvider             providers.AIProvider
	streamer               toolStreamingProvider
	canStreamWithTools     bool
	aiConfig               *providers.AIModelConfig
	systemPrompt           string
	messages               []providers.ChatMessage
	assistantContent       string
	currentWorkflowForDiff *workflowSvc.SaveWorkflowNodesRequest
	planSteps              *[]alkaidModels.AgentPlanStep
	callbacks              actPlanCallbacks
}

func runActWorkflowPipeline(ctx *actPipelineContext) (bool, error) {
	draft, finalized, err := draftArtifact(ctx)
	if err != nil || finalized {
		return finalized, err
	}
	if draft == nil {
		return false, nil
	}

	draft, _, validationErrors, finalized, err := validateArtifact(ctx, draft)
	if err != nil || finalized {
		return finalized, err
	}

	draft, _, finalized, err = trialArtifact(ctx, draft, validationErrors)
	if err != nil || finalized {
		return finalized, err
	}

	if err := proposeArtifact(ctx, draft); err != nil {
		return true, err
	}
	return false, nil
}

func draftArtifact(ctx *actPipelineContext) (*alkaidModels.WorkflowDraft, bool, error) {
	workflowJSON, finalized, err := extractWorkflowJSONWithFallback(ctx)
	if err != nil || finalized || workflowJSON == "" {
		return nil, finalized, err
	}
	draft, buildErr := BuildWorkflowDraft(workflowJSON, "已生成工作流草稿", string(ctx.reqMode()))
	if buildErr != nil {
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("工作流草稿格式无效: " + buildErr.Error())
		_ = ctx.sw.WriteDone()
		return nil, true, nil
	}
	return draft, false, nil
}

func validateArtifact(ctx *actPipelineContext, draft *alkaidModels.WorkflowDraft) (*alkaidModels.WorkflowDraft, *alkaidModels.ValidationReport, []interface{}, bool, error) {
	workflowJSON, _, validationErrors, finalized, err := validateWorkflowAndURLsWithRetry(ctx, draft.WorkflowJSON, true)
	if err != nil || finalized {
		return draft, nil, validationErrors, finalized, err
	}
	if workflowJSON == "" {
		return nil, nil, validationErrors, true, nil
	}
	draft.WorkflowJSON = workflowJSON
	draft.ValidationPass = true
	report := BuildValidationReport(true, nil, interfaceErrorsToStrings(validationErrors), "工作流结构校验通过")
	return draft, &report, validationErrors, false, nil
}

func trialArtifact(ctx *actPipelineContext, draft *alkaidModels.WorkflowDraft, validationErrors []interface{}) (*alkaidModels.WorkflowDraft, *alkaidModels.TrialReport, bool, error) {
	trialRequired := workflowJSONHasNodeType(draft.WorkflowJSON, "crawler")
	workflowJSON, finalized, err := runWorkflowTrialAndRepair(ctx, draft.WorkflowJSON, validationErrors)
	if err != nil || finalized {
		return draft, nil, finalized, err
	}
	if !trialRequired {
		draft.TrialPass = false
		report := BuildTrialReport(true, "", []string{"当前草稿未包含需要浏览器/网页抓取的节点，已跳过运行时试跑。"}, "已完成结构校验；未执行运行时试跑")
		return draft, &report, false, nil
	}
	draft.TrialPass = workflowJSON == draft.WorkflowJSON
	if workflowJSON != draft.WorkflowJSON {
		draft.WorkflowJSON = workflowJSON
		draft.TrialPass = true
		draft.Summary = "工作流试跑后已自动修复并通过校验"
	}
	report := BuildTrialReport(draft.TrialPass, "", nil, "工作流快速结构检查阶段已完成")
	return draft, &report, false, nil
}

func workflowJSONHasNodeType(workflowJSON string, nodeType string) bool {
	var workflowMap map[string]interface{}
	if err := json.Unmarshal([]byte(workflowJSON), &workflowMap); err != nil {
		return false
	}
	return workflowHasNodeType(workflowMap, nodeType)
}

func proposeArtifact(ctx *actPipelineContext, draft *alkaidModels.WorkflowDraft) error {
	if ctx.reqMode() == TaskRepair {
		patch, summary, ok := buildRepairPatchArtifact(ctx, draft.WorkflowJSON)
		if ok {
			return proposePatchResult(ctx, patch, summary)
		}
	}
	return proposeWorkflowResult(ctx, draft)
}

func (ctx *actPipelineContext) reqMode() TaskMode {
	if ctx == nil {
		return TaskGenerate
	}
	return taskModeFromRequest(ctx.req, TaskGenerate)
}

func (ctx *actPipelineContext) executeTool(name string, params string) (interface{}, string, error) {
	return ctx.registry.ExecuteToolForMode(string(ctx.reqMode()), name, params, ctx.req.SessionID)
}

func extractWorkflowJSONWithFallback(ctx *actPipelineContext) (string, bool, error) {
	workflowJSON := extractWorkflowJSON(ctx.assistantContent)
	if workflowJSON == "" && (ctx.reqMode() == TaskGenerate || ctx.reqMode() == TaskRepair) {
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseGenerating)
		_ = ctx.sw.WriteContent("\n\n我正在把方案整理成可直接应用的工作流，请稍候。\n")

		forcedContent, forcedErr := forceWorkflowDelivery(
			ctx.reqCtx,
			ctx.aiProvider,
			ctx.streamer,
			ctx.canStreamWithTools,
			buildWorkflowFallbackConfig(ctx.aiConfig),
			ctx.systemPrompt,
			ctx.messages,
			ctx.assistantContent,
			ctx.reqMode(),
			func(content string) {
				_ = ctx.sw.WriteContent(content)
			},
		)
		if ctx.reqCtx.Err() != nil {
			_ = ctx.sw.WriteInterrupted()
			return "", true, nil
		}
		if forcedErr == nil && forcedContent != "" {
			workflowJSON = extractWorkflowJSON(forcedContent)
			if workflowJSON != "" {
				ctx.assistantContent = strings.TrimSpace(forcedContent)
			}
		}
	}
	if workflowJSON == "" && shouldAttemptWorkflowFallback(ctx.req.Message, ctx.assistantContent) {
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseGenerating)
		_ = ctx.sw.WriteContent("\n\n主回复较长，我正在单独整理结构化工作流，请稍候。\n")

		fallbackContent, fallbackErr := generateWorkflowJSONFallback(
			ctx.reqCtx,
			ctx.aiProvider,
			ctx.streamer,
			ctx.canStreamWithTools,
			buildWorkflowFallbackConfig(ctx.aiConfig),
			ctx.systemPrompt,
			ctx.messages,
			ctx.assistantContent,
		)
		if ctx.reqCtx.Err() != nil {
			_ = ctx.sw.WriteInterrupted()
			return "", true, nil
		}
		if fallbackErr != nil {
			_ = ctx.sw.WriteContent("结构化工作流整理失败，本轮先保留文本方案。\n")
		} else if fallbackContent != "" {
			workflowJSON = extractWorkflowJSON(fallbackContent)
			if workflowJSON != "" {
				_ = ctx.sw.WriteContent("已整理出可应用的结构化工作流，正在继续校验。\n")
			} else {
				_ = ctx.sw.WriteContent("结构化工作流仍不完整，本轮先保留文本方案。\n")
			}
		}
	}
	if workflowJSON == "" && (ctx.reqMode() == TaskGenerate || ctx.reqMode() == TaskRepair) {
		errMsg := "这次回复没有产出可直接应用的工作流，我已中止这轮回答。请重试，或把需求说得更明确一些。"
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError(errMsg)
		_ = ctx.sw.WriteDone()
		return "", true, nil
	}
	return workflowJSON, false, nil
}

func validateWorkflowAndURLsWithRetry(ctx *actPipelineContext, workflowJSON string, allowURLRetry bool) (string, map[string]interface{}, []interface{}, bool, error) {
	workflowJSON, workflowMap, validationErrors, finalized, err := validateWorkflowAndURLs(ctx, workflowJSON)
	if err != nil || finalized || workflowJSON == "" {
		return workflowJSON, workflowMap, validationErrors, finalized, err
	}

	urlCandidates := collectWorkflowURLCandidates(workflowMap)
	if len(urlCandidates) == 0 {
		return workflowJSON, workflowMap, validationErrors, false, nil
	}

	okCount, failures, timedOutFailures := inspectWorkflowURLCandidates(ctx, urlCandidates)
	if len(failures) == 0 {
		return workflowJSON, workflowMap, validationErrors, false, nil
	}

	if okCount > 0 {
		_ = ctx.sw.WriteContent("\n\n⚠️ 部分候选 URL 预检未通过，我会保留可用来源并继续尝试生成/修复工作流。\n")
		_ = ctx.sw.WriteContent("以下来源已被忽略: " + strings.Join(failures, "; ") + "\n")
		return workflowJSON, workflowMap, validationErrors, false, nil
	}

	if allowURLRetry && len(timedOutFailures) > 0 {
		_ = ctx.sw.WriteContent("\n\n⚠️ 当前候选来源在服务器环境中访问超时，正在自动换用更适合国内网络环境的公开来源。\n")
		regeneratedWorkflowJSON, regenerateErr := regenerateWorkflowForDomesticSources(ctx, workflowJSON, failures)
		if regenerateErr == nil && regeneratedWorkflowJSON != "" && regeneratedWorkflowJSON != workflowJSON {
			return validateWorkflowAndURLsWithRetry(ctx, regeneratedWorkflowJSON, false)
		}
	}

	errMsg := "以下候选 URL 当前不适合作为 crawler 数据源: " + strings.Join(failures, "; ")
	_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
	_ = ctx.sw.WriteError(errMsg)
	_ = ctx.sw.WriteDone()
	return "", nil, nil, true, nil
}

func validateWorkflowAndURLs(ctx *actPipelineContext, workflowJSON string) (string, map[string]interface{}, []interface{}, bool, error) {
	var workflowMap map[string]interface{}
	if err := json.Unmarshal([]byte(workflowJSON), &workflowMap); err != nil {
		_ = ctx.sw.WriteContent("\n\n⚠️ 提取的工作流 JSON 格式有误，无法处理\n")
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseIdle)
		_ = ctx.sw.WriteDone()
		return "", nil, nil, true, nil
	}

	crawlerRequired := workflowHasNodeType(workflowMap, "crawler")
	if crawlerRequired && ensureCrawlerNodeDefaults(workflowMap) {
		if normalizedWorkflowJSON, marshalErr := json.Marshal(workflowMap); marshalErr == nil {
			workflowJSON = string(normalizedWorkflowJSON)
		}
	}
	if crawlerRequired {
		crawlerConfigErrors := validateCrawlerNodeConfigs(workflowMap)
		if len(crawlerConfigErrors) > 0 {
			errMsg := "crawler 节点配置不完整，无法保证可用性: " + strings.Join(crawlerConfigErrors, "; ")
			_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
			_ = ctx.sw.WriteError(errMsg)
			_ = ctx.sw.WriteDone()
			return "", nil, nil, true, nil
		}
	}

	allow, reason, hookErr := CallAfterGenerate(ctx.req.SessionID, ctx.req.UserID, workflowMap)
	if hookErr != nil {
		_ = ctx.sw.WriteError(fmt.Sprintf("Hook 调用失败: %s", hookErr.Error()))
	} else if !allow {
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError(fmt.Sprintf("工作流被拒绝: %s", reason))
		_ = ctx.sw.WriteDone()
		return "", nil, nil, true, fmt.Errorf("AfterGenerate Hook 拒绝: %s", reason)
	}

	_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseValidating)
	validatePlanStep := ensureSyntheticPlanStep(
		ctx.planSteps,
		ctx.userMsg.ID,
		ctx.req.Message,
		"校验工作流结果",
		"在交付前检查工作流 JSON 是否符合节点与连线规范。",
		alkaidModels.PhaseValidating,
		[]string{"validate_workflow"},
	)
	ctx.callbacks.start(validatePlanStep)
	_ = ctx.sw.WriteToolStepStartedWithPlan("step-validate", "validate_workflow", alkaidModels.PhaseValidating, validatePlanStep.PlanStepID)
	params := fmt.Sprintf(`{"workflow":%s}`, workflowJSON)
	valResult, valSummary, valErr := ctx.executeTool("validate_workflow", params)

	var valid bool
	var validationErrors []interface{}
	if m, ok := valResult.(map[string]interface{}); ok {
		valid, _ = m["valid"].(bool)
		validationErrors, _ = m["errors"].([]interface{})
	}

	if valErr != nil || !valid {
		errMsg := valSummary
		if valErr != nil {
			errMsg = valErr.Error()
		}
		_ = ctx.sw.WriteToolStepFinished("step-validate", alkaidModels.ToolStepError, valSummary, errMsg)
		ctx.callbacks.finish(validatePlanStep.PlanStepID, alkaidModels.PlanStepError, valSummary, errMsg)
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError(fmt.Sprintf("工作流校验失败: %s", errMsg))
		_ = ctx.sw.WriteDone()
		return "", nil, nil, true, nil
	}
	_ = ctx.sw.WriteToolStepFinished("step-validate", alkaidModels.ToolStepSuccess, valSummary, "")
	ctx.callbacks.finish(validatePlanStep.PlanStepID, alkaidModels.PlanStepSuccess, valSummary, "")

	urlCandidates := collectWorkflowURLCandidates(workflowMap)
	if crawlerRequired && len(urlCandidates) == 0 {
		errMsg := "检测到工作流包含 crawler 节点，但没有找到可验证的具体网站 URL。请提供可直接访问的详情页或正文页链接后再生成工作流。"
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError(errMsg)
		_ = ctx.sw.WriteDone()
		return "", nil, nil, true, nil
	}
	if len(urlCandidates) > 0 {
		urlPlanStep := ensureSyntheticPlanStep(
			ctx.planSteps,
			ctx.userMsg.ID,
			ctx.req.Message,
			"验证候选数据源 URL",
			"工作流包含外部页面抓取时，需要先确认候选链接是否可直接作为 crawler 数据源，避免使用搜索页、登录页或难以抓取的页面。",
			alkaidModels.PhaseValidating,
			[]string{"check_url_accessibility"},
		)
		ctx.callbacks.start(urlPlanStep)
		ctx.callbacks.update(urlPlanStep.PlanStepID, func(step *alkaidModels.AgentPlanStep) {
			step.ResultSummary = fmt.Sprintf("检测到 %d 个候选 URL，开始逐个校验可访问性", len(urlCandidates))
		})
		okCount, failures, _ := inspectWorkflowURLCandidatesWithProgress(ctx, urlPlanStep.PlanStepID, urlCandidates)
		urlValidationSummary := fmt.Sprintf("已校验 %d 个候选 URL，其中 %d 个可直接抓取", len(urlCandidates), okCount)
		if len(failures) > 0 {
			errMsg := "以下候选 URL 当前不适合作为 crawler 数据源: " + strings.Join(failures, "; ")
			ctx.callbacks.update(urlPlanStep.PlanStepID, func(step *alkaidModels.AgentPlanStep) {
				step.ResultSummary = urlValidationSummary
				step.ErrorMessage = errMsg
			})
			ctx.callbacks.finish(urlPlanStep.PlanStepID, alkaidModels.PlanStepError, urlValidationSummary, errMsg)
			return workflowJSON, workflowMap, validationErrors, false, nil
		}
		ctx.callbacks.update(urlPlanStep.PlanStepID, func(step *alkaidModels.AgentPlanStep) {
			step.ResultSummary = urlValidationSummary
		})
		ctx.callbacks.finish(urlPlanStep.PlanStepID, alkaidModels.PlanStepSuccess, urlValidationSummary, "")
	}

	return workflowJSON, workflowMap, validationErrors, false, nil
}

func inspectWorkflowURLCandidates(ctx *actPipelineContext, urlCandidates []string) (okCount int, failures []string, timedOutFailures []string) {
	return inspectWorkflowURLCandidatesWithProgress(ctx, "", urlCandidates)
}

func inspectWorkflowURLCandidatesWithProgress(ctx *actPipelineContext, planStepID string, urlCandidates []string) (okCount int, failures []string, timedOutFailures []string) {
	failures = make([]string, 0)
	timedOutFailures = make([]string, 0)
	for i, rawURL := range urlCandidates {
		urlStepID := fmt.Sprintf("step-url-check-%d", i+1)
		if planStepID != "" {
			_ = ctx.sw.WriteToolStepStartedWithPlan(urlStepID, "check_url_accessibility", alkaidModels.PhaseValidating, planStepID)
		}
		result, resultSummary, toolErr := ctx.executeTool("check_url_accessibility", fmt.Sprintf(`{"url":%q}`, rawURL))
		status := alkaidModels.ToolStepSuccess
		errMsg := ""
		if toolErr != nil {
			status = alkaidModels.ToolStepError
			errMsg = toolErr.Error()
			resultSummary = errMsg
		}
		if planStepID != "" {
			_ = ctx.sw.WriteToolStepFinished(urlStepID, status, resultSummary, errMsg)
		}

		if toolErr != nil {
			failure := fmt.Sprintf("%s (%s)", rawURL, errMsg)
			failures = append(failures, failure)
			if isRetryableURLFailure(errMsg) {
				timedOutFailures = append(timedOutFailures, failure)
			}
			continue
		}

		report, ok := result.(map[string]interface{})
		if !ok {
			failures = append(failures, fmt.Sprintf("%s (invalid accessibility result)", rawURL))
			continue
		}

		if accessible, _ := report["ok"].(bool); accessible {
			okCount++
			continue
		}

		reason, _ := report["reason"].(string)
		if reason == "" {
			reason = "not suitable for crawler source"
		}
		failure := fmt.Sprintf("%s (%s)", rawURL, reason)
		failures = append(failures, failure)
		if isRetryableURLFailure(reason) {
			timedOutFailures = append(timedOutFailures, failure)
		}
	}
	return okCount, failures, timedOutFailures
}

func isRetryableURLFailure(reason string) bool {
	lower := strings.ToLower(strings.TrimSpace(reason))
	if lower == "" {
		return false
	}
	markers := []string{
		"context deadline exceeded",
		"client.timeout exceeded",
		"timeout",
		"i/o timeout",
		"connection reset",
		"connection refused",
		"no such host",
		"temporary failure",
		"awaiting headers",
		"访问失败",
	}
	for _, marker := range markers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func regenerateWorkflowForDomesticSources(ctx *actPipelineContext, workflowJSON string, failures []string) (string, error) {
	rewriteMessages := append([]providers.ChatMessage{}, ctx.messages...)
	if strings.TrimSpace(ctx.assistantContent) != "" {
		rewriteMessages = append(rewriteMessages, providers.ChatMessage{
			Role:    "assistant",
			Content: ctx.assistantContent,
		})
	}
	rewriteMessages = append(rewriteMessages, providers.ChatMessage{
		Role: "user",
		Content: "你刚才给出的工作流里，外部来源在当前服务器环境中不可访问或超时。\n" +
			"请保持工作流目标不变，重新输出一个完整可导入的工作流 JSON，并替换掉这些不稳定来源：\n- " + strings.Join(failures, "\n- ") + "\n\n" +
			"硬性要求：\n" +
			"1. 优先选择中国大陆服务器环境中更稳定、无需代理、无需登录的公开网页来源。\n" +
			"2. 不要优先使用 wikipedia.org 等跨境不稳定来源。\n" +
			"3. 尽量提供 2-3 个国内可访问备选来源，而不是只保留单一来源。\n" +
			"4. 只输出完整工作流 JSON，不要附加解释。",
	})

	resp, err := ctx.aiProvider.ChatWithTools(ctx.reqCtx, buildWorkflowFallbackConfig(ctx.aiConfig), ctx.systemPrompt, rewriteMessages, nil, map[string]interface{}{"thinking": false})
	if err != nil || resp == nil {
		return "", err
	}
	return extractWorkflowJSON(resp.Content), nil
}

func runWorkflowTrialAndRepair(ctx *actPipelineContext, workflowJSON string, validationErrors []interface{}) (string, bool, error) {
	var workflowMap map[string]interface{}
	if err := json.Unmarshal([]byte(workflowJSON), &workflowMap); err != nil {
		return workflowJSON, false, err
	}
	crawlerRequired := workflowHasNodeType(workflowMap, "crawler")
	if !crawlerRequired {
		return workflowJSON, false, nil
	}
	if ctx.reqCtx.Err() != nil {
		_ = ctx.sw.WriteInterrupted()
		return workflowJSON, true, nil
	}

	_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseRunningTrial)
	trialPlanStep := ensureSyntheticPlanStep(
		ctx.planSteps,
		ctx.userMsg.ID,
		ctx.req.Message,
		"检查工作流",
		"在正式交付前做一次快速结构检查，尽早发现不可执行问题。",
		alkaidModels.PhaseRunningTrial,
		[]string{"run_workflow_trial"},
	)
	ctx.callbacks.start(trialPlanStep)
	_ = ctx.sw.WriteToolStepStartedWithPlan("step-trial", "run_workflow_trial", alkaidModels.PhaseRunningTrial, trialPlanStep.PlanStepID)
	params := fmt.Sprintf(`{"workflow":%s,"level":"quick"}`, workflowJSON)
	trialResult, trialSummary, trialErr := ctx.executeTool("run_workflow_trial", params)

	var trialSuccess bool
	var trialErrorMsg string
	if m, ok := trialResult.(map[string]interface{}); ok {
		trialSuccess, _ = m["success"].(bool)
		if errField, hasErr := m["error"]; hasErr && errField != nil {
			trialErrorMsg = fmt.Sprintf("%v", errField)
		}
	}

	if trialErr == nil && trialSuccess {
		_ = ctx.sw.WriteToolStepFinished("step-trial", alkaidModels.ToolStepSuccess, trialSummary, "")
		ctx.callbacks.finish(trialPlanStep.PlanStepID, alkaidModels.PlanStepSuccess, trialSummary, "")
		return workflowJSON, false, nil
	}

	errMsg := trialSummary
	if trialErr != nil {
		errMsg = trialErr.Error()
	} else if trialErrorMsg != "" {
		errMsg = trialErrorMsg
	}
	_ = ctx.sw.WriteToolStepFinished("step-trial", alkaidModels.ToolStepError, trialSummary, errMsg)
	ctx.callbacks.finish(trialPlanStep.PlanStepID, alkaidModels.PlanStepError, trialSummary, errMsg)

	workflowID := uint(0)
	if ctx.session.WorkflowID != nil {
		workflowID = *ctx.session.WorkflowID
	}
	executionError := map[string]interface{}{
		"message": errMsg,
		"summary": trialSummary,
	}
	if trialResult != nil {
		if m, ok := trialResult.(map[string]interface{}); ok {
			executionError["details"] = m
		}
	}
	_, _, _ = CallOnWorkflowRunFailed(ctx.req.SessionID, ctx.req.UserID, workflowID, executionError)

	if ctx.reqCtx.Err() != nil {
		_ = ctx.sw.WriteInterrupted()
		return workflowJSON, true, nil
	}
	_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseRepairing)
	repairPlanStep := ensureSyntheticPlanStep(
		ctx.planSteps,
		ctx.userMsg.ID,
		ctx.req.Message,
		"自动修复工作流",
		"试跑失败后，系统会基于错误信息自动重建并校验一版修复后的工作流。",
		alkaidModels.PhaseRepairing,
		[]string{"draft_workflow", "validate_workflow"},
	)
	ctx.callbacks.start(repairPlanStep)
	_ = ctx.sw.WriteToolStepStartedWithPlan("step-repair-draft", "draft_workflow", alkaidModels.PhaseRepairing, repairPlanStep.PlanStepID)

	repairPrompt := fmt.Sprintf("工作流试跑失败，错误信息：%s\n\n请分析错误原因并生成修复后的工作流。", errMsg)
	if len(validationErrors) > 0 {
		errBytes, _ := json.Marshal(validationErrors)
		repairPrompt = fmt.Sprintf("工作流试跑失败。校验错误：%s，执行错误：%s\n\n请修复这些问题并重新生成工作流。", string(errBytes), errMsg)
	}

	repairMessages := append([]providers.ChatMessage{}, ctx.messages...)
	repairMessages = append(repairMessages, providers.ChatMessage{
		Role:    "user",
		Content: repairPrompt,
	})

	repairResp, repairErr := ctx.aiProvider.ChatWithTools(ctx.reqCtx, ctx.aiConfig, ctx.systemPrompt, repairMessages, GetToolDefsForLLM(), map[string]interface{}{"thinking": false})
	if repairErr != nil || ctx.reqCtx.Err() != nil {
		_ = ctx.sw.WriteToolStepFinished("step-repair-draft", alkaidModels.ToolStepError, "自动修复失败", "自动修复失败，请手动调整工作流")
		ctx.callbacks.finish(repairPlanStep.PlanStepID, alkaidModels.PlanStepError, "自动修复失败", "自动修复失败，请手动调整工作流")
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("自动修复失败，请手动调整工作流")
		_ = ctx.sw.WriteDone()
		return workflowJSON, true, nil
	}

	repairSummary := "已生成修复建议，正在提取修复后的工作流"
	_ = ctx.sw.WriteToolStepFinished("step-repair-draft", alkaidModels.ToolStepSuccess, repairSummary, "")
	ctx.callbacks.update(repairPlanStep.PlanStepID, func(step *alkaidModels.AgentPlanStep) {
		step.ResultSummary = repairSummary
	})

	repairedWorkflowJSON := extractWorkflowJSON(repairResp.Content)
	if repairedWorkflowJSON == "" {
		ctx.callbacks.finish(repairPlanStep.PlanStepID, alkaidModels.PlanStepError, "自动修复失败", "无法从修复建议中提取有效工作流")
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("无法从修复建议中提取有效工作流")
		_ = ctx.sw.WriteDone()
		return workflowJSON, true, nil
	}

	var repairedMap map[string]interface{}
	if err := json.Unmarshal([]byte(repairedWorkflowJSON), &repairedMap); err != nil {
		ctx.callbacks.finish(repairPlanStep.PlanStepID, alkaidModels.PlanStepError, "自动修复失败", "修复后的工作流 JSON 格式仍然有误")
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("修复后的工作流 JSON 格式仍然有误")
		_ = ctx.sw.WriteDone()
		return workflowJSON, true, nil
	}

	repairValidatePlanStep := ensureSyntheticPlanStep(
		ctx.planSteps,
		ctx.userMsg.ID,
		ctx.req.Message,
		"校验修复后的工作流",
		"修复后再次确认工作流结构已经满足规范。",
		alkaidModels.PhaseRepairing,
		[]string{"validate_workflow"},
	)
	ctx.callbacks.start(repairValidatePlanStep)
	_ = ctx.sw.WriteToolStepStartedWithPlan("step-validate-repair", "validate_workflow", alkaidModels.PhaseRepairing, repairValidatePlanStep.PlanStepID)
	valResult2, valSummary2, valErr2 := ctx.executeTool("validate_workflow", fmt.Sprintf(`{"workflow":%s}`, repairedWorkflowJSON))

	var validRepair bool
	if m, ok := valResult2.(map[string]interface{}); ok {
		validRepair, _ = m["valid"].(bool)
	}
	if valErr2 != nil || !validRepair {
		_ = ctx.sw.WriteToolStepFinished("step-validate-repair", alkaidModels.ToolStepError, valSummary2, "修复后仍存在问题")
		ctx.callbacks.finish(repairPlanStep.PlanStepID, alkaidModels.PlanStepError, valSummary2, "自动修复未能完全解决问题，建议手动调整")
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("自动修复未能完全解决问题，建议手动调整")
		_ = ctx.sw.WriteDone()
		return workflowJSON, true, nil
	}
	_ = ctx.sw.WriteToolStepFinished("step-validate-repair", alkaidModels.ToolStepSuccess, valSummary2, "")
	ctx.callbacks.finish(repairValidatePlanStep.PlanStepID, alkaidModels.PlanStepSuccess, valSummary2, "")
	ctx.callbacks.finish(repairPlanStep.PlanStepID, alkaidModels.PlanStepSuccess, "已自动修复并通过校验", "")
	return repairedWorkflowJSON, false, nil
}

func proposeWorkflowResult(ctx *actPipelineContext, draft *alkaidModels.WorkflowDraft) error {
	workflowJSON := draft.WorkflowJSON
	_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseWaitingApproval)
	proposePlanStep := ensureSyntheticPlanStep(
		ctx.planSteps,
		ctx.userMsg.ID,
		ctx.req.Message,
		"整理待确认结果",
		"将最终工作流整理成可确认的交付结果，等待用户决定是否应用。",
		alkaidModels.PhaseWaitingApproval,
		[]string{"propose_workflow", "propose_patch"},
	)
	ctx.callbacks.start(proposePlanStep)
	_ = ctx.sw.WriteToolStepStartedWithPlan("step-propose", "propose_workflow", alkaidModels.PhaseWaitingApproval, proposePlanStep.PlanStepID)
	draftJSON, _ := json.Marshal(draft)
	_, propSummary, _ := ctx.executeTool("propose_workflow", fmt.Sprintf(`{"draft":%s}`, string(draftJSON)))
	_ = ctx.sw.WriteToolStepFinished("step-propose", alkaidModels.ToolStepSuccess, propSummary, "")

	var nodeCount, edgeCount int
	var wf map[string]interface{}
	_ = json.Unmarshal([]byte(workflowJSON), &wf)
	proposedNodes, _ := wf["nodes"].([]interface{})
	proposedEdges, _ := wf["edges"].([]interface{})
	if proposedNodes != nil {
		nodeCount = len(proposedNodes)
	}
	if proposedEdges != nil {
		edgeCount = len(proposedEdges)
	}
	_ = ctx.sw.WritePendingWorkflow(nodeCount, edgeCount)

	ctx.callbacks.finish(proposePlanStep.PlanStepID, alkaidModels.PlanStepSuccess, "已生成待确认结果", "")
	return nil
}

func buildRepairPatchArtifact(ctx *actPipelineContext, workflowJSON string) ([]map[string]interface{}, *alkaidModels.PendingPatchSummary, bool) {
	if ctx.currentWorkflowForDiff == nil {
		return nil, nil, false
	}

	var workflow map[string]interface{}
	if err := json.Unmarshal([]byte(workflowJSON), &workflow); err != nil {
		return nil, nil, false
	}

	proposedNodes, _ := workflow["nodes"].([]interface{})
	proposedEdges, _ := workflow["edges"].([]interface{})
	if proposedNodes == nil {
		return nil, nil, false
	}

	patch, err := ComputeWorkflowDiff(ctx.currentWorkflowForDiff, proposedNodes, proposedEdges)
	if err != nil || len(patch) == 0 {
		return nil, nil, false
	}

	return patch, SummarizePatchItems(patch), true
}

func proposePatchResult(ctx *actPipelineContext, patch []map[string]interface{}, summary *alkaidModels.PendingPatchSummary) error {
	_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseWaitingApproval)
	proposePlanStep := ensureSyntheticPlanStep(
		ctx.planSteps,
		ctx.userMsg.ID,
		ctx.req.Message,
		"整理待确认结果",
		"将最终补丁整理成可确认的交付结果，等待用户决定是否应用。",
		alkaidModels.PhaseWaitingApproval,
		[]string{"propose_patch"},
	)
	ctx.callbacks.start(proposePlanStep)
	_ = ctx.sw.WriteToolStepStartedWithPlan("step-patch", "propose_patch", alkaidModels.PhaseWaitingApproval, proposePlanStep.PlanStepID)

	patchBytes, _ := json.Marshal(patch)
	patchDraft, _ := BuildPatchDraft(string(patchBytes), "已根据当前画布生成可应用补丁", ctx.workflowID())
	patchPayload, _ := json.Marshal(map[string]interface{}{"draft": patchDraft, "patch": patch})
	_, propSummary, propErr := ctx.executeTool("propose_patch", string(patchPayload))
	if propErr != nil {
		errMsg := propErr.Error()
		_ = ctx.sw.WriteToolStepFinished("step-patch", alkaidModels.ToolStepError, propSummary, errMsg)
		ctx.callbacks.finish(proposePlanStep.PlanStepID, alkaidModels.PlanStepError, propSummary, errMsg)
		return propErr
	}

	_ = ctx.sw.WriteToolStepFinished("step-patch", alkaidModels.ToolStepSuccess, propSummary, "")
	_ = ctx.sw.WritePendingPatch(len(patch), summary)
	ctx.callbacks.finish(proposePlanStep.PlanStepID, alkaidModels.PlanStepSuccess, "已生成待确认补丁", "")
	return nil
}

func (ctx *actPipelineContext) workflowID() uint {
	if ctx == nil || ctx.session == nil || ctx.session.WorkflowID == nil {
		return 0
	}
	return *ctx.session.WorkflowID
}

func interfaceErrorsToStrings(items []interface{}) []string {
	if len(items) == 0 {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		switch v := item.(type) {
		case string:
			out = append(out, v)
		case map[string]interface{}:
			if msg, ok := v["message"].(string); ok && msg != "" {
				out = append(out, msg)
				continue
			}
			out = append(out, fmt.Sprintf("%v", v))
		default:
			out = append(out, fmt.Sprintf("%v", v))
		}
	}
	return out
}
