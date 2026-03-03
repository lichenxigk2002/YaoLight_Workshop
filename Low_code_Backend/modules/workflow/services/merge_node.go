package services

import (
	"fmt"
	"strconv"
	"strings"
)

// executeMergeNode 执行合并节点
func (e *WorkflowExecutor) executeMergeNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
	mergeType := strings.ToLower(strings.TrimSpace(getString(node.Config, "mergeType", "concat")))

	inputsWithEdges, err := dataFlow.GetNodeInputWithEdges(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}
	if len(inputsWithEdges) == 0 {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   "合并节点没有输入数据",
		}
	}

	ordered := make([]*NodeData, 0, len(inputsWithEdges))
	indexed := make(map[int]*NodeData)
	maxIdx := -1
	fallback := make([]*NodeData, 0)
	for _, it := range inputsWithEdges {
		if it.Data == nil {
			continue
		}
		th := strings.ToLower(strings.TrimSpace(it.Edge.TargetHandle))
		if strings.HasPrefix(th, "input-") {
			nStr := strings.TrimPrefix(th, "input-")
			if n, err := strconv.Atoi(nStr); err == nil && n >= 0 {
				indexed[n] = it.Data
				if n > maxIdx {
					maxIdx = n
				}
				continue
			}
		}
		fallback = append(fallback, it.Data)
	}
	for i := 0; i <= maxIdx; i++ {
		if v, ok := indexed[i]; ok {
			ordered = append(ordered, v)
		}
	}
	ordered = append(ordered, fallback...)
	if len(ordered) == 0 {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   "合并节点没有可用的输入数据",
		}
	}

	mergedPayload, err := mergePayloads(mergeType, ordered)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "merge",
			Success: false,
			Error:   fmt.Sprintf("合并失败: %v", err),
			Data: map[string]interface{}{
				"mergeType": mergeType,
			},
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "merge",
		Success: true,
		Data: map[string]interface{}{
			"merged": mergedPayload,
		},
	}
}

func mergePayloads(mergeType string, inputs []*NodeData) (interface{}, error) {
	payloads := make([]interface{}, 0, len(inputs))
	for _, in := range inputs {
		payloads = append(payloads, ExtractPayload(in))
	}

	if mergeType == "" {
		mergeType = "concat"
	}

	switch mergeType {
	case "concat":
		allArrays := true
		allStrings := true
		for _, p := range payloads {
			if _, ok := p.([]interface{}); !ok {
				allArrays = false
			}
			if _, ok := p.(string); !ok {
				allStrings = false
			}
		}
		if allArrays {
			out := make([]interface{}, 0)
			for _, p := range payloads {
				out = append(out, p.([]interface{})...)
			}
			return out, nil
		}
		if allStrings {
			var b strings.Builder
			for _, p := range payloads {
				b.WriteString(p.(string))
			}
			return b.String(), nil
		}
		merged := make(map[string]interface{}, len(payloads))
		for i, p := range payloads {
			merged[fmt.Sprintf("input_%d", i)] = p
		}
		return merged, nil
	case "union", "intersect":
		arrays := make([][]interface{}, 0, len(payloads))
		for _, p := range payloads {
			arr, ok := p.([]interface{})
			if !ok {
				return nil, fmt.Errorf("mergeType=%s 仅支持数组输入", mergeType)
			}
			arrays = append(arrays, arr)
		}
		if len(arrays) == 0 {
			return []interface{}{}, nil
		}
		if mergeType == "union" {
			seen := make(map[string]bool)
			out := make([]interface{}, 0)
			for _, arr := range arrays {
				for _, it := range arr {
					k := fmt.Sprintf("%T:%v", it, it)
					if !seen[k] {
						seen[k] = true
						out = append(out, it)
					}
				}
			}
			return out, nil
		}
		count := make(map[string]int)
		items := make(map[string]interface{})
		for _, it := range arrays[0] {
			k := fmt.Sprintf("%T:%v", it, it)
			count[k] = 1
			items[k] = it
		}
		for i := 1; i < len(arrays); i++ {
			local := make(map[string]bool)
			for _, it := range arrays[i] {
				k := fmt.Sprintf("%T:%v", it, it)
				local[k] = true
			}
			for k := range count {
				if local[k] {
					count[k]++
				}
			}
		}
		out := make([]interface{}, 0)
		for k, c := range count {
			if c == len(arrays) {
				out = append(out, items[k])
			}
		}
		return out, nil
	default:
		merged := make(map[string]interface{}, len(payloads))
		for i, p := range payloads {
			merged[fmt.Sprintf("input_%d", i)] = p
		}
		return merged, nil
	}
}
