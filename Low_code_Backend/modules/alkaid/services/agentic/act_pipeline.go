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
	workflowJSON, finalized, err := extractWorkflowJSONWithFallback(ctx)
	if err != nil || finalized {
		return finalized, err
	}
	if workflowJSON == "" {
		return false, nil
	}

	workflowJSON, _, validationErrors, finalized, err := validateWorkflowAndURLs(ctx, workflowJSON)
	if err != nil || finalized {
		return finalized, err
	}

	workflowJSON, finalized, err = runWorkflowTrialAndRepair(ctx, workflowJSON, validationErrors)
	if err != nil || finalized {
		return finalized, err
	}

	if err := proposeWorkflowResult(ctx, workflowJSON); err != nil {
		return true, err
	}
	return false, nil
}

func extractWorkflowJSONWithFallback(ctx *actPipelineContext) (string, bool, error) {
	workflowJSON := extractWorkflowJSON(ctx.assistantContent)
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
	return workflowJSON, false, nil
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
	valResult, valSummary, valErr := ctx.registry.ExecuteTool("validate_workflow", params, ctx.req.SessionID)

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

		failures := make([]string, 0)
		okCount := 0
		for i, rawURL := range urlCandidates {
			urlStepID := fmt.Sprintf("step-url-check-%d", i+1)
			_ = ctx.sw.WriteToolStepStartedWithPlan(urlStepID, "check_url_accessibility", alkaidModels.PhaseValidating, urlPlanStep.PlanStepID)
			result, resultSummary, toolErr := ctx.registry.ExecuteTool("check_url_accessibility", fmt.Sprintf(`{"url":%q}`, rawURL), ctx.req.SessionID)
			status := alkaidModels.ToolStepSuccess
			errMsg := ""
			if toolErr != nil {
				status = alkaidModels.ToolStepError
				errMsg = toolErr.Error()
				resultSummary = errMsg
			}
			_ = ctx.sw.WriteToolStepFinished(urlStepID, status, resultSummary, errMsg)

			if toolErr != nil {
				failures = append(failures, fmt.Sprintf("%s (%s)", rawURL, errMsg))
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
			failures = append(failures, fmt.Sprintf("%s (%s)", rawURL, reason))
		}

		urlValidationSummary := fmt.Sprintf("已校验 %d 个候选 URL，其中 %d 个可直接抓取", len(urlCandidates), okCount)
		if len(failures) > 0 {
			errMsg := "以下候选 URL 当前不适合作为 crawler 数据源: " + strings.Join(failures, "; ")
			ctx.callbacks.update(urlPlanStep.PlanStepID, func(step *alkaidModels.AgentPlanStep) {
				step.ResultSummary = urlValidationSummary
				step.ErrorMessage = errMsg
			})
			ctx.callbacks.finish(urlPlanStep.PlanStepID, alkaidModels.PlanStepError, urlValidationSummary, errMsg)
			_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
			_ = ctx.sw.WriteError(errMsg)
			_ = ctx.sw.WriteDone()
			return "", nil, nil, true, nil
		}

		ctx.callbacks.update(urlPlanStep.PlanStepID, func(step *alkaidModels.AgentPlanStep) {
			step.ResultSummary = urlValidationSummary
		})
		ctx.callbacks.finish(urlPlanStep.PlanStepID, alkaidModels.PlanStepSuccess, urlValidationSummary, "")
	}

	return workflowJSON, workflowMap, validationErrors, false, nil
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
		"试跑工作流",
		"在正式交付前做一次快速试跑，尽早发现不可执行问题。",
		alkaidModels.PhaseRunningTrial,
		[]string{"run_workflow_trial"},
	)
	ctx.callbacks.start(trialPlanStep)
	_ = ctx.sw.WriteToolStepStartedWithPlan("step-trial", "run_workflow_trial", alkaidModels.PhaseRunningTrial, trialPlanStep.PlanStepID)
	params := fmt.Sprintf(`{"workflow":%s}`, workflowJSON)
	trialResult, trialSummary, trialErr := ctx.registry.ExecuteTool("run_workflow_trial", params, ctx.req.SessionID)

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
	_ = ctx.sw.WriteContent("\n\n⚠️ 工作流试跑失败，正在尝试自动修复...\n")

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
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("自动修复失败，请手动调整工作流")
		_ = ctx.sw.WriteDone()
		return workflowJSON, true, nil
	}

	_ = ctx.sw.WriteContent("\n修复建议：\n" + repairResp.Content)
	repairedWorkflowJSON := extractWorkflowJSON(repairResp.Content)
	if repairedWorkflowJSON == "" {
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("无法从修复建议中提取有效工作流")
		_ = ctx.sw.WriteDone()
		return workflowJSON, true, nil
	}

	var repairedMap map[string]interface{}
	if err := json.Unmarshal([]byte(repairedWorkflowJSON), &repairedMap); err != nil {
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
	valResult2, valSummary2, valErr2 := ctx.registry.ExecuteTool("validate_workflow", fmt.Sprintf(`{"workflow":%s}`, repairedWorkflowJSON), ctx.req.SessionID)

	var validRepair bool
	if m, ok := valResult2.(map[string]interface{}); ok {
		validRepair, _ = m["valid"].(bool)
	}
	if valErr2 != nil || !validRepair {
		_ = ctx.sw.WriteToolStepFinished("step-validate-repair", alkaidModels.ToolStepError, valSummary2, "修复后仍存在问题")
		_ = ctx.sw.WritePhaseChanged(alkaidModels.PhaseError)
		_ = ctx.sw.WriteError("自动修复未能完全解决问题，建议手动调整")
		_ = ctx.sw.WriteDone()
		return workflowJSON, true, nil
	}
	_ = ctx.sw.WriteToolStepFinished("step-validate-repair", alkaidModels.ToolStepSuccess, valSummary2, "")
	ctx.callbacks.finish(repairValidatePlanStep.PlanStepID, alkaidModels.PlanStepSuccess, valSummary2, "")
	_ = ctx.sw.WriteContent("\n✓ 工作流已自动修复并通过校验\n")
	return repairedWorkflowJSON, false, nil
}

func proposeWorkflowResult(ctx *actPipelineContext, workflowJSON string) error {
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
	_, propSummary, _ := ctx.registry.ExecuteTool("propose_workflow", fmt.Sprintf(`{"workflow":%s}`, workflowJSON), ctx.req.SessionID)
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

	if proposedNodes != nil && ctx.currentWorkflowForDiff != nil {
		patch, patchErr := ComputeWorkflowDiff(ctx.currentWorkflowForDiff, proposedNodes, proposedEdges)
		if patchErr == nil && len(patch) > 0 {
			patchJSON, _ := json.Marshal(map[string]interface{}{"patch": patch})
			_ = ctx.sw.WriteToolStepStartedWithPlan("step-patch", "propose_patch", alkaidModels.PhaseWaitingApproval, proposePlanStep.PlanStepID)
			_, _, _ = ctx.registry.ExecuteTool("propose_patch", string(patchJSON), ctx.req.SessionID)
			_ = ctx.sw.WriteToolStepFinished("step-patch", alkaidModels.ToolStepSuccess, fmt.Sprintf("已生成 %d 项补丁", len(patch)), "")
			_ = ctx.sw.WritePendingPatch(len(patch))
		}
	}
	ctx.callbacks.finish(proposePlanStep.PlanStepID, alkaidModels.PlanStepSuccess, "已生成待确认结果", "")
	return nil
}
