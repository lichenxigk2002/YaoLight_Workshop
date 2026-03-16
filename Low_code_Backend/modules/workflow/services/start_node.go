package services

import (
	"encoding/json"
	"strconv"
	"time"
)

// executeStartNode 执行开始节点
func (e *WorkflowExecutor) executeStartNode(node NodeConfig, dataFlow *DataFlow, meta ExecutionMeta) NodeExecutionResult {
	// 获取用户输入的数据
	inputData := getString(node.Config, "inputData", "")
	inputDataType := getString(node.Config, "inputDataType", "auto")

	var initialData map[string]interface{}

	if meta.RuntimeInput != nil {
		switch value := meta.RuntimeInput.(type) {
		case map[string]interface{}:
			initialData = value
		default:
			initialData = map[string]interface{}{
				"data": value,
			}
		}
		initialData["timestamp"] = time.Now().Unix()
		if len(meta.RuntimeMeta) > 0 {
			initialData["_runtime"] = meta.RuntimeMeta
		}
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "start",
			Success: true,
			Data:    initialData,
		}
	}

	// 如果用户输入了数据，使用用户输入
	if inputData != "" {
		switch inputDataType {
		case "json":
			// 强制按JSON解析
			var jsonData interface{}
			if err := json.Unmarshal([]byte(inputData), &jsonData); err == nil {
				// 如果解析成功，包装成对象
				if obj, ok := jsonData.(map[string]interface{}); ok {
					initialData = obj
				} else {
					// 如果不是对象，包装在data字段中
					initialData = map[string]interface{}{
						"data": jsonData,
					}
				}
			} else {
				// JSON解析失败，作为字符串处理
				initialData = map[string]interface{}{
					"data": inputData,
				}
			}
		case "url":
			// URL格式：包装在url字段中
			initialData = map[string]interface{}{
				"url": inputData,
			}
		case "number":
			// 数字格式：尝试转换为数字
			if num, err := strconv.ParseFloat(inputData, 64); err == nil {
				initialData = map[string]interface{}{
					"data": num,
				}
			} else {
				// 转换失败，作为字符串
				initialData = map[string]interface{}{
					"data": inputData,
				}
			}
		case "text":
			// 文本格式：作为字符串
			initialData = map[string]interface{}{
				"data": inputData,
			}
		case "string":
			// 兼容旧版本：作为字符串
			initialData = map[string]interface{}{
				"data": inputData,
			}
		case "auto":
			fallthrough
		default:
			// 自动检测：尝试解析JSON
			var jsonData interface{}
			if err := json.Unmarshal([]byte(inputData), &jsonData); err == nil {
				// JSON解析成功
				if obj, ok := jsonData.(map[string]interface{}); ok {
					initialData = obj
				} else {
					initialData = map[string]interface{}{
						"data": jsonData,
					}
				}
			} else {
				// 不是JSON，作为字符串
				initialData = map[string]interface{}{
					"data": inputData,
				}
			}
		}
		// 添加时间戳
		initialData["timestamp"] = time.Now().Unix()
	} else {
		// 没有用户输入，使用默认数据
		initialData = map[string]interface{}{
			"message":   "工作流开始",
			"timestamp": time.Now().Unix(),
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "start",
		Success: true,
		Data:    initialData,
	}
}
