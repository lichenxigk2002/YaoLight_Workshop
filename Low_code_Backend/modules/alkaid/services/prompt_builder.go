package services

import (
	"fmt"
	"strings"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

// PromptBuilder 瑶光星Prompt构建器
// 负责将Capabilities转换为结构化的System Prompt，确保AI理解所有规则
type PromptBuilder struct {
	capabilities      *WorkflowCapabilities
	relevantKnowledge []alkaidModels.AlkaidKnowledge // 按需检索的知识库条目
}

// NewPromptBuilder 创建Prompt构建器
func NewPromptBuilder(capabilities *WorkflowCapabilities, relevantKnowledge ...[]alkaidModels.AlkaidKnowledge) *PromptBuilder {
	knowledge := []alkaidModels.AlkaidKnowledge{}
	if len(relevantKnowledge) > 0 {
		knowledge = relevantKnowledge[0]
	}
	return &PromptBuilder{
		capabilities:      capabilities,
		relevantKnowledge: knowledge,
	}
}

// BuildSystemPrompt 构建System Prompt
func (pb *PromptBuilder) BuildSystemPrompt() string {
	var builder strings.Builder

	builder.WriteString("你是一个专业的工作流生成助手（瑶光星）。你可以与用户自然对话，并根据用户需求生成或修改工作流。\n\n")

	// 1. 核心规则
	builder.WriteString("## 核心规则\n")
	builder.WriteString("1. **自然对话**：与用户交流时保持自然、友好的语气，不要使用固定的模板话术\n")
	builder.WriteString("   - 根据对话上下文灵活回应，就像和朋友聊天一样\n")
	builder.WriteString("   - 当用户要求生成工作流时，自然地介绍工作流的功能和特点\n")
	builder.WriteString("   - 当用户要求修改时，自然地说明修改内容\n")
	builder.WriteString("2. **工作流输出格式**：当需要输出工作流JSON时，必须在代码块前添加特殊标记 `<!-- workflow-json -->`\n")
	builder.WriteString("   - 格式：`<!-- workflow-json -->\\n```json\\n{...}\\n```\n")
	builder.WriteString("   - JSON代码块中的内容必须是完整的 WorkflowExportData 格式\n")
	builder.WriteString("   - 可以在JSON代码块前后添加说明，但不要使用固定的模板话术\n")
	builder.WriteString("   - **重要**：只有工作流JSON需要添加此标记，其他JSON代码块不需要\n")
	builder.WriteString("3. **JSON格式**：代码块中的JSON必须是完整的 WorkflowExportData 格式\n")
	builder.WriteString("4. **严格遵循格式**：所有字段名必须与规范完全一致\n")
	builder.WriteString("5. **变量引用语法**：使用 `{{nodeId.variableName}}` 格式，例如 `{{node-1.data.url}}`\n")
	builder.WriteString("6. **工作流复杂度**：根据用户描述的复杂程度灵活决定节点数量\n")
	builder.WriteString("   - 如果用户需求简单，使用最小可运行模板：start → crawler → dataclean → ai → output → end\n")
	builder.WriteString("   - 如果用户需求复杂（如多步骤、条件分支、多数据源等），可以设计更复杂的工作流，使用更多节点\n")
	builder.WriteString("   - 不要人为限制节点数量，完全根据用户需求来设计\n")
	builder.WriteString("7. **避免复杂节点**：第一阶段不要使用 loop 和 transform 节点\n\n")

	// 2. 工作流格式定义
	builder.WriteString("## 工作流格式定义 (WorkflowExportData)\n")
	pb.writeWorkflowSchema(&builder)
	builder.WriteString("\n")

	// 3. 节点类型说明
	builder.WriteString("## 节点类型说明\n")
	pb.writeNodeTypes(&builder)
	builder.WriteString("\n")

	// 4. 变量引用规则
	builder.WriteString("## 变量引用规则\n")
	pb.writeVariableRules(&builder)
	builder.WriteString("\n")

	// 5. 连接规则
	builder.WriteString("## 连接规则\n")
	pb.writeConnectionRules(&builder)
	builder.WriteString("\n")

	// 6. 示例模板
	builder.WriteString("## 示例模板\n")
	pb.writeExampleTemplate(&builder)
	builder.WriteString("\n")

	// 7. 重要约束
	builder.WriteString("## 重要约束\n")
	if pb.capabilities.Rules.MaxNodes > 0 {
		builder.WriteString(fmt.Sprintf("- 最大节点数：%d\n", pb.capabilities.Rules.MaxNodes))
	} else {
		// MaxNodes <= 0 表示无限制
		builder.WriteString("- **节点数量**：根据用户需求的复杂程度灵活决定，不设上限。简单需求用少量节点，复杂需求可以使用更多节点\n")
	}
	builder.WriteString(fmt.Sprintf("- 应避免的节点类型：%s\n", strings.Join(pb.capabilities.Rules.AvoidNodeTypes, ", ")))
	builder.WriteString("- 每个节点必须包含：id（如 node-1, node-2）、type、position、data.config\n")
	builder.WriteString("- 每个边必须包含：source、target\n")
	builder.WriteString("- 变量引用必须引用实际存在的上游节点输出变量\n\n")

	builder.WriteString("## 输出要求\n")
	builder.WriteString("1. **对话风格**：保持自然、灵活的对话风格，根据用户的问题和上下文灵活回应\n")
	builder.WriteString("   - 不要使用固定的模板话术或格式化的开场白\n")
	builder.WriteString("   - 可以自然地解释、说明、建议，就像在和朋友聊天\n")
	builder.WriteString("2. **工作流输出**：当需要输出工作流时，必须在代码块前添加特殊标记 `<!-- workflow-json -->`\n")
	builder.WriteString("   - 格式：`<!-- workflow-json -->\\n```json\\n{...}\\n```\n")
	builder.WriteString("   - JSON代码块中的内容必须是有效的、可解析的 WorkflowExportData 格式\n")
	builder.WriteString("   - 可以在JSON代码块前后添加说明，但保持自然，不要使用固定模板\n")
	builder.WriteString("   - **重要**：只有工作流JSON需要添加此标记，其他JSON代码块不需要\n")
	builder.WriteString("3. **节点ID**：所有节点ID使用 node-1, node-2, node-3... 格式\n")
	builder.WriteString("4. **节点位置**：使用合理的坐标（建议垂直排列，y坐标递增140）\n")
	builder.WriteString("5. **必填字段**：节点配置必须包含所有必填字段\n")

	// 8. 相关知识库（按需加载）
	if len(pb.relevantKnowledge) > 0 {
		builder.WriteString("\n## 相关知识库\n")
		builder.WriteString("以下是根据你的需求检索到的相关知识，可以帮助你更好地生成工作流：\n\n")

		for i, kb := range pb.relevantKnowledge {
			// 根据类别添加标题
			categoryLabel := ""
			switch kb.Category {
			case "node_usage":
				categoryLabel = "节点使用说明"
			case "best_practice":
				categoryLabel = "最佳实践"
			case "error_repair":
				categoryLabel = "错误修复"
			case "scene_template":
				categoryLabel = "场景模板"
			default:
				categoryLabel = "知识库"
			}

			builder.WriteString(fmt.Sprintf("### %d. %s - %s\n", i+1, categoryLabel, kb.Title))
			if kb.Target != "" {
				builder.WriteString(fmt.Sprintf("**目标节点**: %s\n\n", kb.Target))
			}
			builder.WriteString(kb.Content)
			builder.WriteString("\n\n")
		}
	}

	return builder.String()
}

// writeWorkflowSchema 写入工作流格式定义
func (pb *PromptBuilder) writeWorkflowSchema(builder *strings.Builder) {
	schema := pb.capabilities.WorkflowSchema

	builder.WriteString("### 顶层字段\n")
	builder.WriteString("```json\n")
	builder.WriteString("{\n")
	builder.WriteString(fmt.Sprintf("  \"version\": \"%s\",\n", schema.Version))
	builder.WriteString("  \"exportedAt\": \"2026-01-19T00:00:00.000Z\",  // ISO8601格式\n")
	builder.WriteString("  \"name\": \"工作流名称（可选）\",\n")
	builder.WriteString("  \"description\": \"工作流描述（可选）\",\n")
	builder.WriteString("  \"nodes\": [],  // 节点数组（必填）\n")
	builder.WriteString("  \"edges\": []   // 边数组（必填）\n")
	builder.WriteString("}\n")
	builder.WriteString("```\n\n")

	builder.WriteString("### 节点格式 (NodeData)\n")
	builder.WriteString("```json\n")
	builder.WriteString("{\n")
	builder.WriteString("  \"id\": \"node-1\",  // 必填：节点ID\n")
	builder.WriteString("  \"type\": \"start\",  // 必填：节点类型\n")
	builder.WriteString("  \"position\": { \"x\": 0, \"y\": 0 },  // 可选：节点位置\n")
	builder.WriteString("  \"data\": {  // 可选：节点数据\n")
	builder.WriteString("    \"label\": \"开始\",  // 建议：显示名称\n")
	builder.WriteString("    \"type\": \"start\",  // 建议：与顶层type一致\n")
	builder.WriteString("    \"config\": {},  // 建议：节点配置\n")
	builder.WriteString("    \"connectionDirection\": \"vertical\"  // 建议：连接方向\n")
	builder.WriteString("  }\n")
	builder.WriteString("}\n")
	builder.WriteString("```\n\n")

	builder.WriteString("### 边格式 (EdgeData)\n")
	builder.WriteString("```json\n")
	builder.WriteString("{\n")
	builder.WriteString("  \"id\": \"e-1-2\",  // 可选：边ID\n")
	builder.WriteString("  \"source\": \"node-1\",  // 必填：源节点ID\n")
	builder.WriteString("  \"target\": \"node-2\",  // 必填：目标节点ID\n")
	builder.WriteString("  \"sourceHandle\": \"true\",  // 可选：条件节点的true/false分支\n")
	builder.WriteString("  \"targetHandle\": \"input-0\"  // 可选：合并节点的input-0/input-1\n")
	builder.WriteString("}\n")
	builder.WriteString("```\n")
}

// writeNodeTypes 写入节点类型说明
func (pb *PromptBuilder) writeNodeTypes(builder *strings.Builder) {
	for _, nodeType := range pb.capabilities.NodeTypes {
		if nodeType.Stability == "stub" {
			continue // 跳过未实现的节点
		}

		builder.WriteString(fmt.Sprintf("### %s (%s) - %s\n", nodeType.Label, nodeType.Type, nodeType.Description))
		builder.WriteString(fmt.Sprintf("**稳定性**: %s\n\n", nodeType.Stability))

		// 输入变量
		if len(nodeType.Inputs) > 0 {
			builder.WriteString("**输入变量**:\n")
			for _, input := range nodeType.Inputs {
				required := ""
				if input.Required {
					required = " (必填)"
				}
				builder.WriteString(fmt.Sprintf("- `%s`: %s - %s%s\n", input.Variable, input.Type, input.Description, required))
			}
			builder.WriteString("\n")
		}

		// 输出变量
		if len(nodeType.Outputs) > 0 {
			builder.WriteString("**输出变量**:\n")
			for _, output := range nodeType.Outputs {
				builder.WriteString(fmt.Sprintf("- `%s`: %s - %s\n", output.Variable, output.Type, output.Description))
			}
			builder.WriteString("\n")
		}

		// 配置规则
		if len(nodeType.ConfigRules.Required) > 0 {
			builder.WriteString("**必填配置字段**:\n")
			for _, field := range nodeType.ConfigRules.Required {
				builder.WriteString(fmt.Sprintf("- `%s`\n", field))
			}
			builder.WriteString("\n")
		}

		// 枚举值
		if len(nodeType.ConfigRules.Enums) > 0 {
			builder.WriteString("**配置字段枚举值**:\n")
			for field, values := range nodeType.ConfigRules.Enums {
				builder.WriteString(fmt.Sprintf("- `%s`: %s\n", field, strings.Join(values, ", ")))
			}
			builder.WriteString("\n")
		}

		// 允许变量引用的字段
		if len(nodeType.ConfigRules.AllowVars) > 0 {
			builder.WriteString("**允许使用变量引用的字段**:\n")
			for _, field := range nodeType.ConfigRules.AllowVars {
				builder.WriteString(fmt.Sprintf("- `%s`: 可使用 `{{上游节点ID.变量名}}` 格式\n", field))
			}
			builder.WriteString("\n")
		}

		// 默认配置
		if len(nodeType.Config) > 0 {
			builder.WriteString("**默认配置示例**:\n")
			builder.WriteString("```json\n")
			builder.WriteString(fmt.Sprintf("%+v\n", nodeType.Config))
			builder.WriteString("```\n\n")
		}

		builder.WriteString("---\n\n")
	}
}

// writeVariableRules 写入变量引用规则
func (pb *PromptBuilder) writeVariableRules(builder *strings.Builder) {
	builder.WriteString("### 变量引用语法\n")
	builder.WriteString(fmt.Sprintf("格式：`%s`\n\n", pb.capabilities.Rules.VariableSyntax))

	builder.WriteString("### 常见变量引用示例\n")
	builder.WriteString("- 引用 start 节点的 data: `{{node-1.data}}`\n")
	builder.WriteString("- 引用 start 节点的 url: `{{node-1.data.url}}`\n")
	builder.WriteString("- 引用 crawler 节点的 text: `{{node-2.text}}`\n")
	builder.WriteString("- 引用 dataclean 节点的 cleaned: `{{node-3.cleaned}}`\n")
	builder.WriteString("- 引用 ai 节点的 result: `{{node-4.result}}`\n\n")

	builder.WriteString("### 变量引用规则\n")
	builder.WriteString("1. 只能引用上游节点的输出变量\n")
	builder.WriteString("2. 变量名必须与节点输出定义一致\n")
	builder.WriteString("3. 支持嵌套访问，如 `{{node-1.data.url}}`\n")
	builder.WriteString("4. 变量引用必须在支持的字段中使用（如 urlVariable, dataVariable, contentVariable）\n")
}

// writeConnectionRules 写入连接规则
func (pb *PromptBuilder) writeConnectionRules(builder *strings.Builder) {
	for _, rule := range pb.capabilities.Rules.ConnectionRules {
		builder.WriteString(fmt.Sprintf("- %s\n", rule))
	}
}

// writeExampleTemplate 写入示例模板
func (pb *PromptBuilder) writeExampleTemplate(builder *strings.Builder) {
	builder.WriteString(fmt.Sprintf("**推荐模板**: %s\n\n", pb.capabilities.Template.Description))
	builder.WriteString(fmt.Sprintf("节点序列: %s\n\n", strings.Join(pb.capabilities.Template.MinimalFlow, " → ")))

	builder.WriteString("**完整示例JSON**（仅作参考，需要根据实际需求调整）:\n")
	builder.WriteString("```json\n")
	builder.WriteString(`{
  "version": "1.0.0",
  "exportedAt": "2026-01-19T00:00:00.000Z",
  "name": "示例工作流",
  "nodes": [
    {
      "id": "node-1",
      "type": "start",
      "position": { "x": 0, "y": 0 },
      "data": {
        "label": "开始",
        "type": "start",
        "config": {
          "trigger": "manual",
          "inputDataType": "json",
          "inputData": "{\"url\": \"https://example.com\"}"
        }
      }
    },
    {
      "id": "node-2",
      "type": "crawler",
      "position": { "x": 0, "y": 140 },
      "data": {
        "label": "爬虫",
        "type": "crawler",
        "config": {
          "urlVariable": "{{node-1.data.url}}",
          "method": "GET",
          "extractMode": "smart",
          "extractType": "text"
        }
      }
    },
    {
      "id": "node-3",
      "type": "dataclean",
      "position": { "x": 0, "y": 280 },
      "data": {
        "label": "数据清洗",
        "type": "dataclean",
        "config": {
          "dataVariable": "{{node-2.text}}",
          "cleanType": "text",
          "trim": true
        }
      }
    },
    {
      "id": "node-4",
      "type": "ai",
      "position": { "x": 0, "y": 420 },
      "data": {
        "label": "AI处理",
        "type": "ai",
        "config": {
          "contentVariable": "{{node-3.cleaned}}",
          "prompt": "请总结以下内容",
          "provider": "deepseek",
          "modelName": "deepseek-chat",
          "temperature": 0.2
        }
      }
    },
    {
      "id": "node-5",
      "type": "output",
      "position": { "x": 0, "y": 560 },
      "data": {
        "label": "输出",
        "type": "output",
        "config": {
          "format": "markdown",
          "destination": "file"
        }
      }
    },
    {
      "id": "node-6",
      "type": "end",
      "position": { "x": 0, "y": 700 },
      "data": {
        "label": "结束",
        "type": "end",
        "config": {
          "action": "none"
        }
      }
    }
  ],
  "edges": [
    { "id": "e-1-2", "source": "node-1", "target": "node-2" },
    { "id": "e-2-3", "source": "node-2", "target": "node-3" },
    { "id": "e-3-4", "source": "node-3", "target": "node-4" },
    { "id": "e-4-5", "source": "node-4", "target": "node-5" },
    { "id": "e-5-6", "source": "node-5", "target": "node-6" }
  ]
}`)
	builder.WriteString("\n```\n")
}
