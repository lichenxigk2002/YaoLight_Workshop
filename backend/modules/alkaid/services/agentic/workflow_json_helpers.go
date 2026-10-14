package agentic

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"

	"yaolight-workshop/backend/modules/ai/services/providers"
)

var workflowJSONBlockRe = regexp.MustCompile("(?s)```(?:json)?\\s*({[\\s\\S]*?})\\s*```")
var workflowJSONObjectRe = regexp.MustCompile("(?s)(\\{\\s*\"(?:version|nodes|edges)\"[^}]*(?:\\{[^{}]*\\}|[^{}])*\\})")

func extractWorkflowJSON(content string) string {
	if matches := workflowJSONBlockRe.FindStringSubmatch(content); len(matches) > 1 {
		jsonStr := strings.TrimSpace(matches[1])
		if isValidWorkflowJSON(jsonStr) {
			return jsonStr
		}
	}

	jsonStr := extractCompleteJSON(content)
	if jsonStr != "" && isValidWorkflowJSON(jsonStr) {
		return jsonStr
	}

	return ""
}

func shouldAttemptWorkflowFallback(userMessage, assistantContent string) bool {
	if strings.TrimSpace(assistantContent) == "" {
		return false
	}

	lowerUser := strings.ToLower(userMessage)
	lowerAssistant := strings.ToLower(assistantContent)

	intentMarkers := []string{"工作流", "workflow", "节点", "node", "画布", "流程图"}
	hasWorkflowIntent := false
	for _, marker := range intentMarkers {
		if strings.Contains(lowerUser, marker) {
			hasWorkflowIntent = true
			break
		}
	}

	structureMarkers := []string{
		"<!-- workflow-json -->",
		"```json",
		"\"nodes\"",
		"\"edges\"",
		"\"type\": \"start\"",
		"\"type\":\"start\"",
		"\"type\": \"crawler\"",
		"\"type\":\"crawler\"",
	}
	for _, marker := range structureMarkers {
		if strings.Contains(lowerAssistant, marker) {
			return true
		}
	}

	return hasWorkflowIntent && len([]rune(assistantContent)) >= 1800
}

func buildWorkflowFallbackConfig(base *providers.AIModelConfig) *providers.AIModelConfig {
	if base == nil {
		return nil
	}

	cfg := *base
	temperature := 0.2
	maxTokens := 8192
	cfg.Temperature = &temperature
	cfg.MaxTokens = &maxTokens
	return &cfg
}

func generateWorkflowJSONFallback(
	ctx context.Context,
	aiProvider providers.AIProvider,
	streamer toolStreamingProvider,
	canStreamWithTools bool,
	config *providers.AIModelConfig,
	systemPrompt string,
	baseMessages []providers.ChatMessage,
	assistantContent string,
) (string, error) {
	fallbackMessages := append([]providers.ChatMessage{}, baseMessages...)
	if strings.TrimSpace(assistantContent) != "" {
		fallbackMessages = append(fallbackMessages, providers.ChatMessage{
			Role:    "assistant",
			Content: assistantContent,
		})
	}

	fallbackMessages = append(fallbackMessages, providers.ChatMessage{
		Role: "user",
		Content: "你上一条回复过长，结构化工作流没有完整输出。请基于已有需求、工具结果和你刚才的方案，重新输出一个完整的工作流 JSON。\n" +
			"要求：\n" +
			"1. 只输出 JSON 对象，不要 Markdown、代码块、解释、标题或前后缀。\n" +
			"2. 必须包含 version、name、description、nodes、edges。\n" +
			"3. 在保持逻辑完整的前提下，压缩 label、description、prompt 等长文本，优先缩短文字，不要删掉关键结构。\n" +
			"4. 节点配置必须兼容当前工作流规范，不要输出省略号或不完整字段。\n" +
			"5. 如果内容仍然偏长，优先保留关键节点、关键连线和可运行配置，保证 JSON 完整可解析。",
	})

	if canStreamWithTools && streamer != nil {
		var streamed strings.Builder
		resp, err := streamer.ChatWithToolsStream(ctx, config, systemPrompt, fallbackMessages, nil, map[string]interface{}{"thinking": false}, func(content string, done bool, err error, usage *providers.TokenUsage) {
			if err != nil || content == "" {
				return
			}
			streamed.WriteString(content)
		})
		if err != nil {
			return "", err
		}
		if streamed.Len() > 0 {
			return strings.TrimSpace(streamed.String()), nil
		}
		if resp != nil {
			return strings.TrimSpace(resp.Content), nil
		}
		return "", nil
	}

	resp, err := aiProvider.ChatWithTools(ctx, config, systemPrompt, fallbackMessages, nil, map[string]interface{}{"thinking": false})
	if err != nil {
		return "", err
	}
	if resp == nil {
		return "", nil
	}
	return strings.TrimSpace(resp.Content), nil
}

func forceWorkflowDelivery(
	ctx context.Context,
	aiProvider providers.AIProvider,
	streamer toolStreamingProvider,
	canStreamWithTools bool,
	config *providers.AIModelConfig,
	systemPrompt string,
	baseMessages []providers.ChatMessage,
	assistantContent string,
	taskMode TaskMode,
	onContent func(string),
) (string, error) {
	forcedMessages := append([]providers.ChatMessage{}, baseMessages...)
	if strings.TrimSpace(assistantContent) != "" {
		forcedMessages = append(forcedMessages, providers.ChatMessage{
			Role:    "assistant",
			Content: assistantContent,
		})
	}

	taskLabel := "新工作流"
	if taskMode == TaskRepair {
		taskLabel = "修复后的工作流"
	}

	forcedMessages = append(forcedMessages, providers.ChatMessage{
		Role: "user",
		Content: "不要继续解释，也不要只给节点清单。" +
			"现在必须直接交付一个完整、可解析、可应用的" + taskLabel + " JSON。\n" +
			"要求：\n" +
			"1. 只输出 JSON 对象，不要 markdown，不要代码块，不要前后缀说明。\n" +
			"2. JSON 必须包含 version、nodes、edges，可选 name、description。\n" +
			"3. 如果是修复当前工作流，输出的是修复后的完整工作流，不是建议列表。\n" +
			"4. 不允许再回答“我建议你这样搭建”“下面是节点清单”。\n" +
			"5. 如果信息不足，也要基于当前假设产出一版可运行的最小可用工作流。",
	})

	if canStreamWithTools && streamer != nil {
		var streamed strings.Builder
		resp, err := streamer.ChatWithToolsStream(ctx, config, systemPrompt, forcedMessages, nil, map[string]interface{}{"thinking": false}, func(content string, done bool, err error, usage *providers.TokenUsage) {
			if err != nil || content == "" {
				return
			}
			streamed.WriteString(content)
			if onContent != nil {
				onContent(content)
			}
		})
		if err != nil {
			return "", err
		}
		if streamed.Len() > 0 {
			return strings.TrimSpace(streamed.String()), nil
		}
		if resp != nil {
			return strings.TrimSpace(resp.Content), nil
		}
		return "", nil
	}

	resp, err := aiProvider.ChatWithTools(ctx, config, systemPrompt, forcedMessages, nil, map[string]interface{}{"thinking": false})
	if err != nil {
		return "", err
	}
	if resp == nil {
		return "", nil
	}
	return strings.TrimSpace(resp.Content), nil
}

func buildToolContentForLLM(toolName string, result interface{}, resultSummary string) string {
	if result == nil {
		return resultSummary
	}

	if toolName == "get_workflow" {
		if resultMap, ok := result.(map[string]interface{}); ok {
			if llmView, exists := resultMap["llmView"]; exists && llmView != nil {
				if b, err := json.Marshal(llmView); err == nil && len(b) < 48000 {
					return string(b)
				}
			}
		}
	}

	limit := 8000
	if toolName == "get_workflow" {
		limit = 48000
	}

	if b, err := json.Marshal(result); err == nil && len(b) < limit {
		return string(b)
	}

	return resultSummary
}

func isValidWorkflowJSON(jsonStr string) bool {
	var obj map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &obj); err != nil {
		return false
	}
	_, hasNodes := obj["nodes"]
	return hasNodes
}

func extractCompleteJSON(content string) string {
	start := -1
	for i, ch := range content {
		if ch == '{' {
			if i > 0 {
				before := content[max(0, i-50):i]
				if !strings.Contains(before, "version") && !strings.Contains(before, "nodes") {
					after := content[i:min(len(content), i+200)]
					if !strings.Contains(after, "\"version\"") && !strings.Contains(after, "\"nodes\"") {
						continue
					}
				}
			}
			start = i
			break
		}
	}

	if start == -1 {
		return ""
	}

	depth := 0
	inString := false
	escape := false

	for i := start; i < len(content); i++ {
		ch := content[i]

		if escape {
			escape = false
			continue
		}
		if ch == '\\' {
			escape = true
			continue
		}
		if ch == '"' {
			inString = !inString
			continue
		}

		if !inString {
			if ch == '{' {
				depth++
			} else if ch == '}' {
				depth--
				if depth == 0 {
					return content[start : i+1]
				}
			}
		}
	}

	return ""
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
