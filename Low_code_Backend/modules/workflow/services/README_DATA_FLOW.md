# 数据流传递机制说明

## 概述

数据流传递机制是工作流执行的核心基础设施，负责在节点之间传递数据。

## 核心组件

### 1. NodeData - 统一数据格式

```go
type NodeData struct {
    Payload  interface{}            // 数据内容
    Metadata map[string]interface{} // 元数据
    Type     string                 // 数据类型标识
}
```

**特点：**
- 统一的数据结构，所有节点都使用这个格式
- 支持任意类型的数据（字符串、数字、对象、数组等）
- 包含元数据，可以存储额外的信息

### 2. DataFlow - 数据流管理器

**主要功能：**
- `SetNodeOutput(nodeID, data)` - 设置节点的输出数据
- `GetNodeInput(nodeID)` - 获取节点的所有输入数据（多个上游节点）
- `GetNodeInputData(nodeID)` - 获取节点的输入数据（合并后的单个数据）

## 数据传递流程

```
开始节点 → 生成初始数据
    ↓
节点A → 接收上游数据 → 处理 → 输出数据
    ↓
节点B → 接收节点A的数据 → 处理 → 输出数据
    ↓
合并节点 → 接收多个上游节点的数据 → 合并 → 输出
```

## 节点实现示例

### 1. 开始节点（无输入）

```go
func (e *WorkflowExecutor) executeStartNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
    initialData := map[string]interface{}{
        "message": "工作流开始",
        "timestamp": time.Now().Unix(),
    }
    return NodeExecutionResult{
        NodeID:  node.ID,
        Success: true,
        Data:    initialData,
    }
}
```

### 2. 延迟节点（传递上游数据）

```go
func (e *WorkflowExecutor) executeDelayNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
    // 获取上游节点的输入数据
    inputData, err := dataFlow.GetNodeInputData(node.ID)
    
    // 执行延迟
    time.Sleep(time.Duration(delaySeconds) * time.Second)
    
    // 传递上游数据，不修改
    return NodeExecutionResult{
        NodeID:  node.ID,
        Success: true,
        Data:    ExtractPayload(inputData),
    }
}
```

### 3. 条件节点（根据条件处理数据）

```go
func (e *WorkflowExecutor) executeConditionNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
    // 获取上游数据
    inputData, _ := dataFlow.GetNodeInputData(node.ID)
    
    // 从数据中获取字段值
    fieldValue, _ := GetDataByPath(ExtractPayload(inputData), "data.count")
    
    // 执行条件判断
    result := evaluateCondition(fieldValue, operator, value)
    
    // 返回结果和原始数据
    return NodeExecutionResult{
        Data: map[string]interface{}{
            "result": result,
            "data": ExtractPayload(inputData),
        },
    }
}
```

### 4. 合并节点（合并多个输入）

```go
func (e *WorkflowExecutor) executeMergeNode(node NodeConfig, dataFlow *DataFlow) NodeExecutionResult {
    // 获取所有上游节点的输入数据
    inputs, _ := dataFlow.GetNodeInput(node.ID)
    
    // 合并数据
    mergedData := MergeData(inputs...)
    
    return NodeExecutionResult{
        Data: ExtractPayload(mergedData),
    }
}
```

## 数据路径访问

支持通过路径访问嵌套数据：

```go
// 访问对象属性
GetDataByPath(data, "data.count")        // 访问 data.count
GetDataByPath(data, "data.user.name")   // 访问 data.user.name

// 访问数组元素
GetDataByPath(data, "data.items[0]")    // 访问数组第一个元素
GetDataByPath(data, "data.items[0].id")  // 访问数组元素的属性
```

## 使用注意事项

1. **所有节点都应该使用 DataFlow 获取输入数据**
   - 不要直接访问 `nodeData map[string]interface{}`
   - 使用 `dataFlow.GetNodeInputData(node.ID)` 获取输入

2. **节点输出数据会自动保存到 DataFlow**
   - 执行器会自动调用 `dataFlow.SetNodeOutput(nodeID, data)`

3. **数据格式统一**
   - 所有节点输出都应该是 `interface{}` 类型
   - 建议使用 `map[string]interface{}` 或 `[]interface{}`

4. **错误处理**
   - 如果节点执行失败，不会保存输出数据
   - 下游节点会收到 `nil` 或空数据

## 下一步

1. 完善各个节点的具体实现逻辑
2. 添加数据验证和类型检查
3. 实现条件节点的分支数据传递
4. 添加数据转换和格式化功能

