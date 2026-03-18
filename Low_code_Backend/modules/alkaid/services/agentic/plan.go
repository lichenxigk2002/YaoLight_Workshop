package agentic

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"yaolight-workshop/backend/modules/ai/services/providers"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

type planGenerationResponse struct {
	Steps []planGenerationStep `json:"steps"`
}

type planGenerationStep struct {
	Title          string   `json:"title"`
	Reason         string   `json:"reason"`
	ExpectedOutput string   `json:"expectedOutput"`
	ToolHints      []string `json:"toolHints"`
	Phase          string   `json:"phase"`
}

var jsonCodeBlockRe = regexp.MustCompile("(?s)```(?:json)?\\s*(\\{.*?\\}|\\[.*?\\])\\s*```")

func generateAgentPlan(
	ctx context.Context,
	aiProvider providers.AIProvider,
	baseConfig *providers.AIModelConfig,
	systemPrompt string,
	contentForLLM string,
	userMessageID uint,
	userMessageContent string,
) []alkaidModels.AgentPlanStep {
	planResp, err := requestAgentPlan(ctx, aiProvider, baseConfig, systemPrompt, contentForLLM)
	if err != nil || len(planResp.Steps) == 0 {
		return fallbackAgentPlan(userMessageID, userMessageContent)
	}

	steps := make([]alkaidModels.AgentPlanStep, 0, len(planResp.Steps))
	for i, raw := range planResp.Steps {
		title := strings.TrimSpace(raw.Title)
		reason := strings.TrimSpace(raw.Reason)
		if title == "" || reason == "" {
			continue
		}
		phase := strings.TrimSpace(raw.Phase)
		if phase == "" {
			phase = inferPlanPhase(raw.ToolHints, i)
		}
		steps = append(steps, alkaidModels.AgentPlanStep{
			PlanStepID:         fmt.Sprintf("plan-%d-%d", time.Now().UnixNano(), i+1),
			UserMessageID:      userMessageID,
			UserMessageContent: userMessageContent,
			Phase:              phase,
			Source:             alkaidModels.PlanStepSourcePlanned,
			Title:              title,
			Reason:             reason,
			ExpectedOutput:     strings.TrimSpace(raw.ExpectedOutput),
			ToolHints:          normalizeToolHints(raw.ToolHints),
			Status:             alkaidModels.PlanStepPending,
		})
	}
	if len(steps) == 0 {
		return fallbackAgentPlan(userMessageID, userMessageContent)
	}
	return steps
}

func requestAgentPlan(
	ctx context.Context,
	aiProvider providers.AIProvider,
	baseConfig *providers.AIModelConfig,
	systemPrompt string,
	contentForLLM string,
) (*planGenerationResponse, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	planConfig := *baseConfig
	planConfig.Temperature = floatPtr(0.2)
	planConfig.MaxTokens = intPtr(1200)
	planConfig.SystemPrompt = systemPrompt

	prompt := `你是瑶光星的任务规划器。请先根据用户需求输出一个简短执行计划。

要求：
1. 只输出 JSON，不要输出解释文字，不要输出 markdown。
2. JSON 结构必须是：
{
  "steps": [
    {
      "title": "步骤标题",
      "reason": "为什么要做这一步",
      "expectedOutput": "这一步预期得到什么",
      "toolHints": ["search_knowledge", "check_url_accessibility"],
      "phase": "planning"
    }
  ]
}
3. steps 数量控制在 2 到 5 步。
4. 标题要短，reason 要具体。
5. 如果任务涉及外部网站抓取，应优先规划数据源确认步骤。
6. 如果第一次信息可能不足，允许规划同一步骤内继续检索知识库。
7. toolHints 只能从这些工具中选择：search_knowledge, check_url_accessibility, get_capabilities, get_workflow, get_node_spec, list_workflows, get_available_models, get_user_constraints。
8. phase 只能填 planning、generating、validating、waiting_approval。`

	resp, err := aiProvider.Chat(&planConfig, prompt, contentForLLM, map[string]interface{}{"thinking": false})
	if err != nil {
		return nil, err
	}

	jsonText := extractJSONText(resp.Content)
	if strings.TrimSpace(jsonText) == "" {
		return nil, fmt.Errorf("empty plan json")
	}

	var parsed planGenerationResponse
	if err := json.Unmarshal([]byte(jsonText), &parsed); err != nil {
		return nil, err
	}
	return &parsed, nil
}

func extractJSONText(content string) string {
	content = strings.TrimSpace(content)
	if content == "" {
		return ""
	}
	if json.Valid([]byte(content)) {
		return content
	}
	if matches := jsonCodeBlockRe.FindStringSubmatch(content); len(matches) > 1 {
		if json.Valid([]byte(matches[1])) {
			return matches[1]
		}
	}
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end > start {
		candidate := strings.TrimSpace(content[start : end+1])
		if json.Valid([]byte(candidate)) {
			return candidate
		}
	}
	return ""
}

func normalizeToolHints(toolHints []string) []string {
	if len(toolHints) == 0 {
		return nil
	}
	seen := map[string]bool{}
	result := make([]string, 0, len(toolHints))
	for _, hint := range toolHints {
		hint = strings.TrimSpace(hint)
		if hint == "" || seen[hint] {
			continue
		}
		seen[hint] = true
		result = append(result, hint)
	}
	return result
}

func inferPlanPhase(toolHints []string, index int) string {
	for _, hint := range toolHints {
		switch hint {
		case "search_knowledge", "check_url_accessibility", "get_workflow", "list_workflows", "get_user_constraints":
			return alkaidModels.PhasePlanning
		case "get_capabilities", "get_node_spec", "get_available_models":
			return alkaidModels.PhasePlanning
		}
	}
	if index == 0 {
		return alkaidModels.PhasePlanning
	}
	return alkaidModels.PhaseGenerating
}

func fallbackAgentPlan(userMessageID uint, userMessageContent string) []alkaidModels.AgentPlanStep {
	nowID := time.Now().UnixNano()
	return []alkaidModels.AgentPlanStep{
		{
			PlanStepID:         fmt.Sprintf("plan-%d-1", nowID),
			UserMessageID:      userMessageID,
			UserMessageContent: userMessageContent,
			Phase:              alkaidModels.PhasePlanning,
			Source:             alkaidModels.PlanStepSourcePlanned,
			Title:              "梳理任务与补充知识",
			Reason:             "先确认需求、最佳实践与关键约束，避免直接猜测工作流结构。",
			ExpectedOutput:     "得到更可靠的方案输入。",
			ToolHints:          []string{"search_knowledge", "get_capabilities"},
			Status:             alkaidModels.PlanStepPending,
		},
		{
			PlanStepID:         fmt.Sprintf("plan-%d-2", nowID),
			UserMessageID:      userMessageID,
			UserMessageContent: userMessageContent,
			Phase:              alkaidModels.PhaseGenerating,
			Source:             alkaidModels.PlanStepSourcePlanned,
			Title:              "生成工作流方案",
			Reason:             "在确认上下文后生成更完整的工作流结构。",
			ExpectedOutput:     "得到结构化工作流方案。",
			Status:             alkaidModels.PlanStepPending,
		},
	}
}

func selectPlanStepForTool(planSteps []alkaidModels.AgentPlanStep, toolName string) *alkaidModels.AgentPlanStep {
	for i := range planSteps {
		if planSteps[i].Status == alkaidModels.PlanStepSuccess || planSteps[i].Status == alkaidModels.PlanStepError {
			continue
		}
		for _, hint := range planSteps[i].ToolHints {
			if hint == toolName {
				return &planSteps[i]
			}
		}
	}
	return nil
}

func ensureSyntheticPlanStep(
	planSteps *[]alkaidModels.AgentPlanStep,
	userMessageID uint,
	userMessageContent string,
	title string,
	reason string,
	phase string,
	toolHints []string,
) *alkaidModels.AgentPlanStep {
	for i := range *planSteps {
		step := &(*planSteps)[i]
		if step.Title == title && step.Phase == phase && step.Status != alkaidModels.PlanStepSuccess {
			if step.Source == "" {
				step.Source = alkaidModels.PlanStepSourceSynthetic
			}
			return step
		}
	}
	step := alkaidModels.AgentPlanStep{
		PlanStepID:         fmt.Sprintf("plan-%d-%d", time.Now().UnixNano(), len(*planSteps)+1),
		UserMessageID:      userMessageID,
		UserMessageContent: userMessageContent,
		Phase:              phase,
		Source:             alkaidModels.PlanStepSourceSynthetic,
		Title:              title,
		Reason:             reason,
		ToolHints:          toolHints,
		Status:             alkaidModels.PlanStepPending,
	}
	*planSteps = append(*planSteps, step)
	return &(*planSteps)[len(*planSteps)-1]
}

func resolvePlanStepTransition(step alkaidModels.AgentPlanStep, nextStep *alkaidModels.AgentPlanStep) (string, string, string) {
	if step.Status == alkaidModels.PlanStepError {
		return alkaidModels.PlanStepError, step.ResultSummary, step.ErrorMessage
	}
	if step.ResultSummary != "" {
		return alkaidModels.PlanStepSuccess, step.ResultSummary, ""
	}
	if nextStep != nil && nextStep.Phase != "" && nextStep.Phase != step.Phase {
		return alkaidModels.PlanStepSkipped, "执行流程已切换到后续阶段", ""
	}
	if step.Source == alkaidModels.PlanStepSourceSynthetic {
		return alkaidModels.PlanStepSkipped, "当前执行路径未继续停留在该执行步骤", ""
	}
	return alkaidModels.PlanStepSkipped, "已根据新信息调整后续执行步骤", ""
}
