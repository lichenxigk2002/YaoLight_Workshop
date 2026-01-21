package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// JSONExtractor JSON提取器
// 从Markdown格式的文本中提取JSON代码块
type JSONExtractor struct{}

// NewJSONExtractor 创建JSON提取器
func NewJSONExtractor() *JSONExtractor {
	return &JSONExtractor{}
}

// ExtractWorkflowJSON 从Markdown文本中提取工作流JSON
// 返回提取的JSON字符串和错误信息
func (e *JSONExtractor) ExtractWorkflowJSON(markdownText string) (string, error) {
	if markdownText == "" {
		return "", fmt.Errorf("输入文本为空")
	}

	// 方法1: 尝试提取 ```json 代码块
	jsonFromCodeBlock, err := e.extractFromCodeBlock(markdownText)
	if err == nil && jsonFromCodeBlock != "" {
		// 验证JSON是否有效
		var testJSON interface{}
		if json.Unmarshal([]byte(jsonFromCodeBlock), &testJSON) == nil {
			return jsonFromCodeBlock, nil
		}
	}

	// 方法2: 尝试直接解析整个文本（可能是纯JSON）
	var testJSON interface{}
	if json.Unmarshal([]byte(markdownText), &testJSON) == nil {
		return markdownText, nil
	}

	// 方法3: 尝试提取第一个看起来像JSON的代码块（没有语言标识符）
	jsonFromPlainBlock, err := e.extractFromPlainCodeBlock(markdownText)
	if err == nil && jsonFromPlainBlock != "" {
		var testJSON interface{}
		if json.Unmarshal([]byte(jsonFromPlainBlock), &testJSON) == nil {
			return jsonFromPlainBlock, nil
		}
	}

	// 方法4: 尝试提取第一个 {...} 格式的JSON对象
	jsonFromBrace, err := e.extractFromBraces(markdownText)
	if err == nil && jsonFromBrace != "" {
		var testJSON interface{}
		if json.Unmarshal([]byte(jsonFromBrace), &testJSON) == nil {
			return jsonFromBrace, nil
		}
	}

	return "", fmt.Errorf("无法从文本中提取有效的JSON代码块")
}

// extractFromCodeBlock 从 ```json 代码块中提取JSON
func (e *JSONExtractor) extractFromCodeBlock(text string) (string, error) {
	// 匹配 ```json ... ``` 格式
	pattern := regexp.MustCompile("(?s)```json\\s*\n(.*?)\\n```")
	matches := pattern.FindStringSubmatch(text)

	if len(matches) >= 2 {
		jsonStr := strings.TrimSpace(matches[1])
		if jsonStr != "" {
			return jsonStr, nil
		}
	}

	// 也尝试匹配 ```json\n...\n``` 格式（代码块标签和内容在同一行的情况）
	pattern2 := regexp.MustCompile("(?s)```json\\s+(.*?)\\s+```")
	matches2 := pattern2.FindStringSubmatch(text)

	if len(matches2) >= 2 {
		jsonStr := strings.TrimSpace(matches2[1])
		if jsonStr != "" {
			return jsonStr, nil
		}
	}

	return "", fmt.Errorf("未找到JSON代码块")
}

// extractFromPlainCodeBlock 从普通代码块中提取JSON（没有语言标识符）
func (e *JSONExtractor) extractFromPlainCodeBlock(text string) (string, error) {
	// 匹配 ``` ... ``` 格式（没有语言标识符）
	pattern := regexp.MustCompile("(?s)```\\s*\n(.*?)\\n```")
	matches := pattern.FindStringSubmatch(text)

	if len(matches) >= 2 {
		content := strings.TrimSpace(matches[1])
		// 检查内容是否看起来像JSON（以 { 开头）
		if strings.HasPrefix(strings.TrimSpace(content), "{") {
			return content, nil
		}
	}

	return "", fmt.Errorf("未找到普通代码块")
}

// extractFromBraces 从文本中提取第一个 {...} 格式的JSON对象
func (e *JSONExtractor) extractFromBraces(text string) (string, error) {
	// 找到第一个 {
	startIdx := strings.Index(text, "{")
	if startIdx == -1 {
		return "", fmt.Errorf("未找到JSON对象开始标记")
	}

	// 从 { 开始，找到匹配的 }
	depth := 0
	inString := false
	escape := false

	for i := startIdx; i < len(text); i++ {
		char := text[i]

		if escape {
			escape = false
			continue
		}

		if char == '\\' {
			escape = true
			continue
		}

		if char == '"' {
			inString = !inString
			continue
		}

		if inString {
			continue
		}

		if char == '{' {
			depth++
		} else if char == '}' {
			depth--
			if depth == 0 {
				// 找到了匹配的 }
				return text[startIdx : i+1], nil
			}
		}
	}

	return "", fmt.Errorf("未找到匹配的JSON对象结束标记")
}

// ExtractAndValidateWorkflow 提取并验证工作流JSON
// 返回解析后的WorkflowExportData结构
func (e *JSONExtractor) ExtractAndValidateWorkflow(markdownText string) (map[string]interface{}, error) {
	jsonStr, err := e.ExtractWorkflowJSON(markdownText)
	if err != nil {
		return nil, err
	}

	// 解析JSON
	var workflowData map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &workflowData); err != nil {
		return nil, fmt.Errorf("JSON解析失败: %w", err)
	}

	// 验证必需的顶层字段
	requiredFields := []string{"version", "exportedAt", "nodes", "edges"}
	for _, field := range requiredFields {
		if _, exists := workflowData[field]; !exists {
			return nil, fmt.Errorf("缺少必需字段: %s", field)
		}
	}

	// 验证nodes和edges是数组
	nodes, ok := workflowData["nodes"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("nodes字段必须是数组")
	}

	edges, ok := workflowData["edges"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("edges字段必须是数组")
	}

	// 验证至少有一个节点和边
	if len(nodes) == 0 {
		return nil, fmt.Errorf("nodes数组不能为空")
	}

	if len(edges) == 0 && len(nodes) > 1 {
		return nil, fmt.Errorf("多个节点时必须至少有一条边")
	}

	return workflowData, nil
}

// HasJSONCodeBlock 检查文本中是否包含JSON代码块
func (e *JSONExtractor) HasJSONCodeBlock(text string) bool {
	pattern := regexp.MustCompile("(?s)```json\\s*\n.*?\\n```")
	return pattern.MatchString(text)
}
