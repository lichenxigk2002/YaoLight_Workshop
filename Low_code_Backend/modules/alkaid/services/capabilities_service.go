package services

import (
	"encoding/json"
	"fmt"
	"yaolight-workshop/backend/modules/workflow/services"
)

// CapabilitiesService 瑶光星能力说明服务
// 负责聚合所有节点规格、I/O定义、配置规则等信息，供AI生成工作流时使用
type CapabilitiesService struct{}

// NodeCapability 节点能力定义
type NodeCapability struct {
	Type        string                  `json:"type"`        // 节点类型: start, crawler, dataclean, ai, output, end等
	Label       string                  `json:"label"`       // 节点显示名称
	Description string                  `json:"description"` // 节点描述
	Stability   string                  `json:"stability"`   // 稳定性: stable, experimental, stub
	Inputs      []services.NodeVariable `json:"inputs"`      // 输入变量定义
	Outputs     []services.NodeVariable `json:"outputs"`     // 输出变量定义
	Config      map[string]interface{}  `json:"config"`      // 默认配置
	ConfigRules ConfigRules             `json:"configRules"` // 配置规则
	Examples    []NodeExample           `json:"examples"`    // 示例配置
}

// ConfigRules 配置规则
type ConfigRules struct {
	Required    []string               `json:"required"`    // 必填字段
	Enums       map[string][]string    `json:"enums"`       // 枚举字段及可选值
	AllowVars   []string               `json:"allowVars"`   // 允许使用模板变量的字段
	Defaults    map[string]interface{} `json:"defaults"`    // 默认值
	Constraints map[string]string      `json:"constraints"` // 约束说明
}

// NodeExample 节点配置示例
type NodeExample struct {
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
}

// WorkflowCapabilities 工作流能力说明
type WorkflowCapabilities struct {
	Version        string           `json:"version"`        // 能力版本
	WorkflowSchema WorkflowSchema   `json:"workflowSchema"` // 工作流格式定义
	NodeTypes      []NodeCapability `json:"nodeTypes"`      // 节点类型列表
	Template       Template         `json:"template"`       // 推荐模板
	Rules          WorkflowRules    `json:"rules"`          // 工作流规则
}

// WorkflowSchema 工作流格式定义
type WorkflowSchema struct {
	Version    string                 `json:"version"`    // WorkflowExportData 版本
	Required   []string               `json:"required"`   // 必填顶层字段
	Fields     map[string]interface{} `json:"fields"`     // 字段说明
	NodeFormat NodeFormat             `json:"nodeFormat"` // 节点格式
	EdgeFormat EdgeFormat             `json:"edgeFormat"` // 边格式
}

// NodeFormat 节点格式定义
type NodeFormat struct {
	Required   []string               `json:"required"`   // 必填字段: id, type
	Optional   []string               `json:"optional"`   // 可选字段: position, data
	DataFormat map[string]interface{} `json:"dataFormat"` // data字段格式
}

// EdgeFormat 边格式定义
type EdgeFormat struct {
	Required []string `json:"required"` // 必填字段: source, target
	Optional []string `json:"optional"` // 可选字段: id, sourceHandle, targetHandle
}

// Template 推荐模板
type Template struct {
	MinimalFlow []string `json:"minimalFlow"` // 最小可运行模板: ["start", "crawler", "dataclean", "ai", "output", "end"]
	Description string   `json:"description"` // 模板说明
}

// WorkflowRules 工作流规则
type WorkflowRules struct {
	VariableSyntax  string   `json:"variableSyntax"`  // 变量引用语法: {{nodeId.variableName}}
	MaxNodes        int      `json:"maxNodes"`        // 最大节点数
	AvoidNodeTypes  []string `json:"avoidNodeTypes"`  // 第一阶段应避免的节点类型
	ConnectionRules []string `json:"connectionRules"` // 连接规则说明
}

// NewCapabilitiesService 创建能力说明服务
func NewCapabilitiesService() *CapabilitiesService {
	return &CapabilitiesService{}
}

// GetCapabilities 获取完整的能力说明文档
// 现在会自动从源代码提取配置，无需手动维护
func (s *CapabilitiesService) GetCapabilities() (*WorkflowCapabilities, error) {
	// 1. 构建节点能力列表（基础定义）
	nodeTypes := s.buildNodeCapabilities()

	// 2. **自动从源代码提取配置并更新**
	// 这会扫描实际的节点执行代码，提取所有配置字段
	capabilities := &WorkflowCapabilities{
		NodeTypes: nodeTypes,
	}
	if err := UpdateCapabilitiesFromSource(capabilities); err != nil {
		// 如果自动提取失败，记录警告但继续使用基础定义
		fmt.Printf("警告: 自动提取配置失败，使用基础定义: %v\n", err)
		// 不返回错误，继续使用基础定义
	} else {
		// 更新成功，使用更新后的节点类型
		nodeTypes = capabilities.NodeTypes
	}

	// 3. 构建工作流格式定义
	workflowSchema := WorkflowSchema{
		Version:  "1.0.0",
		Required: []string{"version", "exportedAt", "nodes", "edges"},
		Fields: map[string]interface{}{
			"version":      "工作流版本，必须为 '1.0.0'",
			"exportedAt":   "ISO8601格式的时间戳",
			"name":         "工作流名称（可选）",
			"description":  "工作流描述（可选）",
			"nodes":        "节点数组",
			"edges":        "边数组",
			"commentCards": "注释卡片数组（可选）",
		},
		NodeFormat: NodeFormat{
			Required: []string{"id", "type"},
			Optional: []string{"position", "data"},
			DataFormat: map[string]interface{}{
				"label":               "节点显示名称（建议）",
				"type":                "节点类型（必须与顶层type一致）",
				"config":              "节点配置对象",
				"connectionDirection": "连接方向，建议使用 'vertical'",
			},
		},
		EdgeFormat: EdgeFormat{
			Required: []string{"source", "target"},
			Optional: []string{"id", "sourceHandle", "targetHandle"},
		},
	}

	// 4. 构建推荐模板
	template := Template{
		MinimalFlow: []string{"start", "crawler", "dataclean", "ai", "output", "end"},
		Description: "最小可运行模板，适用于大多数场景：开始 → 爬虫 → 数据清洗 → AI处理 → 输出 → 结束",
	}

	// 5. 构建工作流规则
	rules := WorkflowRules{
		VariableSyntax: "{{nodeId.variableName}} 或 {{nodeId.variableName.field}}",
		MaxNodes:       -1,                            // -1 表示无限制，根据用户需求灵活决定
		AvoidNodeTypes: []string{"loop", "transform"}, // 第一阶段应避免这些节点
		ConnectionRules: []string{
			"start 节点只能作为入口，不能有入边",
			"end 节点只能作为出口，不能有出边",
			"condition 节点的出边需要使用 sourceHandle: 'true' 或 'false'",
			"merge 节点的入边需要使用 targetHandle: 'input-0', 'input-1' 等",
		},
	}

	return &WorkflowCapabilities{
		Version:        "1.0.0",
		WorkflowSchema: workflowSchema,
		NodeTypes:      nodeTypes,
		Template:       template,
		Rules:          rules,
	}, nil
}

// buildNodeCapabilities 构建节点能力列表
func (s *CapabilitiesService) buildNodeCapabilities() []NodeCapability {
	// 获取节点I/O定义
	ioDefs := s.getNodeIODefinitions()

	capabilities := []NodeCapability{}

	// 定义每个节点的详细能力
	nodeSpecs := []struct {
		Type        string
		Label       string
		Description string
		Stability   string
		Config      map[string]interface{}
		ConfigRules ConfigRules
	}{
		{
			Type:        "start",
			Label:       "开始节点",
			Description: "工作流的起始节点，定义初始输入数据",
			Stability:   "stable",
			Config: map[string]interface{}{
				"trigger":       "manual",
				"inputDataType": "json",
				"inputData":     "{\"url\": \"https://example.com\"}",
			},
			ConfigRules: ConfigRules{
				Required: []string{"trigger", "inputDataType"},
				Enums: map[string][]string{
					"trigger":       {"manual", "schedule", "webhook"},
					"inputDataType": {"json", "text", "form"},
				},
				AllowVars: []string{},
			},
		},
		{
			Type:        "crawler",
			Label:       "爬虫节点",
			Description: "抓取网页内容，支持URL变量引用",
			Stability:   "stable",
			Config: map[string]interface{}{
				"urlVariable": "{{node-1.data.url}}",
				"method":      "GET",
				"extractMode": "smart",
				"extractType": "text",
			},
			ConfigRules: ConfigRules{
				Required: []string{"urlVariable"}, // url 或 urlVariable 至少一个
				Enums: map[string][]string{
					"method":      {"GET", "POST"},
					"extractMode": {"smart", "regex", "custom"},
					"extractType": {"text", "html", "link", "image", "attr"},
				},
				AllowVars: []string{"urlVariable", "headers", "body"},
				Defaults: map[string]interface{}{
					"method":      "GET",
					"extractMode": "smart",
					"extractType": "text",
				},
			},
		},
		{
			Type:        "dataclean",
			Label:       "数据清洗节点",
			Description: "清洗文本数据，去除HTML、空格等",
			Stability:   "stable",
			Config: map[string]interface{}{
				"dataVariable": "{{node-2.text}}",
				"cleanType":    "text",
				"trim":         true,
			},
			ConfigRules: ConfigRules{
				Required: []string{"dataVariable"},
				Enums: map[string][]string{
					"cleanType": {"html", "text", "email", "url", "phone", "number", "date", "custom"},
				},
				AllowVars: []string{"dataVariable"},
				Defaults: map[string]interface{}{
					"cleanType":  "text",
					"trim":       true,
					"removeHTML": true,
				},
			},
		},
		{
			Type:        "ai",
			Label:       "AI处理节点",
			Description: "使用AI模型处理文本内容",
			Stability:   "stable",
			Config: map[string]interface{}{
				"modelMode":       "system",
				"provider":        "deepseek",
				"modelName":       "deepseek-chat",
				"contentVariable": "{{node-3.cleaned}}",
				"prompt":          "请总结以下内容",
				"temperature":     0.2,
				"maxTokens":       2000,
			},
			ConfigRules: ConfigRules{
				Required: []string{"prompt", "contentVariable"},
				Enums: map[string][]string{
					"modelMode": {"system", "custom"},
					"provider":  {"deepseek", "qwen", "openai", "doubao", "spark", "grok"},
				},
				AllowVars: []string{"contentVariable", "prompt"},
				Defaults: map[string]interface{}{
					"modelMode":   "system",
					"provider":    "deepseek",
					"modelName":   "deepseek-chat",
					"temperature": 0.2,
					"maxTokens":   2000,
				},
			},
		},
		{
			Type:        "output",
			Label:       "输出节点",
			Description: "输出处理结果到文件或显示",
			Stability:   "stable",
			Config: map[string]interface{}{
				"format":      "markdown",
				"destination": "file",
			},
			ConfigRules: ConfigRules{
				Required: []string{"format"},
				Enums: map[string][]string{
					"format":      {"json", "markdown", "text"},
					"destination": {"file", "console"},
				},
				AllowVars: []string{},
				Defaults: map[string]interface{}{
					"format":      "json",
					"destination": "file",
				},
			},
		},
		{
			Type:        "end",
			Label:       "结束节点",
			Description: "工作流的结束节点",
			Stability:   "stable",
			Config: map[string]interface{}{
				"action": "none",
			},
			ConfigRules: ConfigRules{
				Required: []string{},
				Enums: map[string][]string{
					"action": {"none", "notify", "callback"},
				},
				AllowVars: []string{},
				Defaults: map[string]interface{}{
					"action": "none",
				},
			},
		},
	}

	// 构建完整的节点能力
	for _, spec := range nodeSpecs {
		ioDef, exists := ioDefs[spec.Type]
		if !exists {
			continue
		}

		capability := NodeCapability{
			Type:        spec.Type,
			Label:       spec.Label,
			Description: spec.Description,
			Stability:   spec.Stability,
			Inputs:      ioDef.Inputs,
			Outputs:     ioDef.Outputs,
			Config:      spec.Config,
			ConfigRules: spec.ConfigRules,
			Examples:    s.buildNodeExamples(spec.Type),
		}
		capabilities = append(capabilities, capability)
	}

	return capabilities
}

// buildNodeExamples 构建节点配置示例
func (s *CapabilitiesService) buildNodeExamples(nodeType string) []NodeExample {
	examples := []NodeExample{}

	switch nodeType {
	case "crawler":
		examples = append(examples, NodeExample{
			Description: "使用URL变量引用start节点的数据",
			Config: map[string]interface{}{
				"urlVariable": "{{node-1.data.url}}",
				"method":      "GET",
				"extractMode": "smart",
				"extractType": "text",
			},
		})
	case "dataclean":
		examples = append(examples, NodeExample{
			Description: "清洗crawler节点输出的文本",
			Config: map[string]interface{}{
				"dataVariable": "{{node-2.text}}",
				"cleanType":    "text",
				"trim":         true,
			},
		})
	case "ai":
		examples = append(examples, NodeExample{
			Description: "使用dataclean的清洗结果进行AI处理",
			Config: map[string]interface{}{
				"contentVariable": "{{node-3.cleaned}}",
				"prompt":          "请总结以下内容",
				"provider":        "deepseek",
				"modelName":       "deepseek-chat",
				"temperature":     0.2,
			},
		})
	}

	return examples
}

// getNodeIODefinitions 获取节点I/O定义（内部使用）
func (s *CapabilitiesService) getNodeIODefinitions() map[string]services.NodeIODefinition {
	return services.GetNodeIODefinitions()
}

// BuildPromptContext 构建用于AI Prompt的上下文
func (s *CapabilitiesService) BuildPromptContext() (string, error) {
	capabilities, err := s.GetCapabilities()
	if err != nil {
		return "", err
	}

	// 转换为JSON格式，便于AI理解
	jsonData, err := json.MarshalIndent(capabilities, "", "  ")
	if err != nil {
		return "", err
	}

	return string(jsonData), nil
}
