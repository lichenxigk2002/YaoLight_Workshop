package services

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
)

// ConfigField 配置字段定义
type ConfigField struct {
	Name         string      `json:"name"`         // 字段名
	Type         string      `json:"type"`         // 类型: string, int, bool, uint, float64, object, array
	DefaultValue interface{} `json:"defaultValue"` // 默认值
	Required     bool        `json:"required"`     // 是否必填
	Description  string      `json:"description"`  // 描述（从注释提取）
	AllowVars    bool        `json:"allowVars"`    // 是否允许变量引用
	EnumValues   []string    `json:"enumValues"`   // 枚举值（如果适用）
}

// NodeConfigDefinition 节点配置定义
type NodeConfigDefinition struct {
	NodeType   string        `json:"nodeType"`   // 节点类型
	Fields     []ConfigField `json:"fields"`     // 配置字段列表
	SourceFile string        `json:"sourceFile"` // 源代码文件路径
}

// ConfigExtractor 配置提取器
// 从源代码中自动提取节点配置定义
type ConfigExtractor struct {
	workflowServicesPath string // workflow services目录路径
}

// NewConfigExtractor 创建配置提取器
func NewConfigExtractor() *ConfigExtractor {
	// 获取workflow services目录路径
	// 从当前文件位置计算相对路径
	// config_extractor.go 在 modules/alkaid/services/
	// 目标目录是 modules/workflow/services/
	workflowServicesPath := filepath.Join("..", "..", "workflow", "services")
	if _, currentFile, _, ok := runtime.Caller(0); ok {
		workflowServicesPath = filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "workflow", "services"))
	}
	return &ConfigExtractor{
		workflowServicesPath: workflowServicesPath,
	}
}

// ExtractNodeConfigs 提取所有节点的配置定义
func (e *ConfigExtractor) ExtractNodeConfigs() (map[string]*NodeConfigDefinition, error) {
	configs := make(map[string]*NodeConfigDefinition)

	// 定义节点类型和对应的文件
	nodeFiles := map[string]string{
		"start":     "start_node.go",
		"crawler":   "crawler_node.go",
		"dataclean": "dataclean_node.go",
		"ai":        "ai_node.go",
		"output":    "output_node.go",
		"end":       "end_node.go",
		"condition": "condition_node.go",
		"transform": "transform_node.go",
		"loop":      "loop_node.go",
		"merge":     "merge_node.go",
		"delay":     "delay_node.go",
		// 可以继续添加其他节点类型
	}

	// 获取绝对路径
	basePath, err := "", error(nil)
	if err != nil {
		return nil, fmt.Errorf("获取工作目录失败: %w", err)
	}

	// 遍历每个节点文件
	for nodeType, fileName := range nodeFiles {
		filePath := filepath.Join(basePath, e.workflowServicesPath, fileName)

		// 检查文件是否存在
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			continue // 文件不存在，跳过
		}

		// 解析文件
		config, err := e.extractFromFile(filePath, nodeType)
		if err != nil {
			// 记录错误但继续处理其他文件
			fmt.Printf("警告: 解析 %s 失败: %v\n", fileName, err)
			continue
		}

		if config != nil {
			configs[nodeType] = config
		}
	}

	return configs, nil
}

// extractFromFile 从文件中提取配置
func (e *ConfigExtractor) extractFromFile(filePath, nodeType string) (*NodeConfigDefinition, error) {
	// 读取文件内容
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	// 使用正则表达式提取配置字段（更简单可靠）
	fields := e.extractConfigFieldsRegex(string(content))

	return &NodeConfigDefinition{
		NodeType:   nodeType,
		Fields:     fields,
		SourceFile: filePath,
	}, nil
}

// extractConfigFieldsRegex 使用正则表达式从源代码中提取配置字段
// 这个方法更简单可靠，直接匹配 getString/getInt/getBool 等函数调用
func (e *ConfigExtractor) extractConfigFieldsRegex(source string) []ConfigField {
	var fields []ConfigField
	fieldMap := make(map[string]*ConfigField)

	// 匹配 getString(node.Config, "fieldName", defaultValue)
	getStringPattern := regexp.MustCompile(`getString\s*\(\s*[^,]+,\s*"([^"]+)"\s*,\s*([^)]+)\)`)
	getIntPattern := regexp.MustCompile(`getInt\s*\(\s*[^,]+,\s*"([^"]+)"\s*,\s*([^)]+)\)`)
	getBoolPattern := regexp.MustCompile(`getBool\s*\(\s*[^,]+,\s*"([^"]+)"\s*,\s*([^)]+)\)`)
	getUintPattern := regexp.MustCompile(`getUint\s*\(\s*[^,]+,\s*"([^"]+)"\s*,\s*([^)]+)\)`)
	getFloatPattern := regexp.MustCompile(`getFloat\s*\(\s*[^,]+,\s*"([^"]+)"\s*,\s*([^)]+)\)`)

	// 提取各种类型的配置字段
	patterns := []struct {
		regex *regexp.Regexp
		typ   string
	}{
		{getStringPattern, "string"},
		{getIntPattern, "int"},
		{getBoolPattern, "bool"},
		{getUintPattern, "uint"},
		{getFloatPattern, "float64"},
	}

	for _, p := range patterns {
		matches := p.regex.FindAllStringSubmatch(source, -1)
		for _, match := range matches {
			if len(match) < 3 {
				continue
			}

			fieldName := match[1]
			defaultValueStr := strings.TrimSpace(match[2])

			// 如果字段已存在，跳过（避免重复）
			if _, exists := fieldMap[fieldName]; exists {
				continue
			}

			// 解析默认值
			defaultValue := e.parseDefaultValue(defaultValueStr, p.typ)

			// 检查是否允许变量引用（查找 ResolveTemplate 调用）
			allowVars := e.checkAllowVarsRegex(source, fieldName)

			field := &ConfigField{
				Name:         fieldName,
				Type:         p.typ,
				DefaultValue: defaultValue,
				Required:     false, // 默认非必填
				AllowVars:    allowVars,
			}

			// 提取注释（查找字段上方的注释）
			field.Description = e.extractFieldCommentRegex(source, match[0])

			fieldMap[fieldName] = field
		}
	}

	// 转换为切片
	for _, field := range fieldMap {
		fields = append(fields, *field)
	}

	return fields
}

// parseDefaultValue 解析默认值字符串
func (e *ConfigExtractor) parseDefaultValue(valueStr, fieldType string) interface{} {
	valueStr = strings.TrimSpace(valueStr)

	switch fieldType {
	case "string":
		// 去除引号
		if len(valueStr) >= 2 && valueStr[0] == '"' && valueStr[len(valueStr)-1] == '"' {
			return valueStr[1 : len(valueStr)-1]
		}
		return valueStr
	case "int":
		if val, err := strconv.Atoi(valueStr); err == nil {
			return val
		}
	case "bool":
		return valueStr == "true"
	case "uint":
		if val, err := strconv.ParseUint(valueStr, 10, 64); err == nil {
			return uint(val)
		}
	case "float64":
		if val, err := strconv.ParseFloat(valueStr, 64); err == nil {
			return val
		}
	}
	return nil
}

// checkAllowVarsRegex 使用正则检查字段是否允许变量引用
func (e *ConfigExtractor) checkAllowVarsRegex(source, fieldName string) bool {
	// 查找 ResolveTemplate 或 ResolveTemplateToInterface 调用
	// 如果字段名出现在这些调用中，说明允许变量引用

	// 匹配 ResolveTemplate(variableContext.ResolveTemplate, "fieldName" 或 fieldNameVariable)
	resolvePattern := regexp.MustCompile(`ResolveTemplate(ToInterface)?\s*\([^)]*` + regexp.QuoteMeta(fieldName))
	if resolvePattern.MatchString(source) {
		return true
	}

	// 检查是否有 urlVariable, contentVariable 等命名模式
	if strings.HasSuffix(fieldName, "Variable") {
		return true
	}

	// 检查字段名是否在变量解析的上下文中
	// 例如：urlVariable := getString(node.Config, "urlVariable", "")
	// 然后：resolved, err := variableContext.ResolveTemplate(urlVariable)
	varPattern := regexp.MustCompile(fieldName + `\s*:=.*getString.*` + fieldName)
	if varPattern.MatchString(source) {
		// 检查后续是否有 ResolveTemplate 调用
		resolveAfterPattern := regexp.MustCompile(fieldName + `[^}]*ResolveTemplate`)
		if resolveAfterPattern.MatchString(source) {
			return true
		}
	}

	return false
}

// extractFieldCommentRegex 提取字段注释
func (e *ConfigExtractor) extractFieldCommentRegex(source, matchStr string) string {
	// 找到匹配行的位置
	lines := strings.Split(source, "\n")
	for i, line := range lines {
		if strings.Contains(line, matchStr) {
			// 向上查找注释（最多查找5行）
			for j := i - 1; j >= 0 && j >= i-6; j-- {
				commentLine := strings.TrimSpace(lines[j])
				if strings.HasPrefix(commentLine, "//") {
					comment := strings.TrimPrefix(commentLine, "//")
					comment = strings.TrimSpace(comment)
					if comment != "" && !strings.HasPrefix(comment, "TODO") && !strings.HasPrefix(comment, "FIXME") {
						return comment
					}
				}
			}
			break
		}
	}
	return ""
}

// extractConfigFields 从AST中提取配置字段（保留作为备用方法）
// 这个方法已废弃，使用 extractConfigFieldsRegex 代替
func (e *ConfigExtractor) extractConfigFields(file interface{}, source []byte) []ConfigField {
	// 这个方法已废弃，使用 extractConfigFieldsRegex 代替
	// 保留函数签名以便将来需要时使用AST解析
	return []ConfigField{}
}

// 以下方法已废弃，使用正则表达式版本代替

// checkAllowVars 检查字段是否允许变量引用（AST版本，已废弃）
// 现在使用 checkAllowVarsRegex
func (e *ConfigExtractor) checkAllowVars(file interface{}, fieldName string) bool {
	// 已废弃，使用正则表达式版本
	return false
}

// ExtractEnumValues 提取枚举值（从代码中的switch语句或if-else链）
// 使用正则表达式版本
func (e *ConfigExtractor) ExtractEnumValues(source string, fieldName string) []string {
	var enumValues []string

	// 查找switch语句中的case值
	// 匹配 switch fieldName { case "value1": case "value2": }
	switchPattern := regexp.MustCompile(`switch\s+[^{]*` + regexp.QuoteMeta(fieldName) + `[^{]*\{[^}]*case\s+"([^"]+)"`)
	matches := switchPattern.FindAllStringSubmatch(source, -1)
	for _, match := range matches {
		if len(match) > 1 {
			enumValues = append(enumValues, match[1])
		}
	}

	// 查找枚举定义，如 Enums: map[string][]string{ "fieldName": {"value1", "value2"} }
	enumPattern := regexp.MustCompile(`"` + regexp.QuoteMeta(fieldName) + `":\s*\[\]string\{([^}]+)\}`)
	enumMatches := enumPattern.FindAllStringSubmatch(source, -1)
	for _, match := range enumMatches {
		if len(match) > 1 {
			// 解析字符串数组
			values := strings.Split(match[1], ",")
			for _, val := range values {
				val = strings.TrimSpace(val)
				val = strings.Trim(val, `"`)
				if val != "" {
					enumValues = append(enumValues, val)
				}
			}
		}
	}

	return enumValues
}

// UpdateCapabilitiesFromSource 从源代码更新Capabilities
// 这是主要的入口函数，会被CapabilitiesService调用
func UpdateCapabilitiesFromSource(capabilities *WorkflowCapabilities) error {
	extractor := NewConfigExtractor()

	// 提取所有节点配置
	nodeConfigs, err := extractor.ExtractNodeConfigs()
	if err != nil {
		return fmt.Errorf("提取节点配置失败: %w", err)
	}

	// 更新Capabilities中的节点定义
	for i := range capabilities.NodeTypes {
		nodeType := &capabilities.NodeTypes[i]
		if config, exists := nodeConfigs[nodeType.Type]; exists {
			// 更新配置规则
			required := []string{}
			defaults := make(map[string]interface{})
			allowVars := []string{}

			for _, field := range config.Fields {
				if field.Required {
					required = append(required, field.Name)
				}
				if field.DefaultValue != nil {
					defaults[field.Name] = field.DefaultValue
				}
				if field.AllowVars {
					allowVars = append(allowVars, field.Name)
				}
			}

			// 更新节点配置规则 - 合并必填字段
			existingRequired := make(map[string]bool)
			for _, r := range nodeType.ConfigRules.Required {
				existingRequired[r] = true
			}
			for _, r := range required {
				if !existingRequired[r] {
					nodeType.ConfigRules.Required = append(nodeType.ConfigRules.Required, r)
				}
			}

			// 更新默认值 - 合并（源代码中的默认值优先级更高）
			if nodeType.ConfigRules.Defaults == nil {
				nodeType.ConfigRules.Defaults = make(map[string]interface{})
			}
			for k, v := range defaults {
				nodeType.ConfigRules.Defaults[k] = v
			}

			// 更新允许变量引用的字段 - 合并
			existingAllowVars := make(map[string]bool)
			for _, a := range nodeType.ConfigRules.AllowVars {
				existingAllowVars[a] = true
			}
			for _, a := range allowVars {
				if !existingAllowVars[a] {
					nodeType.ConfigRules.AllowVars = append(nodeType.ConfigRules.AllowVars, a)
				}
			}

			// 更新配置示例（使用提取的字段和默认值）
			// 保留原有的配置，添加新的字段
			if nodeType.Config == nil {
				nodeType.Config = make(map[string]interface{})
			}
			for _, field := range config.Fields {
				// 如果字段不存在或值为nil，使用提取的默认值
				if _, exists := nodeType.Config[field.Name]; !exists || nodeType.Config[field.Name] == nil {
					if field.DefaultValue != nil {
						nodeType.Config[field.Name] = field.DefaultValue
					}
				}
			}
		}
	}

	return nil
}
