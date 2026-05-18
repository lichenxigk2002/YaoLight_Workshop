package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

// IntentAnalyzer 意图分析器
// 第一阶段AI：分析用户内容，判断是否需要生成工作流
type IntentAnalyzer struct {
	aiProvider providers.AIProvider
}

type IntentDecision struct {
	SuggestedMode string  `json:"suggestedMode"`
	Confidence    float64 `json:"confidence"`
	Reason        string  `json:"reason"`
}

// NewIntentAnalyzer 创建意图分析器
func NewIntentAnalyzer() *IntentAnalyzer {
	return &IntentAnalyzer{
		aiProvider: mustDefaultAlkaidAIProvider(),
	}
}

// AnalyzeIntent 分析用户意图
// 返回是否需要生成工作流（只返回布尔值，不存储）
func (a *IntentAnalyzer) AnalyzeIntent(userMessage string, conversationHistory string) (bool, error) {
	// 构建分析Prompt
	systemPrompt := a.buildAnalysisPrompt()

	// 构建用户消息
	var userPrompt string
	if conversationHistory != "" {
		userPrompt = fmt.Sprintf("%s\n\n用户最新消息：%s", conversationHistory, userMessage)
	} else {
		userPrompt = userMessage
	}

	// 构建AI配置
	apiKey := strings.TrimSpace(config.DeepSeekAPIKey)
	modelName := strings.TrimSpace(config.DeepSeekChatModel)
	if modelName == "" {
		modelName = "deepseek-v4-pro"
	}
	aiConfig := &providers.AIModelConfig{
		Provider:     "deepseek",
		ModelName:    modelName,
		APIKey:       apiKey,
		BaseURL:      "https://api.deepseek.com",
		Temperature:  floatPtr(0.3), // 使用较低温度以获得更稳定的判断
		MaxTokens:    intPtr(10),    // 只需要返回 true/false，10个token足够
		SystemPrompt: systemPrompt,
	}

	// 调用AI进行分析
	response, err := a.aiProvider.Chat(aiConfig, userPrompt, "", nil)
	if err != nil {
		return false, fmt.Errorf("AI分析失败: %w", err)
	}

	// 解析AI返回的布尔值
	needsWorkflow, err := a.parseBooleanResult(response.Content)
	if err != nil {
		// 如果解析失败，使用备用分析逻辑
		needsWorkflow = a.fallbackAnalysis(response.Content, userMessage)
	}

	return needsWorkflow, nil
}

func (a *IntentAnalyzer) AnalyzeTaskIntent(userMessage string, conversationHistory string) (*IntentDecision, error) {
	message := strings.ToLower(strings.TrimSpace(userMessage))
	if message == "" {
		return &IntentDecision{SuggestedMode: "chat", Confidence: 1, Reason: "empty_message"}, nil
	}

	decision, err := a.analyzeTaskIntentWithAI(userMessage, conversationHistory)
	if err == nil && decision != nil && isValidTaskMode(decision.SuggestedMode) {
		if decision.Confidence <= 0 {
			decision.Confidence = 0.7
		}
		if strings.TrimSpace(decision.Reason) == "" {
			decision.Reason = "ai_task_mode_classifier"
		}
		return decision, nil
	}

	needsWorkflow, err := a.AnalyzeIntent(userMessage, conversationHistory)
	if err != nil {
		return fallbackTaskIntentDecision(message, err), err
	}
	if needsWorkflow {
		return &IntentDecision{SuggestedMode: "generate", Confidence: 0.65, Reason: "legacy_workflow_intent"}, nil
	}
	return &IntentDecision{SuggestedMode: "chat", Confidence: 0.7, Reason: "legacy_chat_intent"}, nil
}

func (a *IntentAnalyzer) analyzeTaskIntentWithAI(userMessage string, conversationHistory string) (*IntentDecision, error) {
	systemPrompt := a.buildTaskModePrompt()

	userPrompt := strings.TrimSpace(userMessage)
	if conversationHistory != "" {
		userPrompt = fmt.Sprintf("历史对话：\n%s\n\n用户最新消息：%s", conversationHistory, userMessage)
	}

	apiKey := strings.TrimSpace(config.DeepSeekAPIKey)
	modelName := strings.TrimSpace(config.DeepSeekChatModel)
	if modelName == "" {
		modelName = "deepseek-v4-pro"
	}
	aiConfig := &providers.AIModelConfig{
		Provider:     "deepseek",
		ModelName:    modelName,
		APIKey:       apiKey,
		BaseURL:      "https://api.deepseek.com",
		Temperature:  floatPtr(0.1),
		MaxTokens:    intPtr(220),
		SystemPrompt: systemPrompt,
	}

	response, err := a.aiProvider.Chat(aiConfig, userPrompt, "", nil)
	if err != nil {
		return nil, fmt.Errorf("AI任务模式分析失败: %w", err)
	}

	return parseIntentDecision(response.Content)
}

func (a *IntentAnalyzer) buildTaskModePrompt() string {
	return `你是 YaoLight 平台里的任务模式路由器。你的唯一任务是判断“用户这次消息最适合进入哪一种模式”。

可选模式只有 5 个：
- chat：普通问答、咨询、澄清、解释概念，不要求查看/修改当前工作流
- explain：解释当前工作流结构、节点作用、变量流转、风险
- generate：用户要你直接生成一条新的、可用的工作流
- repair：用户要你修改、优化、修复当前工作流，目标是交付可应用补丁或替代流程
- trial_debug：用户要你试跑、定位报错、分析失败原因

判断规则：
1. 如果用户核心目标是“直接给我工作流/直接生成可用流程”，优先 generate，不要判成 chat。
2. 如果用户在已有画布上下文里要求“修、改、优化、补丁、直接可用”，优先 repair。
3. 如果用户只是问“这条流程什么意思/怎么看/为什么这样”，优先 explain。
4. 如果用户要“试跑、找报错、定位失败原因”，优先 trial_debug。
5. 只有在明显只是闲聊、咨询或概念问答时，才判 chat。
6. 你必须选择一个最主要模式，不允许返回多个模式。

输出要求：
只输出 JSON，不要输出解释文字，不要 markdown。
格式：
{
  "suggestedMode": "chat|explain|generate|repair|trial_debug",
  "confidence": 0.0,
  "reason": "一句简短中文理由"
}`
}

func parseIntentDecision(content string) (*IntentDecision, error) {
	cleaned := strings.TrimSpace(content)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	start := strings.Index(cleaned, "{")
	end := strings.LastIndex(cleaned, "}")
	if start >= 0 && end > start {
		cleaned = cleaned[start : end+1]
	}

	var decision IntentDecision
	if err := json.Unmarshal([]byte(cleaned), &decision); err != nil {
		return nil, fmt.Errorf("解析任务模式 JSON 失败: %w", err)
	}
	if !isValidTaskMode(decision.SuggestedMode) {
		return nil, fmt.Errorf("无效任务模式: %s", decision.SuggestedMode)
	}
	return &decision, nil
}

func fallbackTaskIntentDecision(message string, err error) *IntentDecision {
	if containsAny(message, []string{"运行工作流", "试跑工作流", "校验工作流", "验证工作流", "跑一下", "试一下", "哪里报错", "定位失败", "debug workflow", "run workflow", "validate workflow"}) {
		return &IntentDecision{SuggestedMode: "trial_debug", Confidence: 0.8, Reason: "fallback_rule_trial_debug"}
	}
	if containsAny(message, []string{"修改工作流", "优化工作流", "修复工作流", "调整工作流", "新增节点", "删除节点", "修改", "优化", "修复", "补丁", "modify workflow", "fix workflow", "patch workflow"}) &&
		containsAny(message, []string{"工作流", "workflow", "画布", "节点", "连线", "canvas", "node", "edge"}) {
		return &IntentDecision{SuggestedMode: "repair", Confidence: 0.8, Reason: "fallback_rule_repair"}
	}
	if containsAny(message, []string{"生成工作流", "创建工作流", "新建工作流", "做一个工作流", "帮我生成", "帮我创建", "build a workflow", "create a workflow", "generate workflow"}) {
		return &IntentDecision{SuggestedMode: "generate", Confidence: 0.8, Reason: "fallback_rule_generate"}
	}
	if containsAny(message, []string{"解释当前工作流", "解释这条工作流", "分析当前工作流", "查看工作流", "看看当前画布", "current workflow", "explain workflow", "inspect workflow"}) {
		return &IntentDecision{SuggestedMode: "explain", Confidence: 0.75, Reason: "fallback_rule_explain"}
	}
	_ = err
	return &IntentDecision{SuggestedMode: "chat", Confidence: 0.5, Reason: "fallback_chat_after_error"}
}

func isValidTaskMode(mode string) bool {
	switch strings.TrimSpace(mode) {
	case "chat", "explain", "generate", "repair", "trial_debug":
		return true
	default:
		return false
	}
}

// buildAnalysisPrompt 构建分析Prompt
func (a *IntentAnalyzer) buildAnalysisPrompt() string {
	return `你是一个意图分析助手。你的任务是分析用户消息，判断用户是否需要生成工作流。

## 分析规则

1. **需要生成工作流的情况**：
   - 用户明确要求生成、创建、制作工作流
   - 用户描述了一个需要自动化处理的任务流程
   - 用户提到了工作流相关的关键词：抓取、爬虫、数据清洗、AI处理、自动化等
   - 用户想要实现一个多步骤的数据处理流程

2. **不需要生成工作流的情况**：
   - 用户只是在提问、咨询、聊天
   - 用户询问如何使用功能
   - 用户想要修改已有工作流（但需要先分析需求）
   - 用户只是打招呼或闲聊

3. **输出格式**：
你只需要输出一个布尔值：true 或 false
- true：需要生成工作流
- false：不需要生成工作流

## 示例

用户："帮我生成一个抓取网页并总结的工作流"
输出：true

用户："你好"
输出：false

用户："工作流编辑器怎么用？"
输出：false

用户："创建一个自动化流程来抓取数据"
输出：true

现在请分析用户消息，只输出 true 或 false。`
}

// parseBooleanResult 解析AI返回的布尔值
func (a *IntentAnalyzer) parseBooleanResult(content string) (bool, error) {
	// 清理内容，移除可能的代码块标记
	content = strings.TrimSpace(content)

	// 移除代码块标记
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimPrefix(content, "json")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	// 尝试直接解析布尔值
	if strings.EqualFold(content, "true") {
		return true, nil
	}
	if strings.EqualFold(content, "false") {
		return false, nil
	}

	// 尝试从JSON中提取
	jsonBlockRegex := regexp.MustCompile("```json\\s*([\\s\\S]*?)```")
	jsonMatch := jsonBlockRegex.FindStringSubmatch(content)
	if jsonMatch != nil && len(jsonMatch) > 1 {
		content = jsonMatch[1]
	}

	// 尝试解析JSON对象（兼容旧格式）
	jsonObjectRegex := regexp.MustCompile(`\{[\s\S]*"needsWorkflow"\s*:\s*(true|false)[\s\S]*\}`)
	objectMatch := jsonObjectRegex.FindStringSubmatch(content)
	if objectMatch != nil && len(objectMatch) > 1 {
		if strings.EqualFold(objectMatch[1], "true") {
			return true, nil
		}
		return false, nil
	}

	return false, fmt.Errorf("无法解析布尔值: %s", content)
}

// fallbackAnalysis 备用分析逻辑（如果AI返回的不是布尔值）
func (a *IntentAnalyzer) fallbackAnalysis(aiResponse string, userMessage string) bool {
	// 简单的关键词匹配
	userMessageLower := strings.ToLower(userMessage)

	// 工作流相关关键词
	workflowKeywords := []string{
		"生成", "创建", "制作", "工作流", "workflow",
		"抓取", "爬虫", "crawler",
		"数据清洗", "dataclean",
		"自动化", "流程",
	}

	for _, keyword := range workflowKeywords {
		if strings.Contains(userMessageLower, keyword) {
			return true
		}
	}

	// 如果AI响应中明确提到需要生成工作流
	aiResponseLower := strings.ToLower(aiResponse)
	if strings.Contains(aiResponseLower, "true") ||
		strings.Contains(aiResponseLower, "需要生成") ||
		strings.Contains(aiResponseLower, "生成工作流") {
		return true
	}

	// 默认返回false（保守策略：如果不是明确需要，就不生成）
	return false
}

func containsAny(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}
