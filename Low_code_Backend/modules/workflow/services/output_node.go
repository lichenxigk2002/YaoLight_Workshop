package services

import "fmt"

// executeOutputNode 执行输出节点
func (e *WorkflowExecutor) executeOutputNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "output",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取输出格式
	format := getString(node.Config, "format", "json")
	destination := getString(node.Config, "destination", "file")

	// TODO: 根据格式和目标执行实际的输出操作
	// 目前只是返回数据

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "output",
		Success: true,
		Data: map[string]interface{}{
			"format":      format,
			"destination": destination,
			"data":        ExtractPayload(inputData),
		},
	}
}
