package services

import (
	"fmt"
	"strings"
)

// executeConditionNode 执行条件节点
func (e *WorkflowExecutor) executeConditionNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "condition",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取条件配置
	field := getString(node.Config, "field", "")
	fieldVariable := getString(node.Config, "fieldVariable", "")
	operator := getString(node.Config, "operator", "==")
	value := node.Config["value"]
	valueVariable := getString(node.Config, "valueVariable", "")
	missingAs := strings.ToLower(strings.TrimSpace(getString(node.Config, "missingAs", "false")))

	// 如果配置了字段变量，优先使用变量值
	if fieldVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(fieldVariable)
		if err == nil {
			if str, ok := resolved.(string); ok {
				field = str
			} else {
				field = fmt.Sprintf("%v", resolved)
			}
		}
	}
	if strings.Contains(field, "{{") {
		resolved, err := variableContext.ResolveTemplate(field)
		if err == nil && strings.TrimSpace(resolved) != "" {
			field = resolved
		}
	}

	// 如果配置了值变量，优先使用变量值
	if valueVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(valueVariable)
		if err == nil {
			value = resolved
		}
	} else if s, ok := value.(string); ok && strings.Contains(s, "{{") {
		resolved, err := variableContext.ResolveTemplateToInterface(s)
		if err == nil {
			value = resolved
		}
	}

	if field == "" {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "condition",
			Success: false,
			Error:   "条件字段为空",
		}
	}

	// 从输入数据中获取字段值
	fieldValue, found, err := TryGetDataByPath(ExtractPayload(inputData), field)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "condition",
			Success: false,
			Error:   fmt.Sprintf("获取字段值失败: %v", err),
		}
	}
	if !found {
		switch missingAs {
		case "true":
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "condition",
				Success: true,
				Data: map[string]interface{}{
					"result":       true,
					"field":        field,
					"fieldValue":   nil,
					"operator":     operator,
					"compareValue": value,
					"data":         ExtractPayload(inputData),
				},
			}
		case "error":
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "condition",
				Success: false,
				Error:   fmt.Sprintf("字段不存在: %s", field),
			}
		default:
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "condition",
				Success: true,
				Data: map[string]interface{}{
					"result":       false,
					"field":        field,
					"fieldValue":   nil,
					"operator":     operator,
					"compareValue": value,
					"data":         ExtractPayload(inputData),
				},
			}
		}
	}

	// 执行条件判断
	result := evaluateConditionAny(fieldValue, operator, value)

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "condition",
		Success: true,
		Data: map[string]interface{}{
			"result":       result,
			"field":        field,
			"fieldValue":   fieldValue,
			"operator":     operator,
			"compareValue": value,
			// 传递原始数据
			"data": ExtractPayload(inputData),
		},
	}
}
