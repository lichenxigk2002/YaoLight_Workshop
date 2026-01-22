package services

import "fmt"

// executeMergeNode 执行合并节点
func (e *WorkflowExecutor) executeMergeNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	// 获取所有上游节点的输入数据
	inputs, err := dataFlow.GetNodeInput(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	if len(inputs) == 0 {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   "合并节点没有输入数据",
		}
	}

	// 合并所有输入数据
	mergedData := MergeData(inputs...)

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "merge",
		Success: true,
		Data:    ExtractPayload(mergedData),
	}
}
