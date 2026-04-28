# Code Node 实现方案

## 1. 目标

为工作流编辑器新增一个内置 `code` 节点，允许用户在节点中手写代码处理上游数据。

首期目标：

- 节点类型固定为 `code`
- 实际执行只支持 `JavaScript`
- 数据模型与执行链路完整预留 `Python`
- 保持现有工作流存储结构兼容

非目标：

- 不做真正的插件化节点系统
- 不支持外部依赖安装
- 不开放文件系统、网络、进程能力
- 不在首期实现 Python runtime

## 2. 节点模型

节点类型：

- `code`

节点配置结构：

```json
{
  "language": "javascript",
  "source": "return input;",
  "timeoutMs": 3000,
  "inputMode": "merged",
  "consoleEnabled": true,
  "runtime": {
    "javascript": {
      "strictMode": true
    },
    "python": {
      "entry": "main"
    }
  }
}
```

字段约定：

- `language`: `javascript | python`
- `source`: 用户代码
- `timeoutMs`: 单次执行超时
- `inputMode`: `merged | primary`
- `consoleEnabled`: 是否采集 `console.log`
- `runtime.javascript`: JavaScript runtime 配置
- `runtime.python`: Python runtime 占位配置

## 3. 前端设计

### 3.1 节点注册

在工作流编辑器中新增：

- `CodeNode` 节点卡片组件
- `CodeNodeConfig` 配置组件
- `nodeUtils.getDefaultConfig('code')`
- `nodeFormats.code`
- 右键新增菜单中的 `code` 节点入口

### 3.2 配置面板

首期字段：

- 节点名称
- 语言选择
- 代码输入框
- 超时时间
- 输入模式
- 日志开关

语言选择规则：

- 默认 `javascript`
- `python` 在 UI 中展示，但标记为“预留/暂不支持执行”

### 3.3 节点展示

节点卡片展示：

- 语言
- 是否采集日志

## 4. 后端设计

### 4.1 执行器扩展

`WorkflowExecutor.executeNode(...)` 新增：

```go
case "code":
    return e.executeCodeNode(node, dataFlow, variableContext)
```

### 4.2 Runtime 抽象

统一接口：

```go
type CodeRuntime interface {
    Language() string
    Execute(ctx context.Context, req CodeExecutionRequest) (*CodeExecutionResult, error)
}
```

统一请求：

```go
type CodeExecutionRequest struct {
    NodeID         string
    Language       string
    Source         string
    TimeoutMs      int
    InputMode      string
    Input          interface{}
    Variables      map[string]interface{}
    ConsoleEnabled bool
    RuntimeConfig  map[string]interface{}
}
```

统一结果：

```go
type CodeExecutionResult struct {
    Result     interface{}            `json:"result"`
    Stdout     []string               `json:"stdout,omitempty"`
    Stderr     []string               `json:"stderr,omitempty"`
    DurationMs int64                  `json:"durationMs"`
    Metadata   map[string]interface{} `json:"metadata,omitempty"`
}
```

### 4.3 Runtime Registry

通过 registry 按 `language` 分发运行时实现。

首期只注册：

- `javascript`

预留：

- `python`

当 `python` 未启用时，返回明确错误：

- `python runtime not enabled`

### 4.4 JavaScript Runtime

首期采用嵌入式 JS 解释器执行代码。

执行上下文提供：

- `ctx.input`
- `ctx.vars`
- `ctx.node`
- `ctx.console.log(...)`

用户代码执行约定：

- 必须通过 `return` 返回结果
- 返回值需可 JSON 序列化

内部执行包装示例：

```javascript
(function (ctx) {
  const input = ctx.input;
  const vars = ctx.vars;
  const node = ctx.node;
  const console = ctx.console;
  return (function () {
    "use strict";
    // user source
  })();
})
```

### 4.5 Python 预留策略

首期不在主进程内嵌 Python。

后续建议：

- 使用独立子进程或 sidecar
- stdin 输入 JSON
- stdout 返回 JSON
- 可超时终止

首期只保留：

- `language = python`
- `runtime.python` 配置结构
- `PythonRuntime` 的接口位置

## 5. 变量系统

新增 `code` 节点 IO 定义：

- 输入：`data`
- 输出：`result`
- 输出：`stdout`
- 输出：`stderr`

下游变量引用示例：

- `{{node-3.result}}`
- `{{node-3.result.foo}}`
- `{{node-3.stdout}}`

## 6. 安全约束

首期必须具备：

- 执行超时限制
- 日志条数限制
- 单条日志长度限制
- 返回结果大小限制
- 禁止宿主敏感对象注入

首期不开放：

- 文件系统
- 网络请求
- 进程启动
- 外部包加载

## 7. 文件改动建议

后端：

- `backend/modules/workflow/services/workflow_executor.go`
- `backend/modules/workflow/services/variable_context.go`
- `backend/modules/workflow/services/code_node.go`
- `backend/modules/workflow/services/code_runtime.go`
- `backend/modules/workflow/services/code_runtime_javascript.go`
- `backend/modules/workflow/services/code_runtime_python.go`

前端：

- `frontend/src/utils/nodeUtils.ts`
- `frontend/src/components/WorkflowEditor/utils/nodeFormats.ts`
- `frontend/src/components/WorkflowEditor/index.tsx`
- `frontend/src/components/WorkflowEditor/panels/NodeConfigPanel.tsx`
- `frontend/src/components/WorkflowEditor/configs/CodeNodeConfig.tsx`
- `frontend/src/components/WorkflowEditor/nodes/CodeNode/CodeNode.tsx`

## 8. 实施顺序

1. 先落地文档与数据模型
2. 实现后端 runtime 抽象与 `javascript` runtime
3. 接入 `code` 节点执行器与变量输出
4. 接入前端节点和配置面板
5. 增加测试
6. 后续再补 Python runtime
