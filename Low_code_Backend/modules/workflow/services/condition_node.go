package services

import "fmt"

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
	value := getString(node.Config, "value", "")
	valueVariable := getString(node.Config, "valueVariable", "")

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

	// 如果配置了值变量，优先使用变量值
	if valueVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(valueVariable)
		if err == nil {
			if str, ok := resolved.(string); ok {
				value = str
			} else {
				value = fmt.Sprintf("%v", resolved)
			}
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
	fieldValue, err := GetDataByPath(ExtractPayload(inputData), field)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "condition",
			Success: false,
			Error:   fmt.Sprintf("获取字段值失败: %v", err),
		}
	}

	// 执行条件判断
	result := evaluateCondition(fieldValue, operator, value)

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
