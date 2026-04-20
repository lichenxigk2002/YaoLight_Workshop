# ALKaid 瑶光星助手实施计划

> 当前有效版本。
>
> 本文档回答“按什么顺序改、每个阶段改哪些文件、每个文件做什么、怎么兼容旧逻辑、如何验收”。
>
> 关联文档：
>
> - 产品需求：[00-ALKaid-Product-Requirements.md](./00-ALKaid-Product-Requirements.md)
> - 技术架构：[01-ALKaid-Technical-Architecture.md](./01-ALKaid-Technical-Architecture.md)

---

## 1. 实施目标

本次实施不是一次性重写 Alkaid，而是把现有实现渐进式重构成真正可用的 Workflow Copilot。

总目标：

1. 收敛任务模式
2. 拆开模式执行逻辑
3. 把 workflow / patch / report 工件结构化
4. 强化校验、试跑、修复闭环
5. 前端把“任务感”和“待确认工件”展示出来

---

## 2. 实施原则

1. **先增量接入，再删除旧逻辑**
2. **每个阶段都必须可运行、可回退**
3. **先改路由层，再改模式层，再改 pipeline 和工具层**
4. **先兼容旧接口，再收紧协议**
5. **优先保住当前能跑的能力，不追求一步到位**

---

## 3. 阶段划分

本次改造分五个阶段：

1. Phase 1：任务模式与路由收敛
2. Phase 2：模式拆分与入口重组
3. Phase 3：工件结构化与 pipeline 重组
4. Phase 4：工具协议补强与试跑分级
5. Phase 5：前端产品化与交互闭环

---

## 4. Phase 1：任务模式与路由收敛

## 4.1 目标

把现有 `chat / analyze / act` 收敛为：

- `chat`
- `explain`
- `generate`
- `repair`
- `trial_debug`

并且不破坏现有链路。

## 4.2 需要改的文件

### 后端

- `backend/modules/alkaid/services/agentic/router.go`
- `backend/modules/alkaid/services/intent_analyzer.go`
- `backend/modules/alkaid/services/agentic/context.go`
- `backend/modules/alkaid/services/agentic/loop.go`

### 前端

- `frontend/src/types/alkaid.ts`
- `frontend/src/api/alkaid.ts`

## 4.3 每个文件做什么

### `router.go`

新增：

```go
type TaskMode string

const (
    TaskChat       TaskMode = "chat"
    TaskExplain    TaskMode = "explain"
    TaskGenerate   TaskMode = "generate"
    TaskRepair     TaskMode = "repair"
    TaskTrialDebug TaskMode = "trial_debug"
)

type RouteDecision struct {
    TaskMode       TaskMode
    AllowMutating  bool
    NeedWorkflow   bool
    NeedValidation bool
    NeedTrial      bool
    NeedApproval   bool
    Reason         string
}
```

改造：

- `DecideRoute` 返回 `RouteDecision`
- 删除旧的 `Mode=analyze/act` 作为外部主语义
- 保留兼容分支，允许旧逻辑继续被内部调用

### `intent_analyzer.go`

新增或改造：

```go
type IntentDecision struct {
    SuggestedMode TaskMode
    Confidence    float64
    Reason        string
}

func AnalyzeTaskIntent(message string, history string) (*IntentDecision, error)
```

说明：

- 旧的布尔值接口先保留
- 新增结构化判断接口

### `context.go`

新增字段：

- `CurrentWorkflow`
- `CurrentTaskMode`
- `ProjectID`
- `WorkflowID`

目的是让路由和模式层不再到处自己拼上下文。

### `loop.go`

调整：

- 仍然保留 `RunStream`
- 改为只做：
  - 保存消息
  - 构建上下文
  - 调用 `DecideRoute`
  - 分发到模式入口

先不做：

- 大规模删除旧模式逻辑

### `frontend/src/types/alkaid.ts`

新增：

```ts
export type TaskMode = 'chat' | 'explain' | 'generate' | 'repair' | 'trial_debug';
```

以及：

- interaction mode 响应类型
- explain/debug 的预留类型

### `frontend/src/api/alkaid.ts`

补充：

- `interaction_mode` 事件解析
- `taskMode` 写入状态

## 4.4 兼容策略

- 旧 SSE 事件继续保留
- 旧 `chat/analyze/act` 内部实现暂不删除
- 前端新字段不存在时走旧展示逻辑

## 4.5 验收标准

1. 一条普通问答进入 `chat`
2. “解释当前工作流”进入 `explain`
3. “帮我生成工作流”进入 `generate`
4. “帮我修这条工作流”进入 `repair`
5. “试跑并看哪里错了”进入 `trial_debug`

---

## 5. Phase 2：模式拆分与入口重组

## 5.1 目标

把模式执行入口拆开，避免所有逻辑继续堆在 `act_mode.go` / `analyze_mode.go`。

## 5.2 需要改的文件

### 新增

- `backend/modules/alkaid/services/agentic/explain_mode.go`
- `backend/modules/alkaid/services/agentic/generate_mode.go`
- `backend/modules/alkaid/services/agentic/repair_mode.go`
- `backend/modules/alkaid/services/agentic/trial_debug_mode.go`

### 调整

- `backend/modules/alkaid/services/agentic/loop.go`
- `backend/modules/alkaid/services/agentic/analyze_mode.go`
- `backend/modules/alkaid/services/agentic/act_mode.go`

## 5.3 每个文件做什么

### `explain_mode.go`

提供：

```go
func runExplainMode(ctx context.Context, repo *AlkaidRepository, sw *SSEWriter, req RunStreamRequest, turnCtx TurnContext) error
```

职责：

- 读取当前 workflow
- 拉取 capabilities / node spec（按需）
- 输出 explanation report

### `generate_mode.go`

提供：

```go
func runGenerateMode(...) error
```

职责：

- 接收用户目标
- 调用 pipeline 生成 workflow draft
- 产生 `pendingWorkflow`

### `repair_mode.go`

提供：

```go
func runRepairMode(...) error
```

职责：

- 获取当前 workflow
- 分析问题
- 生成 patch draft 或 fallback workflow draft
- 产生 `pendingPatch` 或 `pendingWorkflow`

### `trial_debug_mode.go`

提供：

```go
func runTrialDebugMode(...) error
```

职责：

- 校验当前 workflow
- 执行试跑
- 输出 debug report

### `act_mode.go`

处理方式：

- 保留文件，避免一次性断引用
- 内部逻辑逐步迁出
- 最终只保留兼容入口或转发器

### `analyze_mode.go`

处理方式：

- 保留兼容，内部逐步迁到 `explain_mode.go`
- 后续可标记为 deprecated

## 5.4 兼容策略

- `loop.go` 优先调用新模式文件
- 新模式内部暂时可以复用旧 `act_mode.go` 的部分逻辑
- 暂时不删旧文件

## 5.5 验收标准

1. 每种模式都有独立入口文件
2. `loop.go` 不再承载具体业务逻辑
3. `act_mode.go` 不再是唯一重型入口

---

## 6. Phase 3：工件结构化与 pipeline 重组

## 6.1 目标

把系统从“先回复文本，再抽 JSON”改成“先产出工件，再决定怎么展示”。

## 6.2 需要改的文件

### 新增

- `backend/modules/alkaid/models/artifact.go`
- `backend/modules/alkaid/services/agentic/pipeline.go`
- `backend/modules/alkaid/services/agentic/artifact_builder.go`

### 调整

- `backend/modules/alkaid/services/agentic/act_pipeline.go`
- `backend/modules/alkaid/services/tools/propose_workflow.go`
- `backend/modules/alkaid/services/tools/propose_patch.go`
- `backend/modules/alkaid/models/alkaid.go`
- `backend/modules/alkaid/repositories/alkaid_repository.go`

## 6.3 每个文件做什么

### `models/artifact.go`

新增结构：

```go
type WorkflowDraft struct { ... }
type PatchDraft struct { ... }
type ValidationReport struct { ... }
type TrialReport struct { ... }
type ExplainReport struct { ... }
```

### `pipeline.go`

提供：

```go
type PipelineInput struct { ... }
type PipelineResult struct { ... }

func RunPipeline(input PipelineInput) (*PipelineResult, error)
```

内部阶段函数：

```go
func gatherContext(...)
func draftArtifact(...)
func validateArtifact(...)
func trialArtifact(...)
func repairArtifactIfNeeded(...)
func finalizeArtifact(...)
```

### `artifact_builder.go`

作用：

- 把工具结果、LLM 输出、workflow JSON 转成标准工件

### `act_pipeline.go`

处理方式：

- 先保留
- 将旧逻辑拆解到 `pipeline.go`
- 后续变成兼容包装层或删除

### `propose_workflow.go`

改造：

- 输入改成 `WorkflowDraft`
- 输出写入 `pendingWorkflow`

### `propose_patch.go`

改造：

- 输入改成 `PatchDraft`
- 输出写入 `pendingPatch`

### `models/alkaid.go`

新增或确认字段：

- `CurrentTaskMode`
- `CurrentPhase`
- `PendingWorkflow`
- `PendingPatch`
- `ToolStepsJSON`
- `PlanStepsJSON`

### `alkaid_repository.go`

新增方法：

```go
func (r *AlkaidRepository) SavePendingWorkflow(...)
func (r *AlkaidRepository) SavePendingPatch(...)
func (r *AlkaidRepository) UpdateSessionPhase(...)
func (r *AlkaidRepository) UpdateTaskMode(...)
```

## 6.4 兼容策略

- 旧文本提取逻辑先保留 fallback
- 新 pipeline 优先返回工件
- 若工件构建失败，可回退到旧解析逻辑

## 6.5 验收标准

1. `generate` 至少输出 `WorkflowDraft`
2. `repair` 至少输出 `PatchDraft` 或 fallback `WorkflowDraft`
3. `trial_debug` 输出 `TrialReport`
4. `explain` 输出 `ExplainReport`

---

## 7. Phase 4：工具协议补强与试跑分级

## 7.1 目标

让工具返回稳定结构，并把试跑成本控制做进去。

## 7.2 需要改的文件

- `backend/modules/alkaid/services/tools/registry.go`
- `backend/modules/alkaid/services/tools/get_workflow.go`
- `backend/modules/alkaid/services/tools/get_node_spec.go`
- `backend/modules/alkaid/services/tools/get_capabilities.go`
- `backend/modules/alkaid/services/tools/validate_workflow.go`
- `backend/modules/alkaid/services/tools/run_workflow_trial.go`
- `backend/modules/alkaid/services/tools/search_knowledge.go`
- `backend/modules/alkaid/services/tools/get_user_constraints.go`

## 7.3 每个文件做什么

### `registry.go`

新增：

```go
type ToolMeta struct {
    Name         string
    AllowedModes []TaskMode
    Mutating     bool
    Description  string
}
```

新增方法：

```go
func (r *Registry) IsAllowed(mode TaskMode, name string) bool
func (r *Registry) ToolMeta(name string) *ToolMeta
```

### `get_workflow.go`

返回结构增加：

- workflow 摘要
- 节点计数
- 节点类型分布
- 关键变量链路

### `get_node_spec.go`

返回结构增加：

- 必填配置项
- 输入输出变量
- 常见错误提示

### `get_capabilities.go`

返回结构增加：

- 节点稳定性
- 推荐组合
- 不推荐组合

### `validate_workflow.go`

返回结构标准化：

```go
type ValidateResult struct {
    Valid    bool
    Errors   []string
    Warnings []string
    Summary  string
}
```

### `run_workflow_trial.go`

新增试跑分级：

- `quick`
- `standard`
- `full`

返回结构标准化：

```go
type TrialResult struct {
    Success         bool
    FailedNodeID    string
    FailedNodeLabel string
    Summary         string
    CostEstimate    string
}
```

### `search_knowledge.go`

返回结构增加：

- 知识类型
- 来源
- 简短摘要

### `get_user_constraints.go`

返回结构增加：

- 模型偏好
- 输出偏好
- 预算偏好

## 7.4 兼容策略

- 老工具返回结构先兼容解析
- 新结构逐步成为默认
- `run_workflow_trial` 默认先走 `quick`

## 7.5 验收标准

1. 工具返回结构稳定
2. `trial_debug` 不再默认跑重型全量试跑
3. `generate/repair` 可在低成本模式下完成冒烟验证

---

## 8. Phase 5：前端产品化与交互闭环

## 8.1 目标

让用户真正感知到：

- 当前是哪种任务
- 系统在做什么
- 最终给我什么结果

## 8.2 需要改的文件

### 前端 API 与类型

- `frontend/src/api/alkaid.ts`
- `frontend/src/types/alkaid.ts`
- `frontend/src/components/Alkaid/types.ts`

### 前端组件

- `frontend/src/components/Alkaid/ProcessLoader.tsx`
- `frontend/src/components/Alkaid/TaskModeBadge.tsx`（新增）
- `frontend/src/components/Alkaid/PendingWorkflowCard.tsx`（新增或改造）
- `frontend/src/components/Alkaid/PendingPatchCard.tsx`（新增或改造）
- `frontend/src/components/Alkaid/DebugReportCard.tsx`（新增）
- `frontend/src/components/Alkaid/ExplainReportCard.tsx`（新增，若当期需要）

## 8.3 每个文件做什么

### `frontend/src/api/alkaid.ts`

解析新增 SSE 事件：

- `interaction_mode`
- `debug_report`
- `explain_report`

### `frontend/src/types/alkaid.ts`

新增：

- `TaskMode`
- `DebugReport`
- `ExplainReport`
- `PendingWorkflowSummary`
- `PendingPatchSummary`

### `TaskModeBadge.tsx`

展示：

- 当前任务模式

### `ProcessLoader.tsx`

升级：

- 不只显示 process
- 显示当前 phase + tool steps

### `PendingWorkflowCard.tsx`

展示：

- workflow 摘要
- 是否通过 validate / trial
- 应用按钮

### `PendingPatchCard.tsx`

展示：

- patch 摘要
- 修改了哪些节点/连线
- 应用按钮

### `DebugReportCard.tsx`

展示：

- 失败节点
- 错误摘要
- 建议修复动作

## 8.4 兼容策略

- 如果没有新事件，仍显示旧内容流
- 新卡片组件按需渲染，不影响旧聊天区

## 8.5 验收标准

1. 用户能看见 `taskMode`
2. 用户能看见 `pendingWorkflow / pendingPatch / debugReport`
3. 用户点应用后，画布正确更新

---

## 9. 不建议在本轮做的事

这一轮先不要做：

1. 子代理
2. 完全开放式工具调用
3. 复杂长期记忆
4. 大规模迁移所有历史文档和接口
5. 一次性重写整个 `agentic/` 目录

---

## 10. 启动顺序建议

真正开工时，建议按这个顺序：

1. Phase 1：先动路由与模式枚举
2. Phase 2：拆出模式文件
3. Phase 3：引入 artifact 和 pipeline
4. Phase 4：补工具结构和试跑分级
5. Phase 5：最后做前端展示和应用闭环

不要倒着来。

最忌讳：

- 先重写工具
- 先重写前端
- 先删旧逻辑

---

## 11. 开工前检查表

在正式开始重构前，确认以下事项：

1. `00` 产品需求文档已定版
2. `01` 技术架构文档已定版
3. 本文档已作为实施主清单
4. 明确本轮只做 V1 主线，不追求 V2 预留层立即实现
5. 允许旧逻辑在过渡期继续存在

如果这 5 条都满足，就可以正式开启重构计划。
