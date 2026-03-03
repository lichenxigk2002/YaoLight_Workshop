package services

import "fmt"

// executeEndNode 执行结束节点
func (e *WorkflowExecutor) executeEndNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "end",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "end",
		Success: true,
		Data: map[string]interface{}{
			"message":   "工作流结束",
			"finalData": ExtractPayload(inputData),
		},
	}
}
