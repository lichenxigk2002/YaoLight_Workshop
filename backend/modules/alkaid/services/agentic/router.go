package agentic

import (
	"strings"

	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

type RouteDecision struct {
	TaskMode       TaskMode
	Mode           RouteMode
	AllowMutating  bool
	NeedWorkflow   bool
	NeedTools      bool
	NeedValidation bool
	NeedTrial      bool
	NeedApproval   bool
	ShowProgress   bool
	Reason         string
}

func DecideRoute(turnCtx TurnContext) RouteDecision {
	message := strings.TrimSpace(turnCtx.Request.Message)
	if message == "" {
		return newRouteDecision(TaskChat, "empty_message")
	}

	analyzer := alkaidServices.NewIntentAnalyzer()
	intent, err := analyzer.AnalyzeTaskIntent(message, turnCtx.ConversationHistory)
	if err == nil && intent != nil && intent.SuggestedMode != "" {
		suggestedMode := TaskMode(intent.SuggestedMode)
		decision := newRouteDecision(suggestedMode, "intent_analyzer:"+intent.Reason)
		switch suggestedMode {
		case TaskChat:
			return decision
		case TaskExplain:
			decision.NeedWorkflow = true
			decision.NeedTools = true
		case TaskTrialDebug:
			decision.NeedWorkflow = true
			decision.NeedTools = true
			decision.NeedValidation = true
			decision.NeedTrial = true
			decision.ShowProgress = true
		case TaskGenerate:
			decision.AllowMutating = true
			decision.NeedTools = true
			decision.NeedValidation = true
			decision.NeedTrial = true
			decision.NeedApproval = true
			decision.ShowProgress = true
		case TaskRepair:
			decision.AllowMutating = true
			decision.NeedWorkflow = true
			decision.NeedTools = true
			decision.NeedValidation = true
			decision.NeedTrial = true
			decision.NeedApproval = true
			decision.ShowProgress = true
		}
		return decision
	}

	fallback := fallbackRouteDecision(strings.ToLower(message))
	if fallback.Reason == "" {
		fallback.Reason = "fallback_chat"
	}
	return fallback
}

func fallbackRouteDecision(normalized string) RouteDecision {
	if isExplicitTrialDebugRequest(normalized) {
		decision := newRouteDecision(TaskTrialDebug, "fallback_rule_trial_debug")
		decision.NeedWorkflow = true
		decision.NeedTools = true
		decision.NeedValidation = true
		decision.NeedTrial = true
		decision.ShowProgress = true
		return decision
	}

	if isExplicitRepairRequest(normalized) {
		decision := newRouteDecision(TaskRepair, "fallback_rule_repair")
		decision.AllowMutating = true
		decision.NeedWorkflow = true
		decision.NeedTools = true
		decision.NeedValidation = true
		decision.NeedTrial = true
		decision.NeedApproval = true
		decision.ShowProgress = true
		return decision
	}

	if isExplicitGenerateRequest(normalized) {
		decision := newRouteDecision(TaskGenerate, "fallback_rule_generate")
		decision.AllowMutating = true
		decision.NeedTools = true
		decision.NeedValidation = true
		decision.NeedTrial = true
		decision.NeedApproval = true
		decision.ShowProgress = true
		return decision
	}

	if isExplicitExplainRequest(normalized) {
		decision := newRouteDecision(TaskExplain, "fallback_rule_explain")
		decision.NeedWorkflow = true
		decision.NeedTools = true
		return decision
	}

	return newRouteDecision(TaskChat, "fallback_rule_chat")
}

func newRouteDecision(taskMode TaskMode, reason string) RouteDecision {
	return RouteDecision{
		TaskMode: taskMode,
		Mode:     legacyRouteMode(taskMode),
		Reason:   reason,
	}
}

func legacyRouteMode(taskMode TaskMode) RouteMode {
	switch taskMode {
	case TaskExplain:
		return RouteAnalyze
	case TaskGenerate, TaskRepair, TaskTrialDebug:
		return RouteAct
	default:
		return RouteChat
	}
}

func isExplicitGenerateRequest(normalized string) bool {
	explicitGeneratePhrases := []string{
		"生成工作流", "创建工作流", "新建工作流", "做一个工作流", "帮我生成", "帮我创建",
		"build a workflow", "create a workflow", "generate workflow",
	}
	if routeContainsAny(normalized, explicitGeneratePhrases) {
		return true
	}

	workflowObjects := []string{"工作流", "workflow", "画布", "节点", "连线", "流程图", "node", "edge", "canvas"}
	generateActions := []string{"生成", "创建", "新建", "搭", "制作", "generate", "create", "build"}
	return routeContainsAny(normalized, workflowObjects) && routeContainsAny(normalized, generateActions)
}

func isExplicitRepairRequest(normalized string) bool {
	explicitRepairPhrases := []string{
		"修改工作流", "优化工作流", "修复工作流", "调整工作流", "新增节点", "删除节点",
		"调整节点", "调整连线", "应用补丁", "modify workflow", "optimize workflow", "fix workflow", "patch workflow",
	}
	if routeContainsAny(normalized, explicitRepairPhrases) {
		return true
	}

	workflowObjects := []string{"工作流", "workflow", "画布", "节点", "连线", "流程图", "node", "edge", "canvas"}
	repairActions := []string{"修改", "优化", "修复", "补全", "调整", "新增", "删除", "替换", "合并", "拆分", "应用", "modify", "optimize", "fix", "repair", "patch", "apply"}
	return routeContainsAny(normalized, workflowObjects) && routeContainsAny(normalized, repairActions)
}

func isExplicitTrialDebugRequest(normalized string) bool {
	explicitTrialPhrases := []string{
		"运行工作流", "试跑工作流", "校验工作流", "验证工作流", "跑一下", "试一下", "试跑一下",
		"看看哪里报错", "哪里报错", "定位失败", "定位错误", "debug workflow", "run workflow", "validate workflow",
	}
	if routeContainsAny(normalized, explicitTrialPhrases) {
		return true
	}

	workflowObjects := []string{"工作流", "workflow", "画布", "节点", "流程", "node", "canvas"}
	trialActions := []string{"运行", "试跑", "校验", "验证", "报错", "失败", "debug", "run", "validate", "trial"}
	return routeContainsAny(normalized, workflowObjects) && routeContainsAny(normalized, trialActions)
}

func isExplicitExplainRequest(normalized string) bool {
	explicitAnalyzePhrases := []string{
		"解释当前工作流", "解释这条工作流", "说明当前工作流", "帮我看看现在的流程", "分析当前工作流",
		"查看工作流", "查看节点", "看看工作流", "分析流程图", "看看当前画布", "当前工作流", "当前画布",
		"current workflow", "current canvas", "analyze workflow", "inspect workflow", "review workflow", "explain workflow",
	}
	if routeContainsAny(normalized, explicitAnalyzePhrases) {
		return true
	}

	workflowObjects := []string{"工作流", "workflow", "画布", "节点", "连线", "流程图", "node", "edge", "canvas"}
	workflowAnalyzeActions := []string{
		"分析", "查看", "看看", "看下", "解释", "梳理", "review", "inspect", "analyze", "explain",
	}
	return routeContainsAny(normalized, workflowObjects) && routeContainsAny(normalized, workflowAnalyzeActions)
}

func isPlainChatRequest(normalized string) bool {
	plainChatPhrases := []string{
		"你好", "您好", "在吗", "谢谢", "多谢", "hello", "hi", "hey",
		"怎么用", "如何使用", "是什么", "什么意思", "介绍一下", "讲一个", "能做什么", "文档",
		"api", "价格", "费用", "教程", "示例", "例子", "区别",
	}
	return routeContainsAny(normalized, plainChatPhrases)
}

func routeContainsAny(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}
