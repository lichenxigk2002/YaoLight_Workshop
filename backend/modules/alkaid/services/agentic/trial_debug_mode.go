package agentic

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	"yaolight-workshop/backend/modules/alkaid/services/tools"
)

var trialDebugAllowedToolNames = map[string]struct{}{
	"get_workflow":         {},
	"get_node_spec":        {},
	"validate_workflow":    {},
	"run_workflow_trial":   {},
	"get_capabilities":     {},
	"search_knowledge":     {},
	"get_available_models": {},
}

func runTrialDebugMode(
	reqCtx context.Context,
	repo *alkaidRepos.AlkaidRepository,
	sw *SSEWriter,
	req RunStreamRequest,
	turnCtx TurnContext,
) error {
	runtimeDeps := buildAgentRuntimeDeps(repo, req)
	_ = turnCtx

	_ = sw.WritePhaseChanged(alkaidModels.PhaseValidating)

	var validationResult interface{}
	var trialResult interface{}
	var assistantContent string

	if reqCtx.Err() != nil {
		_ = sw.WriteInterrupted()
		return nil
	}

	workflowResult, _, workflowErr := runDeterministicTool(reqCtx, sw, runtimeDeps.Registry, req.SessionID, "get_workflow", "{}", alkaidModels.PhaseValidating)
	if workflowErr != nil {
		assistantContent = "读取当前工作流失败：" + workflowErr.Error()
		_ = sw.WriteError(assistantContent)
		return workflowErr
	}

	workflowMap := workflowMapFromGetWorkflowResult(workflowResult)
	if workflowMap == nil {
		assistantContent = "我没有读取到可试跑的当前工作流。请确认当前画布已保存，或从工作流编辑页重新打开瑶光星。"
		_ = sw.WriteContent(assistantContent)
		report := buildDebugReportFromToolResults(assistantContent, nil, nil)
		report.Success = false
		report.Observations = append(report.Observations, "未读取到 workflow.nodes / workflow.edges")
		_ = sw.WriteDebugReport(report)
		return finishTrialDebugStream(sw)
	}

	validateParams := workflowToolParams(workflowMap, nil)
	validationResult, _, _ = runDeterministicTool(reqCtx, sw, runtimeDeps.Registry, req.SessionID, "validate_workflow", validateParams, alkaidModels.PhaseValidating)
	if reqCtx.Err() != nil {
		_ = sw.WriteInterrupted()
		return nil
	}

	if validationValid(validationResult) {
		_ = sw.WritePhaseChanged(alkaidModels.PhaseRunningTrial)
		trialParams := workflowToolParams(workflowMap, map[string]interface{}{"level": "quick"})
		trialResult, _, _ = runDeterministicTool(reqCtx, sw, runtimeDeps.Registry, req.SessionID, "run_workflow_trial", trialParams, alkaidModels.PhaseRunningTrial)
	}

	report := buildDebugReportFromToolResults("", validationResult, trialResult)
	assistantContent = trialDebugNarrative(report)
	_ = sw.WritePhaseChanged(alkaidModels.PhaseSummarizing)
	streamAssistantText(sw, assistantContent, 12, 18*time.Millisecond)
	_ = sw.WriteDebugReport(report)
	_ = sw.WritePhaseChanged(alkaidModels.PhaseIdle)
	return finishTrialDebugStream(sw)
}

func runDeterministicTool(reqCtx context.Context, sw *SSEWriter, registry *tools.Registry, sessionID uint, toolName string, params string, phase string) (interface{}, string, error) {
	if reqCtx.Err() != nil {
		_ = sw.WriteInterrupted()
		return nil, "", reqCtx.Err()
	}
	stepID := fmt.Sprintf("step-%d-%s", time.Now().UnixNano(), toolName)
	_ = sw.WriteToolStepStarted(stepID, toolName, phase)
	result, resultSummary, toolErr := registry.ExecuteToolForMode(string(TaskTrialDebug), toolName, params, sessionID)
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

func workflowMapFromGetWorkflowResult(result interface{}) map[string]interface{} {
	root := toStringMap(result)
	workflow := toStringMap(root["workflow"])
	if len(workflow) == 0 {
		workflow = root
	}
	if len(workflow) == 0 {
		return nil
	}
	if _, ok := workflow["nodes"]; !ok {
		return nil
	}
	if _, ok := workflow["edges"]; !ok {
		workflow["edges"] = []interface{}{}
	}
	if _, ok := workflow["version"]; !ok {
		workflow["version"] = "1.0.0"
	}
	return workflow
}

func workflowToolParams(workflow map[string]interface{}, extra map[string]interface{}) string {
	payload := map[string]interface{}{"workflow": workflow}
	for key, value := range extra {
		payload[key] = value
	}
	data, _ := json.Marshal(payload)
	return string(data)
}

func validationValid(result interface{}) bool {
	m := toStringMap(result)
	valid, ok := boolFromAny(m["valid"])
	return ok && valid
}

func trialDebugNarrative(report alkaidModels.TrialReport) string {
	if report.Success {
		return "调试完成：当前工作流通过基础校验和快速试跑，暂未发现阻塞性错误。"
	}
	lines := []string{"调试完成：发现当前工作流存在需要处理的问题。"}
	if report.FailedNodeID != "" {
		label := report.FailedNodeLabel
		if label == "" {
			label = report.FailedNodeID
		}
		lines = append(lines, "失败节点："+label)
	}
	if len(report.Observations) > 0 {
		lines = append(lines, "关键原因："+report.Observations[0])
	}
	return strings.Join(lines, "\n")
}

func finishTrialDebugStream(sw *SSEWriter) error {
	_ = sw.WriteDone()
	return nil
}

func buildTrialDebugUserPrompt(message, conversationHistory string) string {
	base := strings.TrimSpace(message)
	if conversationHistory != "" {
		base = strings.TrimSpace(conversationHistory) + "\n\n用户：" + base
	}

	return base + "\n\n你当前处于 workflow trial_debug mode。你的职责是校验或试跑当前工作流，定位失败节点、失败阶段和高概率原因，并输出调试报告。你可以调用 get_workflow、validate_workflow、run_workflow_trial、get_node_spec。不要生成 pending workflow，不要调用 propose_workflow/propose_patch，不要直接修改画布。"
}
