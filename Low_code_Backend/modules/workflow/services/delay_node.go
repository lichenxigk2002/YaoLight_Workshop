package services

import "time"

// executeDelayNode 执行延迟节点
func (e *WorkflowExecutor) executeDelayNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	// 获取延迟时间（秒）
	delaySeconds := getInt(node.Config, "seconds", 1)
	if delaySeconds <= 0 {
		delaySeconds = 1
	}

	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
	}

	// 执行延迟
	time.Sleep(time.Duration(delaySeconds) * time.Second)

	// 延迟节点应该传递上游数据，而不是生成新数据
	outputData := ExtractPayload(inputData)
	if outputData == nil {
		outputData = map[string]interface{}{
			"message":      "延迟完成",
			"delaySeconds": delaySeconds,
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "delay",
		Success: true,
		Data:    outputData,
	}
}
