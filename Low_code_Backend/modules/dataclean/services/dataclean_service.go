package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"
)

// DataCleanService 数据清洗服务
type DataCleanService struct{}

// CleanConfig 清洗配置
type CleanConfig struct {
	CleanType    string                 `json:"cleanType"`    // 清洗类型
	RemoveHTML   bool                   `json:"removeHTML"`   // 移除HTML标签
	Trim         bool                   `json:"trim"`         // 去除首尾空白
	RemoveSpaces bool                   `json:"removeSpaces"` // 移除多余空格
	ToLowerCase  bool                   `json:"toLowerCase"`  // 转小写
	ToUpperCase  bool                   `json:"toUpperCase"`  // 转大写
	Replace      []ReplaceRule          `json:"replace"`      // 替换规则
	Extract      *ExtractRule           `json:"extract"`      // 提取规则
	FieldMapping map[string]interface{} `json:"fieldMapping"` // 字段映射
	Filter       *FilterRule            `json:"filter"`       // 过滤规则
	Deduplicate  bool                   `json:"deduplicate"`  // 去重
}

// ReplaceRule 替换规则
type ReplaceRule struct {
	From  string `json:"from"`  // 要替换的内容（支持正则）
	To    string `json:"to"`    // 替换为
	Regex bool   `json:"regex"` // 是否为正则表达式
}

// ExtractRule 提取规则
type ExtractRule struct {
	Pattern string `json:"pattern"` // 正则表达式
	Group   int    `json:"group"`   // 提取第几个分组（0为全部）
}

// FilterRule 过滤规则
type FilterRule struct {
	Field    string `json:"field"`    // 字段名
	Operator string `json:"operator"` // 操作符：contains, notContains, equals, notEquals, startsWith, endsWith
	Value    string `json:"value"`    // 值
}

// CleanResult 清洗结果
type CleanResult struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error,omitempty"`
	Stats   CleanStats  `json:"stats,omitempty"`
}

// CleanStats 清洗统计
type CleanStats struct {
	TotalItems     int `json:"totalItems"`     // 总数
	CleanedItems   int `json:"cleanedItems"`   // 清洗后数量
	RemovedItems   int `json:"removedItems"`   // 移除数量
	DuplicateItems int `json:"duplicateItems"` // 重复数量
}

// NewDataCleanService 创建数据清洗服务
func NewDataCleanService() *DataCleanService {
	return &DataCleanService{}
}

// Execute 执行数据清洗
func (s *DataCleanService) Execute(data interface{}, config CleanConfig) (*CleanResult, error) {
	stats := CleanStats{}

	// 处理不同类型的数据
	switch v := data.(type) {
	case string:
		// 单个字符串
		cleaned := s.cleanString(v, config)
		return &CleanResult{
			Success: true,
			Data:    cleaned,
			Stats:   stats,
		}, nil

	case []interface{}:
		// 数组
		stats.TotalItems = len(v)
		cleanedArray := s.cleanArray(v, config)
		stats.CleanedItems = len(cleanedArray)
		stats.RemovedItems = stats.TotalItems - stats.CleanedItems

		return &CleanResult{
			Success: true,
			Data:    cleanedArray,
			Stats:   stats,
		}, nil

	case map[string]interface{}:
		// 对象
		stats.TotalItems = 1
		cleanedObj := s.cleanObject(v, config)
		stats.CleanedItems = 1

		return &CleanResult{
			Success: true,
			Data:    cleanedObj,
			Stats:   stats,
		}, nil

	default:
		// 其他类型，尝试转JSON再处理
		jsonBytes, err := json.Marshal(data)
		if err != nil {
			return &CleanResult{
				Success: false,
				Error:   fmt.Sprintf("不支持的数据类型: %T", data),
			}, err
		}

		var parsed interface{}
		if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
			return &CleanResult{
				Success: false,
				Error:   "解析数据失败",
			}, err
		}

		return s.Execute(parsed, config)
	}
}

// cleanString 清洗字符串
func (s *DataCleanService) cleanString(text string, config CleanConfig) string {
	result := text

	// 移除HTML标签
	if config.RemoveHTML {
		result = s.removeHTMLTags(result)
	}

	// 去除首尾空白
	if config.Trim {
		result = strings.TrimSpace(result)
	}

	// 移除多余空格
	if config.RemoveSpaces {
		result = s.removeExtraSpaces(result)
	}

	// 转换大小写
	if config.ToLowerCase {
		result = strings.ToLower(result)
	}
	if config.ToUpperCase {
		result = strings.ToUpper(result)
	}

	// 执行替换规则
	for _, rule := range config.Replace {
		result = s.applyReplaceRule(result, rule)
	}

	// 执行提取规则
	if config.Extract != nil {
		result = s.applyExtractRule(result, *config.Extract)
	}

	return result
}

// cleanArray 清洗数组
func (s *DataCleanService) cleanArray(arr []interface{}, config CleanConfig) []interface{} {
	result := make([]interface{}, 0)
	seen := make(map[string]bool)

	for _, item := range arr {
		var cleanedItem interface{}

		// 根据类型清洗
		switch v := item.(type) {
		case string:
			cleanedItem = s.cleanString(v, config)
		case map[string]interface{}:
			cleanedItem = s.cleanObject(v, config)
		default:
			cleanedItem = item
		}

		// 过滤
		if config.Filter != nil {
			if !s.applyFilter(cleanedItem, *config.Filter) {
				continue
			}
		}

		// 去重
		if config.Deduplicate {
			key := fmt.Sprintf("%v", cleanedItem)
			if seen[key] {
				continue
			}
			seen[key] = true
		}

		result = append(result, cleanedItem)
	}

	return result
}

// cleanObject 清洗对象
func (s *DataCleanService) cleanObject(obj map[string]interface{}, config CleanConfig) map[string]interface{} {
	result := make(map[string]interface{})

	// 如果有字段映射，使用映射后的字段名
	for key, value := range obj {
		newKey := key
		if config.FieldMapping != nil {
			if mappedKey, ok := config.FieldMapping[key]; ok {
				newKey = fmt.Sprintf("%v", mappedKey)
			}
		}

		// 清洗值
		var cleanedValue interface{}
		switch v := value.(type) {
		case string:
			cleanedValue = s.cleanString(v, config)
		case []interface{}:
			cleanedValue = s.cleanArray(v, config)
		case map[string]interface{}:
			cleanedValue = s.cleanObject(v, config)
		default:
			cleanedValue = value
		}

		result[newKey] = cleanedValue
	}

	return result
}

// removeHTMLTags 移除HTML标签
func (s *DataCleanService) removeHTMLTags(text string) string {
	// 移除script和style标签及其内容
	re := regexp.MustCompile(`<(script|style)[^>]*>.*?</\1>`)
	text = re.ReplaceAllString(text, "")

	// 移除其他HTML标签
	re = regexp.MustCompile(`<[^>]+>`)
	text = re.ReplaceAllString(text, "")

	// 解码HTML实体
	text = s.decodeHTMLEntities(text)

	return text
}

// decodeHTMLEntities 解码HTML实体
func (s *DataCleanService) decodeHTMLEntities(text string) string {
	entities := map[string]string{
		"&nbsp;":   " ",
		"&lt;":     "<",
		"&gt;":     ">",
		"&amp;":    "&",
		"&quot;":   "\"",
		"&apos;":   "'",
		"&times;":  "×",
		"&divide;": "÷",
		"&mdash;":  "—",
		"&ndash;":  "–",
		"&hellip;": "...",
	}

	for entity, char := range entities {
		text = strings.ReplaceAll(text, entity, char)
	}

	// 解码数字实体 &#xxxx;
	re := regexp.MustCompile(`&#(\d+);`)
	text = re.ReplaceAllStringFunc(text, func(match string) string {
		var code int
		fmt.Sscanf(match, "&#%d;", &code)
		return string(rune(code))
	})

	return text
}

// removeExtraSpaces 移除多余空格
func (s *DataCleanService) removeExtraSpaces(text string) string {
	// 将多个空白字符替换为单个空格
	re := regexp.MustCompile(`\s+`)
	return re.ReplaceAllString(text, " ")
}

// applyReplaceRule 应用替换规则
func (s *DataCleanService) applyReplaceRule(text string, rule ReplaceRule) string {
	if rule.Regex {
		re, err := regexp.Compile(rule.From)
		if err != nil {
			return text
		}
		return re.ReplaceAllString(text, rule.To)
	}
	return strings.ReplaceAll(text, rule.From, rule.To)
}

// applyExtractRule 应用提取规则
func (s *DataCleanService) applyExtractRule(text string, rule ExtractRule) string {
	re, err := regexp.Compile(rule.Pattern)
	if err != nil {
		return text
	}

	matches := re.FindStringSubmatch(text)
	if len(matches) == 0 {
		return ""
	}

	if rule.Group >= len(matches) {
		return ""
	}

	if rule.Group == 0 {
		return matches[0]
	}

	return matches[rule.Group]
}

// applyFilter 应用过滤规则
func (s *DataCleanService) applyFilter(item interface{}, rule FilterRule) bool {
	// 如果是字符串，直接过滤
	if str, ok := item.(string); ok {
		return s.matchFilter(str, rule)
	}

	// 如果是对象，提取字段值
	if obj, ok := item.(map[string]interface{}); ok {
		if value, exists := obj[rule.Field]; exists {
			valueStr := fmt.Sprintf("%v", value)
			return s.matchFilter(valueStr, rule)
		}
	}

	return true
}

// matchFilter 匹配过滤规则
func (s *DataCleanService) matchFilter(value string, rule FilterRule) bool {
	switch rule.Operator {
	case "contains":
		return strings.Contains(value, rule.Value)
	case "notContains":
		return !strings.Contains(value, rule.Value)
	case "equals":
		return value == rule.Value
	case "notEquals":
		return value != rule.Value
	case "startsWith":
		return strings.HasPrefix(value, rule.Value)
	case "endsWith":
		return strings.HasSuffix(value, rule.Value)
	case "empty":
		return strings.TrimSpace(value) == ""
	case "notEmpty":
		return strings.TrimSpace(value) != ""
	default:
		return true
	}
}

// CleanTypePresets 预设的清洗类型
var CleanTypePresets = map[string]CleanConfig{
	"html": {
		CleanType:    "html",
		RemoveHTML:   true,
		Trim:         true,
		RemoveSpaces: true,
	},
	"text": {
		CleanType:    "text",
		Trim:         true,
		RemoveSpaces: true,
	},
	"email": {
		CleanType:   "email",
		Trim:        true,
		ToLowerCase: true,
		Extract: &ExtractRule{
			Pattern: `([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`,
			Group:   1,
		},
	},
	"url": {
		CleanType: "url",
		Trim:      true,
		Extract: &ExtractRule{
			Pattern: `(https?://[^\s]+)`,
			Group:   1,
		},
	},
	"phone": {
		CleanType: "phone",
		Trim:      true,
		Replace: []ReplaceRule{
			{From: `[^\d+\-()]`, To: "", Regex: true},
		},
	},
	"number": {
		CleanType: "number",
		Trim:      true,
		Extract: &ExtractRule{
			Pattern: `(\d+\.?\d*)`,
			Group:   1,
		},
	},
	"date": {
		CleanType: "date",
		Trim:      true,
	},
}

// GetPreset 获取预设配置
func (s *DataCleanService) GetPreset(presetName string) CleanConfig {
	if preset, ok := CleanTypePresets[presetName]; ok {
		return preset
	}
	return CleanConfig{}
}

// ParseDate 解析日期（辅助函数）
func (s *DataCleanService) ParseDate(dateStr string) (time.Time, error) {
	formats := []string{
		"2006-01-02",
		"2006/01/02",
		"2006-01-02 15:04:05",
		"2006/01/02 15:04:05",
		"01/02/2006",
		"02-Jan-2006",
		time.RFC3339,
	}

	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("无法解析日期: %s", dateStr)
}

// RemoveEmojis 移除表情符号
func (s *DataCleanService) RemoveEmojis(text string) string {
	var result strings.Builder
	for _, r := range text {
		// 基本多文种平面的字符
		if r < 0x1F300 || r > 0x1F9FF {
			// 检查是否为其他表情符号范围
			if !s.isEmoji(r) {
				result.WriteRune(r)
			}
		}
	}
	return result.String()
}

// isEmoji 判断是否为表情符号
func (s *DataCleanService) isEmoji(r rune) bool {
	// Emoji ranges
	return (r >= 0x1F600 && r <= 0x1F64F) || // Emoticons
		(r >= 0x1F300 && r <= 0x1F5FF) || // Misc Symbols and Pictographs
		(r >= 0x1F680 && r <= 0x1F6FF) || // Transport and Map
		(r >= 0x2600 && r <= 0x26FF) || // Misc symbols
		(r >= 0x2700 && r <= 0x27BF) || // Dingbats
		(r >= 0xFE00 && r <= 0xFE0F) || // Variation Selectors
		(r >= 0x1F900 && r <= 0x1F9FF) || // Supplemental Symbols and Pictographs
		(r >= 0x1F1E0 && r <= 0x1F1FF) // Flags
}

// RemoveNonPrintable 移除不可打印字符
func (s *DataCleanService) RemoveNonPrintable(text string) string {
	var result strings.Builder
	for _, r := range text {
		if unicode.IsPrint(r) || r == '\n' || r == '\r' || r == '\t' {
			result.WriteRune(r)
		}
	}
	return result.String()
}
