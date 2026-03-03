package services

import (
	"fmt"
	"reflect"
	"strings"
)

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

	loopType := strings.ToLower(strings.TrimSpace(getString(node.Config, "loopType", "foreach")))
	itemsSpec := getString(node.Config, "items", "")
	if loopType == "" {
		loopType = "foreach"
	}
	if loopType != "foreach" {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "loop",
			Success: false,
			Error:   fmt.Sprintf("暂不支持的 loopType: %s（当前仅支持 foreach）", loopType),
		}
	}

	payload := ExtractPayload(inputData)
	var itemsValue interface{}
	if strings.TrimSpace(itemsSpec) == "" {
		itemsValue = payload
	} else if strings.Contains(itemsSpec, "{{") {
		resolved, err := variableContext.ResolveTemplateToInterface(itemsSpec)
		if err != nil {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "loop",
				Success: false,
				Error:   fmt.Sprintf("解析 items 变量失败: %v", err),
				Data: map[string]interface{}{
					"items": itemsSpec,
				},
			}
		}
		itemsValue = resolved
	} else {
		v, found, err := TryGetDataByPath(payload, itemsSpec)
		if err != nil {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "loop",
				Success: false,
				Error:   fmt.Sprintf("获取 items 路径失败: %v", err),
				Data: map[string]interface{}{
					"items": itemsSpec,
				},
			}
		}
		if !found {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "loop",
				Success: false,
				Error:   fmt.Sprintf("items 路径不存在: %s", itemsSpec),
				Data: map[string]interface{}{
					"items": itemsSpec,
				},
			}
		}
		itemsValue = v
	}

	itemsArr, ok := toInterfaceSlice(itemsValue)
	if !ok {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "loop",
			Success: false,
			Error:   "foreach 需要数组作为输入（items）",
			Data: map[string]interface{}{
				"items": itemsSpec,
			},
		}
	}

	results := append([]interface{}{}, itemsArr...)

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "loop",
		Success: true,
		Data: map[string]interface{}{
			"results": results,
		},
	}
}

func toInterfaceSlice(v interface{}) ([]interface{}, bool) {
	if v == nil {
		return nil, false
	}
	if arr, ok := v.([]interface{}); ok {
		return arr, true
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {
		out := make([]interface{}, 0, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			out = append(out, rv.Index(i).Interface())
		}
		return out, true
	}
	return nil, false
}
