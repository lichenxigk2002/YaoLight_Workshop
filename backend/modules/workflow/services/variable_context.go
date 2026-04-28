package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"
	log "yaolight-workshop/backend/infrastructure/logx"
)

// NodeVariable 节点变量定义
type NodeVariable struct {
	Variable    string      `json:"variable"`          // 变量名，如 "url", "content"
	Label       string      `json:"label"`             // 显示名称，如 "URL地址", "内容"
	Type        string      `json:"type"`              // 类型：string, number, object, array, any
	Required    bool        `json:"required"`          // 是否必需
	Description string      `json:"description"`       // 描述
	Default     interface{} `json:"default,omitempty"` // 默认值
}

// NodeIODefinition 节点输入输出定义
type NodeIODefinition struct {
	Inputs  []NodeVariable `json:"inputs"`  // 输入变量列表
	Outputs []NodeVariable `json:"outputs"` // 输出变量列表
}

// VariableContext 变量上下文
// 存储所有已执行节点的输出变量，供下游节点引用
type VariableContext struct {
	mu sync.RWMutex
	// 格式：nodeId.variableName -> value
	// 例如：{"crawler_1.data": {...}, "crawler_1.text": "...", "dataclean_1.cleaned": [...]}
	variables map[string]interface{}
	// 节点输出数据（完整数据）
	nodeOutputs map[string]*NodeData
	// 节点类型映射（用于获取输出定义）
	nodeTypes map[string]string
}

// NewVariableContext 创建变量上下文
func NewVariableContext() *VariableContext {
	return &VariableContext{
		variables:   make(map[string]interface{}),
		nodeOutputs: make(map[string]*NodeData),
		nodeTypes:   make(map[string]string),
	}
}

// SetNodeType 设置节点类型
func (vc *VariableContext) SetNodeType(nodeID, nodeType string) {
	vc.mu.Lock()
	defer vc.mu.Unlock()
	vc.nodeTypes[nodeID] = nodeType
}

// SetNodeOutput 设置节点输出（同时提取变量）
func (vc *VariableContext) SetNodeOutput(nodeID string, data *NodeData) {
	vc.mu.Lock()
	defer vc.mu.Unlock()
	vc.nodeOutputs[nodeID] = data

	// 获取节点类型
	nodeType, exists := vc.nodeTypes[nodeID]
	if !exists {
		return
	}

	// 获取节点输出定义
	def, exists := GetNodeIODefinition(nodeType)
	if !exists {
		// 如果没有定义，尝试从数据中自动提取
		vc.extractVariablesFromData(nodeID, data)
		return
	}

	// 提取每个输出变量
	payload := ExtractPayload(data)
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	for _, outputVar := range def.Outputs {
		var value interface{}

		// 从payload中提取变量值
		// 优先使用变量名作为key
		if val, exists := payloadMap[outputVar.Variable]; exists {
			value = val
		} else {
			// 尝试从data字段中提取
			if dataField, ok := payloadMap["data"]; ok {
				if dataMap, ok := dataField.(map[string]interface{}); ok {
					if val, exists := dataMap[outputVar.Variable]; exists {
						value = val
					}
				}
			}
		}

		// 如果还是找不到，尝试从根数据中查找
		if value == nil {
			value = vc.findValueInPayload(payload, outputVar.Variable)
		}

		// 如果仍然找不到，且变量名是"data"，使用整个payload作为值（适用于开始节点等）
		if value == nil && outputVar.Variable == "data" {
			value = payload
			log.Printf("使用整个payload作为data变量: %v", value)
		}

		// 存储变量：nodeId.variableName
		if value != nil {
			varKey := fmt.Sprintf("%s.%s", nodeID, outputVar.Variable)
			vc.variables[varKey] = value
			log.Printf("提取变量: %s = %v (类型: %T)", varKey, value, value)
			// 如果是对象，打印其键
			if obj, ok := value.(map[string]interface{}); ok {
				keys := make([]string, 0, len(obj))
				for k := range obj {
					keys = append(keys, k)
				}
				log.Printf("变量 %s 是对象，包含字段: %v", varKey, keys)
			}
		} else {
			log.Printf("警告: 无法提取变量 %s.%s", nodeID, outputVar.Variable)
		}
	}
}

// extractVariablesFromData 从数据中自动提取变量
func (vc *VariableContext) extractVariablesFromData(nodeID string, data *NodeData) {
	payload := ExtractPayload(data)
	if payloadMap, ok := payload.(map[string]interface{}); ok {
		for key, value := range payloadMap {
			varKey := fmt.Sprintf("%s.%s", nodeID, key)
			vc.variables[varKey] = value
		}
	}
}

// findValueInPayload 在payload中查找值
func (vc *VariableContext) findValueInPayload(payload interface{}, variableName string) interface{} {
	if payloadMap, ok := payload.(map[string]interface{}); ok {
		// 直接查找
		if val, exists := payloadMap[variableName]; exists {
			return val
		}
		// 递归查找
		for _, v := range payloadMap {
			if result := vc.findValueInPayload(v, variableName); result != nil {
				return result
			}
		}
	}
	return nil
}

// GetVariable 获取变量值
// 支持路径：
//   - nodeId.variableName（完整路径）
//   - nodeId.variableName.field（路径访问，从对象中提取字段）
//   - variableName（自动查找）
func (vc *VariableContext) GetVariable(path string) (interface{}, error) {
	vc.mu.RLock()
	defer vc.mu.RUnlock()
	if path == "" {
		return nil, fmt.Errorf("变量路径为空")
	}

	// 如果包含点号，说明是完整路径
	if strings.Contains(path, ".") {
		// 先尝试直接查找
		if value, exists := vc.variables[path]; exists {
			return value, nil
		}

		// 尝试路径访问（如 nodeId.variable.field）
		parts := strings.Split(path, ".")
		if len(parts) >= 3 {
			// 构建基础变量路径：nodeId.variable
			basePath := strings.Join(parts[:2], ".")
			if baseValue, exists := vc.variables[basePath]; exists {
				// 使用 GetDataByPath 访问嵌套字段
				fieldPath := strings.Join(parts[2:], ".")
				log.Printf("GetVariable: 从 %s 访问字段 %s，baseValue类型: %T", basePath, fieldPath, baseValue)
				result, err := GetDataByPath(baseValue, fieldPath)
				if err == nil && result != nil {
					log.Printf("GetVariable: 成功从 %s 获取字段 %s，值: %v", basePath, fieldPath, result)
					return result, nil
				}
				// 如果 GetDataByPath 失败，记录日志但不返回错误，继续尝试其他方法
				log.Printf("警告: 无法从 %s 访问字段 %s: %v，baseValue: %v", basePath, fieldPath, err, baseValue)
			} else {
				log.Printf("警告: 变量 %s 不存在", basePath)
			}
		}

		// 如果路径访问失败，尝试逐步查找（支持更深层的路径）
		// 例如：node-9.data.url 可以尝试：
		// 1. node-9.data.url (直接查找)
		// 2. node-9.data -> 然后访问 url 字段
		// 3. node-9 -> 然后访问 data.url 字段
		for i := len(parts) - 1; i >= 1; i-- {
			basePath := strings.Join(parts[:i], ".")
			fieldPath := strings.Join(parts[i:], ".")
			if baseValue, exists := vc.variables[basePath]; exists {
				result, err := GetDataByPath(baseValue, fieldPath)
				if err == nil && result != nil {
					return result, nil
				}
			}
		}

		// 如果指定的节点ID不存在，尝试从所有节点中查找相同的变量路径（忽略节点ID）
		if len(parts) >= 2 {
			variablePath := strings.Join(parts[1:], ".") // 去掉节点ID，保留变量路径
			log.Printf("GetVariable: 指定的节点ID %s 不存在，尝试从所有节点中查找变量路径: %s", parts[0], variablePath)

			// 遍历所有变量，查找匹配的变量路径
			for key, value := range vc.variables {
				keyParts := strings.Split(key, ".")
				if len(keyParts) >= 2 {
					keyVariablePath := strings.Join(keyParts[1:], ".")
					// 如果变量路径匹配，尝试访问嵌套字段
					if keyVariablePath == variablePath {
						log.Printf("GetVariable: 找到匹配的变量路径: %s -> %s", key, variablePath)
						return value, nil
					}
					// 如果变量路径是前缀，尝试访问嵌套字段
					// 例如：查找 data.url，找到 start.data，然后访问 url 字段
					if strings.HasPrefix(variablePath, keyVariablePath+".") {
						fieldPath := strings.TrimPrefix(variablePath, keyVariablePath+".")
						result, err := GetDataByPath(value, fieldPath)
						if err == nil && result != nil {
							log.Printf("GetVariable: 从 %s 成功获取字段 %s，值: %v", key, fieldPath, result)
							return result, nil
						}
					}
					// 如果变量路径是后缀，尝试从父对象访问
					if strings.HasPrefix(keyVariablePath, variablePath+".") {
						// 这种情况已经在上面处理过了
					} else if strings.HasSuffix(keyVariablePath, "."+variablePath) {
						// 例如：查找 url，找到 start.data.url
						log.Printf("GetVariable: 找到包含目标路径的变量: %s", key)
						return value, nil
					}
				}
			}

			if len(parts) >= 3 && parts[1] == "data" {
				fieldName := parts[2] // 提取字段名，如 "link"
				log.Printf("GetVariable: 尝试从所有 data 对象中查找字段: %s", fieldName)
				for key, value := range vc.variables {
					keyParts := strings.Split(key, ".")
					if len(keyParts) >= 2 && keyParts[1] == "data" {
						if dataMap, ok := value.(map[string]interface{}); ok {
							if fieldValue, exists := dataMap[fieldName]; exists {
								log.Printf("GetVariable: 从 %s 中找到字段 %s，值: %v", key, fieldName, fieldValue)
								return fieldValue, nil
							}
							urlFields := []string{"url", "link", "href", "src"}
							for _, urlField := range urlFields {
								if urlValue, exists := dataMap[urlField]; exists {
									if urlStr, ok := urlValue.(string); ok && urlStr != "" {
										log.Printf("GetVariable: 从 %s 中找到URL字段 %s，值: %v", key, urlField, urlStr)
										return urlStr, nil
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// 否则在所有节点中查找该变量名（返回第一个匹配的）
	for key, value := range vc.variables {
		parts := strings.Split(key, ".")
		if len(parts) == 2 && parts[1] == path {
			return value, nil
		}
	}

	return nil, fmt.Errorf("变量 %s 不存在", path)
}

// GetAllVariables 获取所有变量
func (vc *VariableContext) GetAllVariables() map[string]interface{} {
	return vc.variables
}

// ResolveTemplate 解析模板字符串
// 支持 {{nodeId.variableName}} 或 {{variableName}} 语法
func (vc *VariableContext) ResolveTemplate(template string) (string, error) {
	if template == "" {
		return "", nil
	}

	// 使用正则表达式匹配 {{...}}
	re := regexp.MustCompile(`\{\{([^}]+)\}\}`)

	result := re.ReplaceAllStringFunc(template, func(match string) string {
		// 提取变量名
		varName := strings.Trim(match, "{{}}")
		varName = strings.TrimSpace(varName)

		// 获取变量值
		value, err := vc.GetVariable(varName)
		if err != nil {
			// 如果找不到变量，保持原样（或者返回空字符串）
			return match
		}

		// 转换为字符串
		if value == nil {
			return ""
		}

		// 如果是对象或数组，转换为JSON
		switch v := value.(type) {
		case map[string]interface{}, []interface{}:
			jsonBytes, err := json.Marshal(v)
			if err == nil {
				return string(jsonBytes)
			}
		}

		return fmt.Sprintf("%v", value)
	})

	return result, nil
}

// ResolveTemplateToInterface 解析模板并返回interface{}类型
func (vc *VariableContext) ResolveTemplateToInterface(template string) (interface{}, error) {
	if template == "" {
		return nil, nil
	}

	// 检查是否是纯变量引用 {{variable}}
	re := regexp.MustCompile(`^\{\{([^}]+)\}\}$`)
	matches := re.FindStringSubmatch(template)
	if len(matches) == 2 {
		varName := strings.TrimSpace(matches[1])
		value, err := vc.GetVariable(varName)
		if err == nil {
			return value, nil
		}
	}

	// 否则作为字符串模板解析
	resolved, err := vc.ResolveTemplate(template)
	if err != nil {
		return nil, err
	}

	// 尝试解析为JSON
	var result interface{}
	if err := json.Unmarshal([]byte(resolved), &result); err == nil {
		return result, nil
	}

	return resolved, nil
}

// GetNodeIODefinition 获取节点输入输出定义
func GetNodeIODefinition(nodeType string) (NodeIODefinition, bool) {
	def, exists := nodeIODefinitions[nodeType]
	return def, exists
}

// GetNodeIODefinitions 获取节点输入输出定义映射
func GetNodeIODefinitions() map[string]NodeIODefinition {
	return nodeIODefinitions
}

// nodeIODefinitions 节点输入输出定义映射
var nodeIODefinitions = map[string]NodeIODefinition{
	"start": {
		Inputs: []NodeVariable{},
		Outputs: []NodeVariable{
			{Variable: "data", Label: "初始数据", Type: "object", Description: "开始节点的初始数据"},
		},
	},
	"crawler": {
		Inputs: []NodeVariable{
			{Variable: "url", Label: "URL地址", Type: "string", Required: false, Description: "要爬取的URL，可从上游节点获取"},
			{Variable: "headers", Label: "请求头", Type: "object", Required: false, Description: "HTTP请求头"},
		},
		Outputs: []NodeVariable{
			{Variable: "data", Label: "爬取数据", Type: "object", Description: "爬取到的数据对象"},
			{Variable: "html", Label: "HTML内容", Type: "string", Description: "原始HTML内容"},
			{Variable: "text", Label: "文本内容", Type: "string", Description: "提取的文本内容"},
		},
	},
	"dataclean": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "待清洗数据", Type: "any", Required: true, Description: "需要清洗的数据"},
		},
		Outputs: []NodeVariable{
			{Variable: "cleaned", Label: "清洗后数据", Type: "any", Description: "清洗后的数据"},
		},
	},
	"ai": {
		Inputs: []NodeVariable{
			{Variable: "content", Label: "输入内容", Type: "string", Required: true, Description: "AI处理的输入内容"},
		},
		Outputs: []NodeVariable{
			{Variable: "result", Label: "AI结果", Type: "string", Description: "AI处理的结果"},
		},
	},
	"condition": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "数据", Type: "any", Required: true, Description: "用于条件判断的数据"},
		},
		Outputs: []NodeVariable{
			{Variable: "result", Label: "判断结果", Type: "boolean", Description: "条件判断的结果"},
			{Variable: "data", Label: "原始数据", Type: "any", Description: "原始输入数据"},
		},
	},
	"transform": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "待转换数据", Type: "any", Required: true},
		},
		Outputs: []NodeVariable{
			{Variable: "transformed", Label: "转换后数据", Type: "any", Description: "转换后的数据"},
		},
	},
	"code": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "输入数据", Type: "any", Required: false, Description: "代码节点的输入数据"},
		},
		Outputs: []NodeVariable{
			{Variable: "result", Label: "执行结果", Type: "any", Description: "代码执行返回值"},
			{Variable: "stdout", Label: "标准输出", Type: "array", Description: "代码运行日志"},
			{Variable: "stderr", Label: "错误输出", Type: "array", Description: "代码运行错误日志"},
		},
	},
	"loop": {
		Inputs: []NodeVariable{
			{Variable: "items", Label: "循环项", Type: "array", Required: true, Description: "要循环的数据数组"},
		},
		Outputs: []NodeVariable{
			{Variable: "results", Label: "循环结果", Type: "array", Description: "循环处理后的结果数组"},
		},
	},
	"merge": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "数据", Type: "any", Required: false, Description: "要合并的数据（多个输入）"},
		},
		Outputs: []NodeVariable{
			{Variable: "merged", Label: "合并数据", Type: "object", Description: "合并后的数据"},
		},
	},
	"delay": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "数据", Type: "any", Required: false},
		},
		Outputs: []NodeVariable{
			{Variable: "data", Label: "数据", Type: "any", Description: "透传的输入数据"},
		},
	},
	"output": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "输出数据", Type: "any", Required: true},
		},
		Outputs: []NodeVariable{
			{Variable: "data", Label: "输出数据", Type: "any", Description: "输出的数据"},
			{Variable: "artifacts", Label: "输出制品", Type: "array", Description: "导出生成的文件/图片等制品列表"},
		},
	},
	"end": {
		Inputs: []NodeVariable{
			{Variable: "data", Label: "最终数据", Type: "any", Required: false},
		},
		Outputs: []NodeVariable{},
	},
}
