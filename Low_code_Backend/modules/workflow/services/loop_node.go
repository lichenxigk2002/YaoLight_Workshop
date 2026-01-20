package services

import "fmt"

// executeLoopNode 执行循环节点
func (e *WorkflowExecutor) executeLoopNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "loop",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取循环配置
	loopType := getString(node.Config, "loopType", "foreach")
	items := getString(node.Config, "items", "")

	// TODO: 实现循环逻辑
	// 目前只是传递数据
	results := make([]interface{}, 0)
	if loopType == "foreach" && items != "" {
		// 从输入数据中获取要遍历的数组
		itemsData, err := GetDataByPath(ExtractPayload(inputData), items)
		if err == nil {
			if arr, ok := itemsData.([]interface{}); ok {
				for _, item := range arr {
					results = append(results, item)
				}
			}
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "loop",
		Success: true,
		Data: map[string]interface{}{
			"loopType": loopType,
			"results":  results,
			"count":    len(results),
		},
	}
}
