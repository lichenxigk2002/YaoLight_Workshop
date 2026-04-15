package agentic

import (
	"strings"

	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

type RouteDecision struct {
	Mode         RouteMode
	NeedWorkflow bool
	NeedTools    bool
	NeedApproval bool
	ShowProgress bool
	Reason       string
}

func DecideRoute(turnCtx TurnContext) RouteDecision {
	message := strings.TrimSpace(turnCtx.Request.Message)
	normalized := strings.ToLower(message)
	if normalized == "" {
		return RouteDecision{Mode: RouteChat, Reason: "empty_message"}
	}

	if isExplicitActRequest(normalized) {
		return RouteDecision{
			Mode:         RouteAct,
			NeedWorkflow: true,
			NeedTools:    true,
			NeedApproval: true,
			ShowProgress: true,
			Reason:       "explicit_workflow_action",
		}
	}

	if isExplicitAnalyzeRequest(normalized) {
		return RouteDecision{
			Mode:         RouteAnalyze,
			NeedWorkflow: true,
			NeedTools:    true,
			ShowProgress: false,
			Reason:       "explicit_workflow_analysis",
		}
	}

	if isPlainChatRequest(normalized) {
		return RouteDecision{Mode: RouteChat, Reason: "plain_chat"}
	}

	analyzer := alkaidServices.NewIntentAnalyzer()
	needsWorkflow, err := analyzer.AnalyzeIntent(message, turnCtx.ConversationHistory)
	if err == nil && needsWorkflow {
		return RouteDecision{
			Mode:         RouteAnalyze,
			NeedWorkflow: true,
			NeedTools:    true,
			ShowProgress: false,
			Reason:       "intent_analyzer_requires_workflow",
		}
	}

	return RouteDecision{Mode: RouteChat, Reason: "default_chat"}
}

func isExplicitActRequest(normalized string) bool {
	explicitActPhrases := []string{
		"生成工作流", "创建工作流", "新建工作流", "做一个工作流", "帮我生成", "帮我创建",
		"修改工作流", "优化工作流", "修复工作流", "调整工作流", "新增节点", "删除节点",
		"调整节点", "调整连线", "应用补丁", "运行工作流", "试跑工作流", "校验工作流",
		"build a workflow", "create a workflow", "generate workflow",
		"modify workflow", "optimize workflow", "fix workflow", "patch workflow",
		"run workflow", "validate workflow",
	}
	if routeContainsAny(normalized, explicitActPhrases) {
		return true
	}

	workflowObjects := []string{"工作流", "workflow", "画布", "节点", "连线", "流程图", "node", "edge", "canvas"}
	workflowActActions := []string{
		"修改", "优化", "修复", "补全", "调整", "新增", "删除", "替换", "运行", "试跑", "校验", "验证", "合并", "拆分", "应用",
		"modify", "optimize", "fix", "repair", "run", "validate", "patch", "apply",
	}
	return routeContainsAny(normalized, workflowObjects) && routeContainsAny(normalized, workflowActActions)
}

func isExplicitAnalyzeRequest(normalized string) bool {
	explicitAnalyzePhrases := []string{
		"当前工作流", "当前画布", "这个工作流", "这条工作流", "帮我看看现在的流程", "分析当前工作流",
		"查看工作流", "检查工作流", "查看节点", "看看工作流", "分析流程图", "看看当前画布",
		"current workflow", "current canvas", "analyze workflow", "inspect workflow", "check workflow", "review workflow",
	}
	if routeContainsAny(normalized, explicitAnalyzePhrases) {
		return true
	}

	workflowObjects := []string{"工作流", "workflow", "画布", "节点", "连线", "流程图", "node", "edge", "canvas"}
	workflowAnalyzeActions := []string{
		"分析", "查看", "看看", "看下", "检查", "排查", "解释", "梳理", "review", "inspect", "analyze", "check", "explain",
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
