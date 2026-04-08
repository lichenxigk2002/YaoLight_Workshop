package services

import (
	"fmt"
	"regexp"
	"strings"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/services/providers/deepseek"
)

// IntentAnalyzer 意图分析器
// 第一阶段AI：分析用户内容，判断是否需要生成工作流
type IntentAnalyzer struct {
	aiProvider providers.AIProvider
}

// NewIntentAnalyzer 创建意图分析器
func NewIntentAnalyzer() *IntentAnalyzer {
	return &IntentAnalyzer{
		aiProvider: deepseek.NewDeepSeekProvider(),
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
	aiConfig := &providers.AIModelConfig{
		Provider:     "deepseek",
		ModelName:    "deepseek-chat",
		APIKey:       config.DeepSeekAPIKey,
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
