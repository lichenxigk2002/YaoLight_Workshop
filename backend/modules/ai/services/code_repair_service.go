package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	"yaolight-workshop/backend/modules/ai/services/providers"
)

type CodeRepairRequest struct {
	Language     string      `json:"language" binding:"required"`
	Source       string      `json:"source" binding:"required"`
	Error        string      `json:"error"`
	Stdout       []string    `json:"stdout"`
	Stderr       []string    `json:"stderr"`
	InputSample  interface{} `json:"inputSample"`
	OutputSample interface{} `json:"outputSample"`
	ModelMode    string      `json:"modelMode"`
	ModelID      uint        `json:"modelId"`
	Provider     string      `json:"provider"`
	ModelName    string      `json:"modelName"`
	BaseURL      string      `json:"baseUrl"`
	APIKey       string      `json:"apiKey"`
}

type CodeRepairResponse struct {
	FixedSource string                `json:"fixedSource"`
	Explanation string                `json:"explanation"`
	Model       string                `json:"model"`
	Usage       *providers.TokenUsage `json:"usage,omitempty"`
}

type codeRepairLLMResponse struct {
	FixedSource string `json:"fixedSource"`
	Explanation string `json:"explanation"`
}

func (s *AIService) RepairCode(userID uint, req *CodeRepairRequest) (*CodeRepairResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("repair request is nil")
	}
	if strings.TrimSpace(req.Source) == "" {
		return nil, fmt.Errorf("source is required")
	}

	modelMode := strings.TrimSpace(req.ModelMode)
	if modelMode == "" {
		modelMode = "system"
	}

	modelConfigPayload := map[string]interface{}{
		"provider":    strings.TrimSpace(req.Provider),
		"modelName":   strings.TrimSpace(req.ModelName),
		"baseUrl":     strings.TrimSpace(req.BaseURL),
		"apiKey":      strings.TrimSpace(req.APIKey),
		"temperature": 0.2,
		"maxTokens":   3000,
	}

	if modelMode == "system" && modelConfigPayload["provider"] == "" {
		modelConfigPayload["provider"] = defaultCodeRepairProvider()
	}
	if modelMode == "system" && modelConfigPayload["modelName"] == "" {
		modelConfigPayload["modelName"] = defaultCodeRepairModelName(modelConfigPayload["provider"].(string))
	}

	modelRepo := aiRepos.NewAIModelRepository(database.DB)
	modelConfig, err := GetModelConfigForExecution(modelMode, req.ModelID, userID, modelConfigPayload, modelRepo)
	if err != nil {
		return nil, err
	}

	provider, err := s.GetProvider(modelConfig.Provider)
	if err != nil {
		return nil, err
	}

	chatResp, err := provider.Chat(
		modelConfig,
		buildCodeRepairSystemPrompt(req.Language),
		buildCodeRepairUserPrompt(req),
		nil,
	)
	if err != nil {
		return nil, err
	}

	fixedSource, explanation := parseCodeRepairResponse(chatResp.Content, req.Source)
	if strings.TrimSpace(fixedSource) == "" {
		return nil, fmt.Errorf("AI repair returned empty code")
	}

	return &CodeRepairResponse{
		FixedSource: fixedSource,
		Explanation: explanation,
		Model:       chatResp.Model,
		Usage:       chatResp.Usage,
	}, nil
}

func defaultCodeRepairProvider() string {
	switch {
	case strings.TrimSpace(config.OpenRouterAPIKey) != "":
		return "gpt"
	case strings.TrimSpace(config.DeepSeekAPIKey) != "":
		return "deepseek"
	case strings.TrimSpace(config.QwenAPIKey) != "":
		return "qwen"
	case strings.TrimSpace(config.MoonshotAPIKey) != "":
		return "moonshot"
	case strings.TrimSpace(config.DoubaoAPIKey) != "":
		return "doubao"
	case strings.TrimSpace(config.ZhipuaiAPIKey) != "":
		return "zhipuai"
	case strings.TrimSpace(config.HunyuanAPIKey) != "":
		return "hunyuan"
	case strings.TrimSpace(config.SparkAPIKey) != "":
		return "spark"
	default:
		return "deepseek"
	}
}

func defaultCodeRepairModelName(provider string) string {
	switch normalizeProvider(strings.TrimSpace(provider)) {
	case "gpt":
		return "openai/gpt-5.4"
	case "claude":
		return "anthropic/claude-sonnet-4.5"
	case "gemini":
		return "google/gemini-3-pro-preview"
	case "grok":
		return "x-ai/grok-4.1-fast"
	case "moonshot":
		return "moonshot-v1-8k"
	case "deepseek":
		return "deepseek-v4-pro"
	case "qwen":
		return "qwen-plus"
	default:
		return "deepseek-v4-pro"
	}
}

func buildCodeRepairSystemPrompt(language string) string {
	lang := strings.ToLower(strings.TrimSpace(language))
	if lang == "" {
		lang = "javascript"
	}

	return fmt.Sprintf(`你是一个工作流代码节点修复器。你要修复 %s 代码，并严格遵守以下规则：
1. 只修复当前报错、运行问题或明显不兼容点，不要重写成另一套风格。
2. 保留用户原本意图和输出结构，除非原实现明显错误。
3. 运行时上下文只允许使用这些变量：
- input: 当前节点输入
- vars: 上下文变量映射
- node: 当前节点信息
- console: 仅在 javascript 下可用
4. 不要引入文件系统、网络、进程、第三方包依赖。
5. 返回必须是 JSON，对象结构必须为 {"fixedSource":"...","explanation":"..."}。
6. fixedSource 必须是可直接替换的完整代码字符串，不要包含 Markdown 代码块。`, lang)
}

func buildCodeRepairUserPrompt(req *CodeRepairRequest) string {
	var builder strings.Builder

	builder.WriteString("请修复下面这段代码节点脚本。\n\n")
	builder.WriteString("语言:\n")
	builder.WriteString(req.Language)
	builder.WriteString("\n\n原始代码:\n```")
	builder.WriteString(req.Language)
	builder.WriteString("\n")
	builder.WriteString(req.Source)
	builder.WriteString("\n```\n")

	if msg := strings.TrimSpace(req.Error); msg != "" {
		builder.WriteString("\n执行错误:\n")
		builder.WriteString(msg)
		builder.WriteString("\n")
	}
	if len(req.Stderr) > 0 {
		builder.WriteString("\nstderr:\n")
		builder.WriteString(strings.Join(req.Stderr, "\n"))
		builder.WriteString("\n")
	}
	if len(req.Stdout) > 0 {
		builder.WriteString("\nstdout:\n")
		builder.WriteString(strings.Join(req.Stdout, "\n"))
		builder.WriteString("\n")
	}
	if req.InputSample != nil {
		builder.WriteString("\n输入样例:\n")
		builder.WriteString(mustMarshalIndent(req.InputSample))
		builder.WriteString("\n")
	}
	if req.OutputSample != nil {
		builder.WriteString("\n当前输出样例:\n")
		builder.WriteString(mustMarshalIndent(req.OutputSample))
		builder.WriteString("\n")
	}

	builder.WriteString("\n请返回严格 JSON。")
	return builder.String()
}

func parseCodeRepairResponse(content string, fallbackSource string) (string, string) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return fallbackSource, ""
	}

	candidates := []string{
		trimmed,
		stripCodeFence(trimmed),
		extractJSONBlock(trimmed),
	}

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		var parsed codeRepairLLMResponse
		if err := json.Unmarshal([]byte(candidate), &parsed); err == nil && strings.TrimSpace(parsed.FixedSource) != "" {
			return parsed.FixedSource, strings.TrimSpace(parsed.Explanation)
		}
	}

	code := extractCodeBlock(trimmed)
	if code != "" {
		return code, "AI 返回了代码块，已直接提取为修复结果。"
	}

	return fallbackSource, trimmed
}

func stripCodeFence(content string) string {
	re := regexp.MustCompile("(?s)^```(?:json)?\\s*(.*?)\\s*```$")
	matches := re.FindStringSubmatch(strings.TrimSpace(content))
	if len(matches) == 2 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func extractJSONBlock(content string) string {
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end > start {
		return strings.TrimSpace(content[start : end+1])
	}
	return ""
}

func extractCodeBlock(content string) string {
	re := regexp.MustCompile("(?s)```(?:javascript|js|python)?\\s*(.*?)\\s*```")
	matches := re.FindStringSubmatch(content)
	if len(matches) == 2 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func mustMarshalIndent(value interface{}) string {
	bytes, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(bytes)
}
