package services

import (
	"fmt"
	"reflect"
	"strings"
	"sync"
)

// NodeData 节点数据格式
// 统一的数据结构，所有节点都使用这个格式
type NodeData struct {
	// 数据内容，可以是任意类型
	Payload interface{} `json:"payload"`
	// 元数据
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	// 数据类型标识
	Type string `json:"type,omitempty"`
}

// NewNodeData 创建节点数据
func NewNodeData(payload interface{}) *NodeData {
	return &NodeData{
		Payload:  payload,
		Metadata: make(map[string]interface{}),
		Type:     getDataType(payload),
	}
}

// getDataType 获取数据类型标识
func getDataType(data interface{}) string {
	if data == nil {
		return "null"
	}
	return reflect.TypeOf(data).Kind().String()
}

// DataFlow 数据流管理器
type DataFlow struct {
	mu sync.RWMutex
	// 存储每个节点的输出数据
	nodeOutputs map[string]*NodeData
	// 存储边的数据传递关系
	edges []EdgeConfig
}

type NodeInput struct {
	Edge EdgeConfig
	Data *NodeData
}

// NewDataFlow 创建数据流管理器
func NewDataFlow(edges []EdgeConfig) *DataFlow {
	return &DataFlow{
		nodeOutputs: make(map[string]*NodeData),
		edges:       edges,
	}
}

// SetNodeOutput 设置节点的输出数据
func (df *DataFlow) SetNodeOutput(nodeID string, data *NodeData) {
	df.mu.Lock()
	defer df.mu.Unlock()
	df.nodeOutputs[nodeID] = data
}

// GetNodeOutput 获取节点的输出数据
func (df *DataFlow) GetNodeOutput(nodeID string) *NodeData {
	df.mu.RLock()
	defer df.mu.RUnlock()
	return df.nodeOutputs[nodeID]
}

// GetNodeInput 获取节点的输入数据
// 返回所有上游节点的输出数据
func (df *DataFlow) GetNodeInput(nodeID string) ([]*NodeData, error) {
	df.mu.RLock()
	defer df.mu.RUnlock()
	inputs := make([]*NodeData, 0)

	// 找到所有指向该节点的边
	for _, edge := range df.edges {
		if edge.Target == nodeID {
			// 获取上游节点的输出数据
			if output, exists := df.nodeOutputs[edge.Source]; exists {
				inputs = append(inputs, output)
			}
		}
	}

	return inputs, nil
}

func (df *DataFlow) GetNodeInputWithEdges(nodeID string) ([]NodeInput, error) {
	df.mu.RLock()
	defer df.mu.RUnlock()
	inputs := make([]NodeInput, 0)
	for _, edge := range df.edges {
		if edge.Target != nodeID {
			continue
		}
		ni := NodeInput{Edge: edge}
		if output, exists := df.nodeOutputs[edge.Source]; exists {
			ni.Data = output
		}
		inputs = append(inputs, ni)
	}
	return inputs, nil
}

// GetNodeInputData 获取节点的输入数据（合并后的数据）
// 如果有多个输入，会合并成一个数据对象
func (df *DataFlow) GetNodeInputData(nodeID string) (*NodeData, error) {
	inputs, err := df.GetNodeInput(nodeID)
	if err != nil {
		return nil, err
	}

	// 如果没有输入，返回空数据
	if len(inputs) == 0 {
		return NewNodeData(nil), nil
	}

	// 如果只有一个输入，直接返回
	if len(inputs) == 1 {
		return inputs[0], nil
	}

	// 多个输入，合并数据
	mergedPayload := make(map[string]interface{})
	for i, input := range inputs {
		key := fmt.Sprintf("input_%d", i)
		mergedPayload[key] = input.Payload
	}

	return NewNodeData(mergedPayload), nil
}

// GetDataByPath 根据路径获取数据
// 支持路径访问，如 "data.field" 或 "data.items[0]"
func GetDataByPath(data interface{}, path string) (interface{}, error) {
	if path == "" {
		return data, nil
	}

	parts := strings.Split(path, ".")
	current := data

	for _, part := range parts {
		if current == nil {
			return nil, fmt.Errorf("路径 %s 访问失败: 数据为 nil", path)
		}

		// 处理数组索引，如 items[0]
		if idx := strings.Index(part, "["); idx != -1 {
			key := part[:idx]
			closeIdx := strings.Index(part, "]")
			if closeIdx == -1 || closeIdx < idx+1 {
				return nil, fmt.Errorf("无效的数组访问路径: %s", part)
			}
			if closeIdx != len(part)-1 {
				return nil, fmt.Errorf("无效的数组访问路径: %s", part)
			}
			indexStr := part[idx+1 : closeIdx]
			var index int
			if _, err := fmt.Sscanf(indexStr, "%d", &index); err != nil {
				return nil, fmt.Errorf("无效的数组索引: %s", indexStr)
			}

			// 获取对象属性
			if key != "" {
				current = getMapValue(current, key)
			}

			// 获取数组元素
			current = getArrayValue(current, index)
		} else {
			current = getMapValue(current, part)
		}
	}

	return current, nil
}

// TryGetDataByPath 根据路径获取数据，并区分“路径不存在”与“路径语法错误”。
// found=false 表示路径上的某个字段/索引不存在或越界。
func TryGetDataByPath(data interface{}, path string) (value interface{}, found bool, err error) {
	if path == "" {
		return data, true, nil
	}

	parts := strings.Split(path, ".")
	current := data
	for _, part := range parts {
		if part == "" {
			return nil, false, fmt.Errorf("无效的数据路径: %s", path)
		}
		if current == nil {
			return nil, false, nil
		}

		if idx := strings.Index(part, "["); idx != -1 {
			key := part[:idx]
			closeIdx := strings.Index(part, "]")
			if closeIdx == -1 || closeIdx < idx+1 || closeIdx != len(part)-1 {
				return nil, false, fmt.Errorf("无效的数组访问路径: %s", part)
			}
			indexStr := part[idx+1 : closeIdx]
			var index int
			if _, err := fmt.Sscanf(indexStr, "%d", &index); err != nil {
				return nil, false, fmt.Errorf("无效的数组索引: %s", indexStr)
			}

			if key != "" {
				mv, ok := tryGetMapValue(current, key)
				if !ok {
					return nil, false, nil
				}
				current = mv
			}

			av, ok := tryGetArrayValue(current, index)
			if !ok {
				return nil, false, nil
			}
			current = av
			continue
		}

		mv, ok := tryGetMapValue(current, part)
		if !ok {
			return nil, false, nil
		}
		current = mv
	}

	return current, true, nil
}

func tryGetMapValue(data interface{}, key string) (interface{}, bool) {
	if m, ok := data.(map[string]interface{}); ok {
		v, exists := m[key]
		return v, exists
	}
	val := reflect.ValueOf(data)
	if val.Kind() != reflect.Map {
		return nil, false
	}
	keyVal := reflect.ValueOf(key)
	mapKeyType := val.Type().Key()
	if keyVal.Type().AssignableTo(mapKeyType) {
		// ok
	} else if keyVal.Type().ConvertibleTo(mapKeyType) {
		keyVal = keyVal.Convert(mapKeyType)
	} else {
		return nil, false
	}
	result := val.MapIndex(keyVal)
	if !result.IsValid() {
		return nil, false
	}
	return result.Interface(), true
}

func tryGetArrayValue(data interface{}, index int) (interface{}, bool) {
	if arr, ok := data.([]interface{}); ok {
		if index >= 0 && index < len(arr) {
			return arr[index], true
		}
		return nil, false
	}
	val := reflect.ValueOf(data)
	if val.Kind() == reflect.Slice || val.Kind() == reflect.Array {
		if index >= 0 && index < val.Len() {
			return val.Index(index).Interface(), true
		}
		return nil, false
	}
	return nil, false
}

// getMapValue 从 map 中获取值
func getMapValue(data interface{}, key string) interface{} {
	if m, ok := data.(map[string]interface{}); ok {
		return m[key]
	}
	// 使用反射处理其他类型
	val := reflect.ValueOf(data)
	if val.Kind() == reflect.Map {
		keyVal := reflect.ValueOf(key)
		mapKeyType := val.Type().Key()
		if keyVal.Type().AssignableTo(mapKeyType) {
			// ok
		} else if keyVal.Type().ConvertibleTo(mapKeyType) {
			keyVal = keyVal.Convert(mapKeyType)
		} else {
			return nil
		}
		result := val.MapIndex(keyVal)
		if !result.IsValid() {
			return nil
		}
		return result.Interface()
	}
	return nil
}

// getArrayValue 从数组中获取值
func getArrayValue(data interface{}, index int) interface{} {
	if arr, ok := data.([]interface{}); ok {
		if index >= 0 && index < len(arr) {
			return arr[index]
		}
	}
	// 使用反射处理其他类型
	val := reflect.ValueOf(data)
	if val.Kind() == reflect.Slice || val.Kind() == reflect.Array {
		if index >= 0 && index < val.Len() {
			return val.Index(index).Interface()
		}
	}
	return nil
}

// MergeData 合并多个数据对象
func MergeData(datas ...*NodeData) *NodeData {
	if len(datas) == 0 {
		return NewNodeData(nil)
	}

	if len(datas) == 1 {
		return datas[0]
	}

	// 合并所有数据的 payload
	merged := make(map[string]interface{})
	for i, data := range datas {
		if data != nil && data.Payload != nil {
			key := fmt.Sprintf("input_%d", i)
			merged[key] = data.Payload
		}
	}

	return NewNodeData(merged)
}

// ExtractPayload 提取数据的 payload
func ExtractPayload(data *NodeData) interface{} {
	if data == nil {
		return nil
	}
	return data.Payload
}
