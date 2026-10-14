package services

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// executeTransformNode 执行转换节点
func (e *WorkflowExecutor) executeTransformNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "transform",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 获取转换规则
	transformType := strings.ToLower(strings.TrimSpace(getString(node.Config, "transformType", "")))
	script := getString(node.Config, "script", "")

	// 获取原始数据
	originalData := ExtractPayload(inputData)

	transformedData, err := transformData(variableContext, transformType, originalData, script)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "transform",
			Success: false,
			Error:   fmt.Sprintf("转换失败: %v", err),
			Data: map[string]interface{}{
				"transformType": transformType,
			},
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "transform",
		Success: true,
		Data: map[string]interface{}{
			"transformed": transformedData,
		},
	}
}

func transformData(variableContext *VariableContext, transformType string, originalData interface{}, script string) (interface{}, error) {
	if transformType == "" {
		transformType = "map"
	}

	switch transformType {
	case "passthrough":
		return originalData, nil
	case "map":
		trimmed := strings.TrimSpace(script)
		// 兼容历史模板：过去把 map + {} 当成“透传”使用，这里兜底按透传处理
		if trimmed == "" || trimmed == "{}" {
			return originalData, nil
		}
		var mapping map[string]interface{}
		if err := json.Unmarshal([]byte(script), &mapping); err != nil {
			return nil, fmt.Errorf("script 需要是 JSON 对象（如 {\"title\":\"data.title\"}）：%v", err)
		}
		out := make(map[string]interface{}, len(mapping))
		for outKey, spec := range mapping {
			switch v := spec.(type) {
			case string:
				vv := strings.TrimSpace(v)
				if strings.Contains(vv, "{{") {
					resolved, err := variableContext.ResolveTemplateToInterface(vv)
					if err == nil {
						out[outKey] = resolved
						continue
					}
				}
				val, found, err := TryGetDataByPath(originalData, vv)
				if err != nil {
					return nil, err
				}
				if found {
					out[outKey] = val
				} else {
					out[outKey] = nil
				}
			default:
				out[outKey] = v
			}
		}
		return out, nil
	case "filter":
		list := normalizeToList(originalData)
		if list == nil {
			return []interface{}{}, nil
		}
		var cfg map[string]interface{}
		if strings.TrimSpace(script) != "" {
			if err := json.Unmarshal([]byte(script), &cfg); err != nil {
				return nil, fmt.Errorf("script 需要是 JSON 对象（如 {\"field\":\"name\",\"operator\":\"contains\",\"value\":\"abc\"}）：%v", err)
			}
		} else {
			cfg = map[string]interface{}{}
		}
		field, _ := cfg["field"].(string)
		operator, _ := cfg["operator"].(string)
		value := cfg["value"]
		filtered := make([]interface{}, 0)
		for _, it := range list {
			fv := it
			if strings.TrimSpace(field) != "" {
				v, found, err := TryGetDataByPath(it, field)
				if err != nil {
					return nil, err
				}
				if !found {
					continue
				}
				fv = v
			}
			if evaluateConditionAny(fv, operator, value) {
				filtered = append(filtered, it)
			}
		}
		return filtered, nil
	case "sort":
		list := normalizeToList(originalData)
		if list == nil {
			return []interface{}{}, nil
		}
		var cfg map[string]interface{}
		if strings.TrimSpace(script) != "" {
			if err := json.Unmarshal([]byte(script), &cfg); err != nil {
				return nil, fmt.Errorf("script 需要是 JSON 对象（如 {\"field\":\"score\",\"order\":\"asc\"}）：%v", err)
			}
		} else {
			cfg = map[string]interface{}{}
		}
		field, _ := cfg["field"].(string)
		order, _ := cfg["order"].(string)
		desc := strings.EqualFold(strings.TrimSpace(order), "desc")
		sorted := append([]interface{}{}, list...)
		sort.SliceStable(sorted, func(i, j int) bool {
			ai := sorted[i]
			aj := sorted[j]
			vi := ai
			vj := aj
			if strings.TrimSpace(field) != "" {
				if v, found, _ := TryGetDataByPath(ai, field); found {
					vi = v
				} else {
					vi = nil
				}
				if v, found, _ := TryGetDataByPath(aj, field); found {
					vj = v
				} else {
					vj = nil
				}
			}
			if vi == nil && vj == nil {
				return false
			}
			if vi == nil {
				return !desc
			}
			if vj == nil {
				return desc
			}
			if afi, okI := toFloat64(vi); okI {
				if afj, okJ := toFloat64(vj); okJ {
					if desc {
						return afi > afj
					}
					return afi < afj
				}
			}
			si := fmt.Sprintf("%v", vi)
			sj := fmt.Sprintf("%v", vj)
			if desc {
				return si > sj
			}
			return si < sj
		})
		return sorted, nil
	case "group":
		list := normalizeToList(originalData)
		if list == nil {
			return map[string]interface{}{}, nil
		}
		var cfg map[string]interface{}
		if strings.TrimSpace(script) != "" {
			if err := json.Unmarshal([]byte(script), &cfg); err != nil {
				return nil, fmt.Errorf("script 需要是 JSON 对象（如 {\"field\":\"category\"}）：%v", err)
			}
		} else {
			cfg = map[string]interface{}{}
		}
		field, _ := cfg["field"].(string)
		out := make(map[string][]interface{})
		for _, it := range list {
			key := ""
			if strings.TrimSpace(field) != "" {
				if v, found, err := TryGetDataByPath(it, field); err != nil {
					return nil, err
				} else if found {
					key = fmt.Sprintf("%v", v)
				}
			}
			out[key] = append(out[key], it)
		}
		res := make(map[string]interface{}, len(out))
		for k, v := range out {
			res[k] = v
		}
		return res, nil
	default:
		return originalData, nil
	}
}
