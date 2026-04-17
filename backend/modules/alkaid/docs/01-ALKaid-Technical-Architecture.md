# ALKaid 瑶光星助手技术架构文档

> 基于当前产品需求重写。
>
> 目标：把瑶光星从“会生成工作流 JSON 的助手”收敛成“懂画布、懂节点、懂约束、会修流程”的专用 Workflow Copilot。
>
> 本文档是当前有效版本。旧版迭代文档已迁移到 `docs/archive/`，默认跳过。

---

## 1. 文档范围

本文件只说明技术实现：

- 后端模块如何拆分
- 前端如何配合
- 工具如何分层
- 工件如何定义
- 哪些文件保留、拆分、重写或废弃

以下内容不在本文件展开：

- 产品定位
- 用户场景
- 产品边界
- 成功标准

这些内容请看：

- [00-ALKaid-Product-Requirements.md](./00-ALKaid-Product-Requirements.md)

---

## 2. 改造前提

当前 Alkaid 已具备以下基础能力，可直接复用：

- 流式入口与会话体系
- `chat / analyze / act` 路由雏形
- 工具注册与执行
- `planSteps / toolSteps / phase_changed` 事件模型
- `pendingWorkflow / pendingPatch` 待确认机制
- `生成 -> 校验 -> URL 预检 -> 试跑 -> 修复 -> propose` 主链路

现有关键文件：

- `backend/modules/alkaid/services/agentic/loop.go`
- `backend/modules/alkaid/services/agentic/router.go`
- `backend/modules/alkaid/services/agentic/act_mode.go`
- `backend/modules/alkaid/services/agentic/act_pipeline.go`
- `backend/modules/alkaid/services/tools/registry.go`

---

## 3. 技术总原则

1. **保留现有 `agentic/` 主框架，不推倒重来**
2. **优先重组职责与数据流，不优先扩工具数量**
3. **内部第一公民改为工件，不是回复文本**
4. **前后端都围绕任务模式设计**
5. **旧实现先从主链路移除，再考虑物理删除**

---

## 4. 任务模式模型

当前技术方案采用五种任务模式：

| 模式 | 是否改画布 | 是否试跑 | 主产物 |
|------|------------|----------|--------|
| `chat` | 否 | 否 | 文本答复 |
| `explain` | 否 | 否 | explanation report |
| `generate` | 是 | 是 | pending workflow |
| `repair` | 是 | 是 | pending patch / workflow |
| `trial_debug` | 否或有限 | 是 | debug report |

说明：

- `analyze` 在技术实现上拆为 `explain` 与 `trial_debug`
- `act` 不再作为外部模式，只保留为内部执行抽象

---

## 5. 核心架构调整

## 5.1 从“文本驱动”改成“工件驱动”

### 当前问题

当前 `act_mode + act_pipeline` 仍然大量依赖：

- 模型先输出较长回复
- 再从回复中提取 workflow JSON
- 再进入 validate / trial / repair

这意味着：

- 文本是主输出
- 工件是从文本里二次提取出来的副产品

### 改造目标

内部主产物改成以下四类工件：

1. `WorkflowDraft`
2. `PatchDraft`
3. `ValidationReport`
4. `TrialReport`

文本回复只作为工件说明，不再是主流程驱动器。

### 建议数据结构

```go
type WorkflowDraft struct {
    WorkflowJSON   string
    Summary        string
    Source         string
    Confidence     float64
    ValidationPass bool
    TrialPass      bool
}

type PatchDraft struct {
    PatchJSON      string
    Summary        string
    TargetWorkflow uint
    Confidence     float64
    ValidationPass bool
    TrialPass      bool
}

type ValidationReport struct {
    Valid    bool
    Errors   []string
    Warnings []string
    Summary  string
}

type TrialReport struct {
    Success      bool
    FailedNodeID string
    Observations []string
    Summary      string
}
```

### 直接收益

- 结构化结果更稳定
- 后续前端展示更自然
- 减少“文本很好看但工件不可用”的情况

---

## 5.2 从“自由对话”改成“任务路由”

### 当前问题

虽然已有 `chat / analyze / act`，但对用户价值来说仍然太粗。

### 改造目标

建议在 `router.go` 中把路由决策升级为：

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

### 路由规则

1. 明确问平台用法、概念、文档：`chat`
2. 明确问“帮我看当前工作流/解释这条流程”：`explain`
3. 明确问“帮我生成/创建/搭一条工作流”：`generate`
4. 明确问“帮我修/改/补这条工作流”：`repair`
5. 明确问“跑一下/试一下/看看哪里报错”：`trial_debug`

### 路由实现位置

- 保留：`backend/modules/alkaid/services/agentic/router.go`
- 保留：`backend/modules/alkaid/services/intent_analyzer.go`
- 改造：
  - `router.go` 输出由 `chat/analyze/act` 改为新的 `TaskMode`
  - `intent_analyzer.go` 从布尔值升级为“任务倾向判定”

---

## 6. 目标目录结构

本轮改造尽量复用现有 `alkaid` 模块，不新开平行模块。

### 6.0 完整架构分层

为了把瑶光星真正做成长期可用的模块，建议按五层来理解，而不是只看文件数。

```text
Interaction Layer
  -> 负责对话入口、SSE 输出、待确认交互

Task Orchestration Layer
  -> 负责任务模式路由、模式执行、阶段推进

Artifact & Report Layer
  -> 负责 workflow draft / patch draft / debug report / explain report

Tool & Execution Layer
  -> 负责读取 workflow、节点规格、校验、试跑、提案

State & Memory Layer
  -> 负责 session state、pending artifact、运行态、项目偏好
```

这五层中，V1 重点实现前四层；第五层先最小化落地，但架构上必须预留。

### 6.1 后端目录

```text
backend/modules/alkaid/
├── controllers/
│   └── alkaid_controller.go
├── models/
│   ├── alkaid.go
│   ├── progress.go
│   └── artifact.go                # 新增
├── repositories/
│   └── alkaid_repository.go
├── services/
│   ├── alkaid_service.go
│   ├── intent_analyzer.go
│   ├── capabilities_service.go
│   ├── knowledge_service.go
│   ├── prompt_builder.go
│   ├── agentic/
│   │   ├── loop.go
│   │   ├── router.go
│   │   ├── context.go
│   │   ├── chat_mode.go
│   │   ├── explain_mode.go        # 新增
│   │   ├── generate_mode.go       # 新增
│   │   ├── repair_mode.go         # 新增
│   │   ├── trial_debug_mode.go    # 新增
│   │   ├── pipeline.go            # 新增
│   │   ├── artifact_builder.go    # 新增
│   │   ├── event_writer.go        # 可由 stream_writer.go 演进
│   │   └── stream_writer.go
│   └── tools/
│       ├── registry.go
│       ├── runner.go
│       ├── search_knowledge.go
│       ├── get_capabilities.go
│       ├── get_workflow.go
│       ├── get_node_spec.go
│       ├── validate_workflow.go
│       ├── run_workflow_trial.go
│       ├── propose_workflow.go
│       ├── propose_patch.go
│       └── get_user_constraints.go
└── docs/
    ├── README.md
    ├── 01-ALKaid-Technical-Architecture.md
    └── archive/
```

### 6.2 前端目录

```text
frontend/src/
├── api/
│   └── alkaid.ts
├── types/
│   └── alkaid.ts
├── pages/
│   ├── AssistantWorkspace/
│   └── Conversations/
└── components/
    └── Alkaid/
        ├── types.ts
        ├── ProcessLoader.tsx
        ├── TaskModeBadge.tsx          # 新增
        ├── PendingWorkflowCard.tsx    # 新增或改造
        ├── PendingPatchCard.tsx       # 新增或改造
        ├── DebugReportCard.tsx        # 新增
        └── PlanTimeline.tsx           # 新增或由现有进度组件演进
```

---

## 7. 文件级改造清单

## 7.1 必保留并复用

这些文件有价值，直接复用并改造：

### `backend/modules/alkaid/services/agentic/loop.go`

职责：

- Agent 流式总入口
- 保存 user message
- 组装上下文
- 调用路由器
- 分发到具体模式

改造：

- 保留入口
- 不再直接承载复杂业务逻辑
- 只做“入口 + 路由 + 模式调度”

### `backend/modules/alkaid/services/agentic/router.go`

职责：

- 任务模式判断

改造：

- 从 `chat / analyze / act` 升级为 `chat / explain / generate / repair / trial_debug`
- 输出 `RouteDecision`

### `backend/modules/alkaid/services/tools/registry.go`

职责：

- 工具注册与执行

改造：

- 增加工具元信息
- 支持按 `TaskMode` 过滤可用工具

### `backend/modules/alkaid/services/tools/*`

职责：

- 领域工具实现

改造：

- 不重写工具本体
- 只调整工具边界和返回结构

### `backend/modules/alkaid/services/agentic/stream_writer.go`

职责：

- SSE 输出

改造：

- 对前端暴露更稳定的阶段事件
- 减少内部噪音

---

## 7.2 需要拆分重组

### `backend/modules/alkaid/services/agentic/act_mode.go`

当前问题：

- 入口过重
- 同时处理生成、修复、试跑、异常流

改造：

- 弃用单一 `act_mode.go` 作为主逻辑承载
- 拆成：
  - `generate_mode.go`
  - `repair_mode.go`
  - `trial_debug_mode.go`

### `backend/modules/alkaid/services/agentic/analyze_mode.go`

当前问题：

- analyze 概念太宽

改造：

- 重命名为 `explain_mode.go`
- 职责只保留：
  - 获取当前 workflow
  - 解释结构
  - 输出 explanation report

### `backend/modules/alkaid/services/agentic/act_pipeline.go`

当前问题：

- 长函数链路太重
- 同时处理提取、校验、试跑、修复、提案

改造：

- 重组为 `pipeline.go`
- 阶段函数拆开：
  - `gatherContext`
  - `draftArtifact`
  - `validateArtifact`
  - `trialArtifact`
  - `repairArtifact`
  - `proposeArtifact`

---

## 7.3 建议新增文件

### `backend/modules/alkaid/models/artifact.go`

作用：

- 定义结构化工件类型

建议内容：

- `WorkflowDraft`
- `PatchDraft`
- `ValidationReport`
- `TrialReport`
- `ExplainReport`

### `backend/modules/alkaid/services/agentic/explain_mode.go`

作用：

- 解释当前工作流
- 输出 explanation report

### `backend/modules/alkaid/services/agentic/generate_mode.go`

作用：

- 新建流程入口
- 调用 pipeline 生成 workflow draft

### `backend/modules/alkaid/services/agentic/repair_mode.go`

作用：

- 基于现有 workflow 进行修复
- 输出 patch draft 或 workflow draft

### `backend/modules/alkaid/services/agentic/trial_debug_mode.go`

作用：

- 试跑、定位失败、输出 debug report

### `backend/modules/alkaid/services/agentic/pipeline.go`

作用：

- 承载统一闭环
- 不区分用户模式，只按工件阶段运转

### `backend/modules/alkaid/services/agentic/artifact_builder.go`

作用：

- 从 LLM 输出、工具结果、workflow JSON 中构造标准工件
- 降低“从长文本抽结构”的耦合

---

## 7.4 可以删除或逐步废弃的逻辑

不是立刻删文件，而是从主链路中移除价值不高的做法。

### 废弃项 1：文本优先，再抽 JSON

需要删除的不是函数名，而是主流程依赖。

策略：

- 文本可以保留为说明
- 但 workflow / patch 必须先形成结构化 draft，再决定如何展示

### 废弃项 2：`analyze` 作为模糊模式

策略：

- 对外语义不再叫 `analyze`
- 拆成 `explain` 与 `trial_debug`

### 废弃项 3：模式之间共享过多隐式分支

策略：

- 模式间不再互相借逻辑入口
- 共用逻辑统一放到 `pipeline.go`

---

## 8. 工具架构设计

## 8.1 工具分层

工具分三层，不再混放在一个“都能随便调用”的概念里。

### A. 上下文工具

作用：读环境、读约束、读知识。

包含：

- `search_knowledge`
- `get_capabilities`
- `get_node_spec`
- `get_user_constraints`

### B. 画布工具

作用：读当前工作流、理解现状。

包含：

- `get_workflow`
- `list_workflows`

### C. 交付工具

作用：生成、校验、试跑、提案。

包含：

- `validate_workflow`
- `run_workflow_trial`
- `propose_workflow`
- `propose_patch`

---

## 8.2 工具与模式映射

### `chat`

允许：

- `search_knowledge`
- `get_capabilities`

禁止：

- `propose_workflow`
- `propose_patch`
- `run_workflow_trial`

### `explain`

允许：

- `get_workflow`
- `search_knowledge`
- `get_capabilities`
- `get_node_spec`

禁止：

- `propose_workflow`
- `propose_patch`

### `generate`

允许：

- `search_knowledge`
- `get_capabilities`
- `get_node_spec`
- `get_user_constraints`
- `validate_workflow`
- `run_workflow_trial`
- `propose_workflow`

### `repair`

允许：

- `get_workflow`
- `search_knowledge`
- `get_node_spec`
- `validate_workflow`
- `run_workflow_trial`
- `propose_patch`
- `propose_workflow`

### `trial_debug`

允许：

- `get_workflow`
- `validate_workflow`
- `run_workflow_trial`
- `get_node_spec`

---

## 8.3 每个工具要改什么

### `search_knowledge`

需要补：

- 返回结果摘要字段
- 返回知识来源分类字段

### `get_capabilities`

需要补：

- 明确节点稳定性标记
- 明确当前推荐节点组合

### `get_node_spec`

需要补：

- 返回变量输入输出约束
- 返回常见错误提示

### `get_workflow`

需要补：

- 返回轻量摘要
- 返回节点计数、节点类型分布、关键变量关系

### `validate_workflow`

需要补：

- 返回结构化错误对象
- 区分 `errors` 与 `warnings`

### `run_workflow_trial`

需要补：

- 返回失败节点 ID
- 返回失败阶段
- 返回可读的 trial summary

### `propose_workflow`

需要补：

- 输入改为 `WorkflowDraft`
- 结果写入 `pendingWorkflow`

### `propose_patch`

需要补：

- 输入改为 `PatchDraft`
- 结果写入 `pendingPatch`

---

## 9. 模式执行链

## 9.1 `generate`

```text
route -> generate_mode
      -> gather context
      -> draft workflow
      -> validate
      -> trial
      -> repair if needed
      -> propose_workflow
```

## 9.2 `repair`

```text
route -> repair_mode
      -> get current workflow
      -> diagnose issues
      -> draft patch
      -> validate
      -> trial
      -> fallback to workflow draft if patch unstable
      -> propose_patch / propose_workflow
```

## 9.3 `trial_debug`

```text
route -> trial_debug_mode
      -> get current workflow
      -> validate
      -> trial
      -> build trial report
      -> return debug report
```

## 9.4 `explain`

```text
route -> explain_mode
      -> get current workflow
      -> read node spec/capabilities if needed
      -> build explanation report
      -> return explanation
```

---

## 10. 前端需要做什么

## 10.1 `frontend/src/api/alkaid.ts`

需要做：

- 增加 `taskMode` 相关响应字段
- 支持新的 phase 映射
- 支持 `debug report / explain report` 返回

## 10.2 `frontend/src/types/alkaid.ts`

需要做：

- 增加 `taskMode`
- 增加工件类型：
  - `PendingWorkflowSummary`
  - `PendingPatchSummary`
  - `DebugReport`
  - `ExplainReport`

## 10.3 `frontend/src/components/Alkaid/*`

建议新增：

- `TaskModeBadge.tsx`
- `DebugReportCard.tsx`
- `PendingWorkflowCard.tsx`
- `PendingPatchCard.tsx`

现有组件改造：

- `ProcessLoader.tsx`：升级成阶段展示组件

---

## 11. 第一阶段实施顺序

## Phase 1：路由收敛

文件：

- `backend/modules/alkaid/services/agentic/router.go`
- `backend/modules/alkaid/services/intent_analyzer.go`
- `frontend/src/types/alkaid.ts`

目标：

- 先把模式收敛到 `chat / explain / generate / repair / trial_debug`

## Phase 2：模式拆分

文件：

- `backend/modules/alkaid/services/agentic/explain_mode.go`
- `backend/modules/alkaid/services/agentic/generate_mode.go`
- `backend/modules/alkaid/services/agentic/repair_mode.go`
- `backend/modules/alkaid/services/agentic/trial_debug_mode.go`
- `backend/modules/alkaid/services/agentic/loop.go`

目标：

- 让每种任务模式都有明确入口

## Phase 3：工件结构化

文件：

- `backend/modules/alkaid/models/artifact.go`
- `backend/modules/alkaid/services/agentic/pipeline.go`
- `backend/modules/alkaid/services/agentic/artifact_builder.go`
- `backend/modules/alkaid/services/tools/propose_workflow.go`
- `backend/modules/alkaid/services/tools/propose_patch.go`

目标：

- 把 workflow/patch/debug/explain 都改成工件优先

## Phase 4：工具补强

文件：

- `backend/modules/alkaid/services/tools/get_workflow.go`
- `backend/modules/alkaid/services/tools/get_node_spec.go`
- `backend/modules/alkaid/services/tools/validate_workflow.go`
- `backend/modules/alkaid/services/tools/run_workflow_trial.go`

目标：

- 让工具返回更稳定的结构化结果

## Phase 5：前端产品化

文件：

- `frontend/src/api/alkaid.ts`
- `frontend/src/types/alkaid.ts`
- `frontend/src/components/Alkaid/*`

目标：

- 把模式感、进度感、待确认工件和 debug report 做出来

---

## 12. V2 预留扩展层

下面这些目录和文件，不要求第一版立即实现，但如果目标是把瑶光星做成长期好用的功能模块，建议在架构上预留。

## 12.1 `services/agentic/policies/`

作用：

- 放任务模式规则
- 放工具白名单
- 放结束条件
- 放 fallback 策略

建议目录：

```text
backend/modules/alkaid/services/agentic/policies/
├── task_mode_policy.go
├── tool_policy.go
├── completion_policy.go
└── fallback_policy.go
```

为什么要预留：

- 这些规则如果继续写死在 `router.go`、`generate_mode.go`、`repair_mode.go` 里，后续会非常散。

## 12.2 `services/agentic/reports/`

作用：

- 生成用户可见报告
- 分离“工件构建”和“展示说明”

建议目录：

```text
backend/modules/alkaid/services/agentic/reports/
├── explain_report_builder.go
├── debug_report_builder.go
├── workflow_summary_builder.go
└── patch_summary_builder.go
```

为什么要预留：

- `artifact_builder.go` 第一版能用，但后续报告类型多了会膨胀。

## 12.3 `services/tools/specs/`

作用：

- 放工具元信息
- 放模式可用矩阵
- 放工具结果 schema

建议目录：

```text
backend/modules/alkaid/services/tools/specs/
├── tool_meta.go
├── tool_mode_matrix.go
└── tool_result_schema.go
```

为什么要预留：

- 后续不只是“能调用工具”，还要知道工具的作用域、变更风险、返回结构和错误结构。

## 12.4 `models/runtime_state.go`

作用：

- 从 `alkaid.go` 中拆出运行态

建议承载：

- 当前 task mode
- 当前 phase
- 最近一次 validation report
- 最近一次 trial report
- 最近一次 draft
- interruption / retry 状态

为什么要预留：

- 这些状态越做越多，不适合长期塞在一个 `alkaid.go` 中。

## 12.5 `services/memory/`

作用：

- 管理项目级偏好和历史运行事实

建议目录：

```text
backend/modules/alkaid/services/memory/
├── session_memory.go
├── project_memory.go
└── preference_memory.go
```

建议后续承载：

- 用户常用输出格式
- 用户偏好 provider / model
- 项目常见 workflow 风格
- 最近失败节点与修复经验

为什么要预留：

- 如果以后想让瑶光星“越用越顺手”，这层迟早需要出现。

## 12.6 前端 V2 预留层

建议后续预留：

```text
frontend/src/components/Alkaid/reports/
├── ExplainReportCard.tsx
├── DebugReportCard.tsx
├── WorkflowSummaryCard.tsx
└── PatchSummaryCard.tsx

frontend/src/components/Alkaid/policies/
└── taskModeConfig.ts
```

作用：

- 把展示组件从聊天区本体中拆开
- 把任务模式展示配置从组件逻辑中抽离

---

## 13. 最小可落地版本

如果只做第一轮，建议只完成以下范围：

1. 新任务模式路由
2. `generate / repair / trial_debug / explain` 四个模式入口
3. `WorkflowDraft / PatchDraft / TrialReport / ExplainReport`
4. 工具返回结构化结果
5. 前端展示 `taskMode + pendingWorkflow/pendingPatch + debugReport`

这版完成后，瑶光星就已经不是“帮你吐一段工作流 JSON 的聊天助手”，而是一个真正可用的 Workflow Copilot。
type TaskMode string

const (
    TaskChat       TaskMode = "chat"
    TaskExplain    TaskMode = "explain"
    TaskGenerate   TaskMode = "generate"
    TaskRepair     TaskMode = "repair"
    TaskTrialDebug TaskMode = "trial_debug"
)
```

对应映射关系：

- `chat` -> `runChatMode`
- `explain` -> `runExplainMode`
- `generate` -> `runGenerateMode`
- `repair` -> `runRepairMode`
- `trial_debug` -> `runTrialDebugMode`

`act_mode` 可以保留作为共享调度器，但不再直接暴露为用户语义。

### 路由判断优先级

1. 用户是否明确要求“新建流程”
2. 用户是否明确要求“修流程/改流程”
3. 用户是否明确要求“帮我看现在这条流程”
4. 用户是否明确要求“跑一下/查报错”
5. 其余再进入普通问答

### 直接收益

- 进入正确模式更快
- 工具选择更准
- 前端可展示更明确的任务状态

---

## 5.3 从“工具堆叠”改成“固定闭环”

### 当前问题

工具本身已经不少，但智能感并不来自“工具越多越好”。

### 改造目标

新版聚焦 8 个核心工具，不继续盲目扩张：

1. `get_workflow`
2. `search_knowledge`
3. `get_capabilities`
4. `get_node_spec`
5. `validate_workflow`
6. `run_workflow_trial`
7. `propose_workflow`
8. `propose_patch`

### 每种任务模式的推荐工具白名单

| 模式 | 工具白名单 |
|------|------------|
| `chat` | `search_knowledge`, `get_capabilities` |
| `explain` | `get_workflow`, `get_capabilities`, `get_node_spec`, `search_knowledge` |
| `generate` | `search_knowledge`, `get_capabilities`, `get_node_spec`, `validate_workflow`, `run_workflow_trial`, `propose_workflow` |
| `repair` | `get_workflow`, `search_knowledge`, `validate_workflow`, `run_workflow_trial`, `propose_patch`, `propose_workflow` |
| `trial_debug` | `get_workflow`, `validate_workflow`, `run_workflow_trial`, `get_node_spec` |

### 关键原则

- 工具选择不再追求“完全开放”
- 不同任务模式使用不同工具集
- 让模型在小工具集合中做更稳定的选择

---

## 5.4 从“生成一次”改成“固定交付闭环”

### 新版统一闭环

对于 `generate / repair` 两种高价值模式，统一走以下闭环：

1. 明确任务目标
2. 获取上下文
3. 生成 draft
4. 校验 draft
5. 必要时试跑
6. 根据错误修复
7. 输出 `pendingWorkflow` 或 `pendingPatch`

建议统一为一个内部总线：

```text
Build Goal
  -> Gather Context
  -> Draft Artifact
  -> Validate
  -> Trial
  -> Repair If Needed
  -> Propose
```

### 各模式差异

#### `generate`

- draft 默认是 `WorkflowDraft`
- 主目标是生成新流程

#### `repair`

- draft 默认是 `PatchDraft`
- patch 不可行时可退化为完整 `WorkflowDraft`

#### `trial_debug`

- 到 `Trial` 和 `Report` 为止
- 不默认进入 `Propose`

---

## 6. 模块级改造建议

## 6.1 `router.go`

### 目标

- 从粗粒度路由升级到任务模式路由
- 路由结果不仅包含 `Mode`，还包含执行策略

### 建议结构

```go
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

### 改造重点

- 把“是否要改工作流”与“是否要试跑”放入路由结果
- 避免后续模式再二次猜测

---

## 6.2 `act_mode.go`

### 目标

把 `act_mode` 变成内部任务编排器，而不是一个大而全的用户模式。

### 建议拆分

- `generate_mode.go`
- `repair_mode.go`
- `trial_debug_mode.go`

如果暂时不拆文件，也应在 `act_mode.go` 内分成明确入口：

```go
func runGenerateMode(...)
func runRepairMode(...)
func runTrialDebugMode(...)
```

### 改造重点

- 每个入口只做自身任务的准备
- 不共享过多特殊 case
- 将共用逻辑下沉到 pipeline 层

---

## 6.3 `act_pipeline.go`

### 目标

把当前的“长函数式编排”收敛成固定阶段的 pipeline。

### 推荐阶段

```go
type PipelineStage string

const (
    StageGather   PipelineStage = "gather"
    StageDraft    PipelineStage = "draft"
    StageValidate PipelineStage = "validate"
    StageTrial    PipelineStage = "trial"
    StageRepair   PipelineStage = "repair"
    StagePropose  PipelineStage = "propose"
)
```

### 推荐职责

- `gatherContext(...)`
- `draftArtifact(...)`
- `validateArtifact(...)`
- `trialArtifact(...)`
- `repairArtifact(...)`
- `proposeArtifact(...)`

### 改造重点

- 每阶段输入输出都结构化
- 不直接拿 assistant 文本穿透全链路
- 阶段失败时返回标准报告，而不是临时拼接内容

---

## 6.4 `tools/registry.go`

### 目标

把工具注册表升级为“模式感知的工具能力表”。

### 建议新增

```go
type ToolMeta struct {
    Name         string
    AllowedModes []TaskMode
    Mutating     bool
    Description  string
}
```

### 改造重点

- 允许 registry 按 `TaskMode` 过滤可用工具
- 降低模型误调用不合适工具的概率

---

## 6.5 `stream_writer.go`

### 目标

前端看到的不是“内部思维噪音”，而是任务进展。

### 建议前端可见阶段

- `understanding`
- `reading_canvas`
- `drafting`
- `validating`
- `trial_running`
- `repairing`
- `waiting_approval`
- `done`
- `error`

### 说明

内部仍可保留更细粒度计划步骤，但对用户只展示必要阶段与最近若干工具步。

---

## 7. 会话记忆改造

## 7.1 当前问题

当前会话更多是“聊天记录 + pending 状态”，但 Workflow Copilot 需要记住更实用的事实。

### 7.2 建议增加的记忆对象

建议把记忆分成三层：

#### A. 会话级任务状态

- 当前任务模式
- 当前阶段
- 当前目标
- 当前候选工件
- 最近一次 validate 结果
- 最近一次 trial 结果

#### B. 项目级用户偏好

- 偏好输出格式
- 偏好 provider / model
- 常用 workflow 风格
- 偏好使用哪些节点

#### C. 运行事实

- 最近失败的节点
- 最近失败原因
- 最近修复建议
- 最近通过校验的 workflow 摘要

### 7.3 不建议记什么

不建议优先做：

- 冗长自由对话摘要
- 过度复杂的长期人格设定
- 与工作流执行无关的泛知识记忆

---

## 8. 前端改造建议

## 8.1 亮点不在聊天框，在“任务感”

前端的智能感主要来自：

- 明确当前任务类型
- 明确当前阶段
- 明确最近做了哪些检查
- 明确给用户什么可应用结果

### 建议界面结构

1. 顶部：当前任务模式标签  
   例如：`生成流程`、`解释画布`、`排查失败`

2. 中部：阶段与工具步  
   例如：`正在读取当前画布`、`正在校验变量引用`

3. 底部：待确认工件  
   例如：`待应用工作流`、`待应用补丁`

4. 文本区：补充说明  
   用于解释为什么这样改，而不是承担主逻辑

## 8.2 前端要强化的三种结果卡片

建议重点打磨三类卡片：

1. **Workflow Proposal Card**  
   展示节点数、输出格式、是否通过校验、是否试跑成功

2. **Patch Proposal Card**  
   展示新增/删除/修改了哪些节点与连线

3. **Debug Report Card**  
   展示失败节点、错误原因、建议修复方向

这三类卡片比长段文本更有产品亮点。

---

## 9. 第一阶段最值得做的增强项

如果只做一轮改造，优先做下面三件事。

### 9.1 任务模式收敛

把当前 `chat / analyze / act` 升级为：

- `chat`
- `explain`
- `generate`
- `repair`
- `trial_debug`

这是最关键的第一步。

### 9.2 工件优先

把以下内容变成内部标准结构：

- workflow draft
- patch draft
- validation report
- trial report

减少对“从文本抽 JSON”的依赖。

### 9.3 修复闭环产品化

把“校验 -> 试跑 -> 修复 -> 待确认”做成真正的亮点链路。

用户感知会非常强，因为这直接提升首次跑通率。

---

## 10. 分阶段实施计划

## Phase 1：定位收敛

目标：

- 改路由
- 定任务模式
- 改前端文案与展示

产出：

- 新版 `RouteDecision`
- 新任务模式枚举
- 新任务模式 UI 标签

## Phase 2：工件结构化

目标：

- 引入 `WorkflowDraft / PatchDraft / ValidationReport / TrialReport`
- pipeline 阶段结构化

产出：

- `act_pipeline` 重组
- pending 数据结构升级
- 前端卡片化展示

## Phase 3：修复闭环强化

目标：

- 强化 validate / trial / repair 组合
- 优先让 repair 成为亮点

产出：

- repair 模式独立入口
- trial_debug 模式独立入口
- 更稳定的 `pendingPatch / debug report`

## Phase 4：记忆与偏好增强

目标：

- 引入项目级偏好和运行事实记忆

产出：

- 新 session / preference 字段
- 更稳的默认模型与输出偏好

---

## 11. 验收标准

新版瑶光星是否达标，建议按以下标准验收。

### 11.1 生成能力

- 用户一句自然语言能得到可应用 workflow
- 默认会自动校验
- 默认在可控范围内试跑

### 11.2 修复能力

- 用户给一条坏 workflow，瑶光星能指出问题
- 至少能提出 patch 或替代 workflow
- 修复前后差异可解释

### 11.3 分析能力

- 用户问“这条流程在干什么”，瑶光星能清晰解释
- 能指出变量链路与潜在风险

### 11.4 智能感

- 用户能看见当前任务类型
- 用户能看见关键阶段和检查动作
- 用户能看见待确认工件，而不是只看到一大段回复

---

## 12. 最终结论

瑶光星的正确方向不是做成通用 Agent，而是做成：

**一个在 YaoLight 平台里非常强、非常稳、非常懂 workflow 的专用 Copilot。**

这套改造的核心不是继续加节点、加提示词、加工具，而是做四件事：

1. **定位收敛**
2. **任务分流**
3. **工件优先**
4. **修复闭环产品化**

如果这四件事做到位，瑶光星即使不追求通用智能体级别，也完全可以成为这个系统里最有辨识度的亮点模块。

---

## 13. 伪代码级架构总览

这一节不追求代码可直接运行，而是让人一眼看懂：

- 目录为什么存在
- 每层负责什么
- 有哪些服务
- 暴露哪些接口
- 一次请求大概怎么走

## 13.1 推荐目录树

```text
backend/modules/alkaid/
├── controllers/
│   └── alkaid_controller.go
│
├── models/
│   ├── alkaid.go
│   ├── progress.go
│   ├── artifact.go
│   └── runtime_state.go              # V2 预留
│
├── repositories/
│   └── alkaid_repository.go
│
├── services/
│   ├── alkaid_service.go
│   ├── intent_analyzer.go
│   ├── prompt_builder.go
│   ├── capabilities_service.go
│   ├── knowledge_service.go
│   │
│   ├── agentic/
│   │   ├── loop.go
│   │   ├── router.go
│   │   ├── context.go
│   │   ├── chat_mode.go
│   │   ├── explain_mode.go
│   │   ├── generate_mode.go
│   │   ├── repair_mode.go
│   │   ├── trial_debug_mode.go
│   │   ├── pipeline.go
│   │   ├── artifact_builder.go
│   │   ├── stream_writer.go
│   │   ├── policies/                # V2 预留
│   │   └── reports/                 # V2 预留
│   │
│   ├── tools/
│   │   ├── registry.go
│   │   ├── runner.go
│   │   ├── search_knowledge.go
│   │   ├── get_capabilities.go
│   │   ├── get_workflow.go
│   │   ├── get_node_spec.go
│   │   ├── get_user_constraints.go
│   │   ├── validate_workflow.go
│   │   ├── run_workflow_trial.go
│   │   ├── propose_workflow.go
│   │   ├── propose_patch.go
│   │   └── specs/                   # V2 预留
│   │
│   └── memory/                      # V2 预留
│       ├── session_memory.go
│       ├── project_memory.go
│       └── preference_memory.go
│
└── docs/
    ├── 00-ALKaid-Product-Requirements.md
    ├── 01-ALKaid-Technical-Architecture.md
    └── archive/
```

---

## 13.2 每个目录是干嘛的

### `controllers/`

作用：

- 接 HTTP / SSE 请求
- 调用 service
- 返回响应

不应该做：

- 复杂路由判断
- 工具调度
- 工作流生成逻辑

### `models/`

作用：

- 定义数据库模型
- 定义运行态模型
- 定义工件模型

核心内容：

- 会话和消息
- 进度与阶段
- workflow / patch / report 等工件

### `repositories/`

作用：

- 封装数据库访问
- 提供 session/message/pending 读写

不应该做：

- AI 调用
- 路由策略
- 工具编排

### `services/agentic/`

作用：

- 瑶光星核心大脑
- 负责任务分流和执行

包含：

- 路由
- 模式执行
- pipeline 阶段
- SSE 输出
- 工件构造

### `services/tools/`

作用：

- 让瑶光星调用平台内部能力

包含：

- 读当前画布
- 读节点规格
- 校验 workflow
- 试跑 workflow
- 生成 pending workflow / patch

### `services/memory/`

作用：

- 管理会话记忆、项目偏好、用户偏好

第一版可以很轻，但长期一定会需要。

---

## 13.3 关键模型伪代码

### 会话与消息

```go
type AlkaidSession struct {
    ID               uint
    UserID           uint
    ProjectID        *uint
    WorkflowID       *uint
    CurrentTaskMode  string
    CurrentPhase     string
    PendingWorkflow  *string
    PendingPatch     *string
    ToolStepsJSON    *string
    PlanStepsJSON    *string
}

type AlkaidMessage struct {
    ID        uint
    SessionID uint
    Role      string
    Content   string
    Type      string
}
```

### 工件

```go
type WorkflowDraft struct {
    WorkflowJSON   string
    Summary        string
    ValidationPass bool
    TrialPass      bool
    Confidence     float64
}

type PatchDraft struct {
    PatchJSON      string
    Summary        string
    ValidationPass bool
    TrialPass      bool
    Confidence     float64
}

type ExplainReport struct {
    Summary          string
    NodeSummary      []string
    VariableFlow     []string
    RiskPoints       []string
    Suggestions      []string
}

type TrialReport struct {
    Success          bool
    FailedNodeID     string
    FailedNodeLabel  string
    ErrorSummary     string
    Suggestions      []string
}
```

### 路由结果

```go
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

---

## 13.4 核心服务伪代码

### 1. 控制器

```go
type AlkaidController struct {
    alkaidService *AlkaidService
}

func (c *AlkaidController) SessionStream(ctx *gin.Context) {
    req := parseRunStreamRequest(ctx)
    err := agentic.RunStream(ctx, req)
    if err != nil {
        writeHTTPError(ctx, err)
        return
    }
}

func (c *AlkaidController) ApplyWorkflow(ctx *gin.Context) {
    req := parseApplyWorkflowRequest(ctx)
    err := c.alkaidService.ApplyPendingWorkflow(req)
    if err != nil {
        writeHTTPError(ctx, err)
        return
    }
    writeHTTPSuccess(ctx)
}

func (c *AlkaidController) ApplyPatch(ctx *gin.Context) {
    req := parseApplyPatchRequest(ctx)
    err := c.alkaidService.ApplyPendingPatch(req)
    if err != nil {
        writeHTTPError(ctx, err)
        return
    }
    writeHTTPSuccess(ctx)
}
```

### 2. Agent 总入口

```go
func RunStream(ctx *gin.Context, req RunStreamRequest) error {
    session := repo.GetSession(req.SessionID)
    userMsg := repo.CreateUserMessage(session.ID, req.Message)

    sw := NewSSEWriter(ctx, session.ID, userMsg.ID, req.Message)
    turnCtx := BuildTurnContext(session, req, history)

    decision := DecideRoute(turnCtx)

    switch decision.TaskMode {
    case TaskChat:
        return runChatMode(turnCtx, sw)
    case TaskExplain:
        return runExplainMode(turnCtx, sw)
    case TaskGenerate:
        return runGenerateMode(turnCtx, sw)
    case TaskRepair:
        return runRepairMode(turnCtx, sw)
    case TaskTrialDebug:
        return runTrialDebugMode(turnCtx, sw)
    default:
        return runChatMode(turnCtx, sw)
    }
}
```

### 3. 路由器

```go
func DecideRoute(turnCtx TurnContext) RouteDecision {
    if looksLikePlainChat(turnCtx.Message) {
        return RouteDecision{TaskMode: TaskChat}
    }

    if looksLikeExplain(turnCtx.Message, turnCtx.CurrentWorkflow) {
        return RouteDecision{
            TaskMode: TaskExplain,
            NeedWorkflow: true,
        }
    }

    if looksLikeGenerate(turnCtx.Message) {
        return RouteDecision{
            TaskMode: TaskGenerate,
            NeedValidation: true,
            NeedTrial: true,
            NeedApproval: true,
            AllowMutating: true,
        }
    }

    if looksLikeRepair(turnCtx.Message, turnCtx.CurrentWorkflow) {
        return RouteDecision{
            TaskMode: TaskRepair,
            NeedWorkflow: true,
            NeedValidation: true,
            NeedTrial: true,
            NeedApproval: true,
            AllowMutating: true,
        }
    }

    if looksLikeTrialDebug(turnCtx.Message, turnCtx.CurrentWorkflow) {
        return RouteDecision{
            TaskMode: TaskTrialDebug,
            NeedWorkflow: true,
            NeedValidation: true,
            NeedTrial: true,
        }
    }

    return RouteDecision{TaskMode: TaskChat}
}
```

### 4. 模式服务

```go
func runExplainMode(ctx TurnContext, sw *SSEWriter) error {
    workflow := tools.GetWorkflow(ctx.SessionID)
    caps := tools.GetCapabilities()

    report := BuildExplainReport(workflow, caps)

    sw.WritePhaseChanged("done")
    sw.WriteExplainReport(report)
    sw.WriteDone()
    return nil
}

func runGenerateMode(ctx TurnContext, sw *SSEWriter) error {
    result := RunPipeline(PipelineInput{
        TaskMode: TaskGenerate,
        UserGoal: ctx.Message,
    })

    sw.WritePendingWorkflow(result.WorkflowDraft)
    sw.WriteDone()
    return nil
}

func runRepairMode(ctx TurnContext, sw *SSEWriter) error {
    result := RunPipeline(PipelineInput{
        TaskMode: TaskRepair,
        CurrentWorkflow: ctx.CurrentWorkflow,
        UserGoal: ctx.Message,
    })

    if result.PatchDraft != nil {
        sw.WritePendingPatch(result.PatchDraft)
    } else {
        sw.WritePendingWorkflow(result.WorkflowDraft)
    }
    sw.WriteDone()
    return nil
}

func runTrialDebugMode(ctx TurnContext, sw *SSEWriter) error {
    result := RunPipeline(PipelineInput{
        TaskMode: TaskTrialDebug,
        CurrentWorkflow: ctx.CurrentWorkflow,
    })

    sw.WriteDebugReport(result.TrialReport)
    sw.WriteDone()
    return nil
}
```

### 5. Pipeline

```go
type PipelineInput struct {
    TaskMode        TaskMode
    UserGoal        string
    CurrentWorkflow interface{}
}

type PipelineResult struct {
    WorkflowDraft    *WorkflowDraft
    PatchDraft       *PatchDraft
    ValidationReport *ValidationReport
    TrialReport      *TrialReport
}

func RunPipeline(input PipelineInput) PipelineResult {
    ctxData := gatherContext(input)
    draft := draftArtifact(input, ctxData)
    validation := validateArtifact(draft)

    if !validation.Valid && input.TaskMode == TaskTrialDebug {
        return PipelineResult{ValidationReport: validation}
    }

    trial := trialArtifact(draft, validation)
    repaired := repairArtifactIfNeeded(input, draft, validation, trial)

    return buildPipelineResult(repaired, validation, trial)
}
```

---

## 13.5 工具接口伪代码

### 工具注册表

```go
type ToolHandler func(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)

type ToolMeta struct {
    Name         string
    AllowedModes []TaskMode
    Mutating     bool
    Description  string
}

type Registry struct {
    handlers map[string]ToolHandler
    meta     map[string]ToolMeta
}

func (r *Registry) ExecuteTool(mode TaskMode, name string, params map[string]interface{}, sessionID uint) (interface{}, string, error) {
    if !r.IsAllowed(mode, name) {
        return nil, "", fmt.Errorf("tool not allowed in mode: %s", mode)
    }
    return r.handlers[name](params, sessionID)
}
```

### 每个工具的职责

```go
func runSearchKnowledge(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来检索最佳实践、节点知识、场景经验

func runGetCapabilities(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来读取当前系统支持的节点、能力、推荐组合

func runGetWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来读取当前会话关联的 workflow，返回结构和摘要

func runGetNodeSpec(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来读取某类节点的配置、变量输入输出、约束

func runValidateWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来校验 workflow 结构、变量引用、必要字段

func runRunWorkflowTrial(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来试跑 workflow，返回失败节点、失败原因、执行摘要

func runProposeWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来把 workflow draft 写入 session.pendingWorkflow

func runProposePatch(params map[string]interface{}, sessionID uint) (result interface{}, summary string, err error)
// 用来把 patch draft 写入 session.pendingPatch
```

---

## 13.6 对外接口伪代码

### HTTP / SSE 接口

```text
POST /api/alkaid/sessions
作用：创建会话

GET /api/alkaid/sessions/:id
作用：读取会话详情

GET /api/alkaid/sessions/:id/messages
作用：读取消息历史

POST /api/alkaid/sessions/:id/stream
作用：发消息并启动瑶光星流式执行

POST /api/alkaid/apply-workflow
作用：应用当前 session.pendingWorkflow 到画布

POST /api/alkaid/apply-patch
作用：应用当前 session.pendingPatch 到画布

POST /api/alkaid/discard-pending
作用：丢弃待确认工件
```

### SSE 事件

```text
event: interaction_mode
作用：告诉前端这轮属于哪种任务模式

event: phase_changed
作用：告诉前端当前执行阶段

event: plan_created
作用：告诉前端本轮计划步骤

event: tool_step_started
作用：某个工具开始执行

event: tool_step_finished
作用：某个工具执行结束

event: pending_workflow
作用：产出待确认工作流

event: pending_patch
作用：产出待确认补丁

event: debug_report
作用：产出调试报告

event: explain_report
作用：产出解释报告

event: content
作用：补充性说明文本

event: done
作用：本轮结束

event: error
作用：本轮失败
```

---

## 13.7 前端伪代码

```tsx
function AlkaidPanel() {
  const [taskMode, setTaskMode] = useState<string>('chat');
  const [phase, setPhase] = useState<string>('idle');
  const [toolSteps, setToolSteps] = useState<any[]>([]);
  const [pendingWorkflow, setPendingWorkflow] = useState(null);
  const [pendingPatch, setPendingPatch] = useState(null);
  const [debugReport, setDebugReport] = useState(null);
  const [explainReport, setExplainReport] = useState(null);

  function handleSend(message: string) {
    alkaidApi.sessionStreamAgentic(sessionId, { message }, {
      onInteractionMode: (data) => setTaskMode(data.mode),
      onPhaseChanged: (phase) => setPhase(phase),
      onToolStepStarted: (step) => appendToolStep(step),
      onToolStepFinished: (step) => finishToolStep(step),
      onPendingWorkflow: (data) => setPendingWorkflow(data),
      onPendingPatch: (data) => setPendingPatch(data),
      onDebugReport: (data) => setDebugReport(data),
      onExplainReport: (data) => setExplainReport(data),
    });
  }

  return (
    <div>
      <TaskModeBadge mode={taskMode} />
      <PlanTimeline phase={phase} toolSteps={toolSteps} />
      {pendingWorkflow && <PendingWorkflowCard data={pendingWorkflow} />}
      {pendingPatch && <PendingPatchCard data={pendingPatch} />}
      {debugReport && <DebugReportCard data={debugReport} />}
      {explainReport && <ExplainReportCard data={explainReport} />}
    </div>
  );
}
```

---

## 13.8 一次完整请求怎么走

以“用户啥都不会，只说一句：帮我做一个抓网页并总结的工作流”为例：

```text
1. 前端发送 POST /sessions/:id/stream
2. controller 收到请求
3. loop.go 保存 user message
4. router.go 判断为 TaskGenerate
5. generate_mode.go 启动 pipeline
6. pipeline 先 gatherContext
7. tools.search_knowledge / get_capabilities / get_node_spec
8. draftArtifact 生成 WorkflowDraft
9. tools.validate_workflow 校验
10. tools.run_workflow_trial 试跑
11. 若失败则 repairArtifactIfNeeded
12. tools.propose_workflow 写入 pendingWorkflow
13. stream_writer 推送 pending_workflow
14. 前端展示 PendingWorkflowCard
15. 用户点击“应用到画布”
16. POST /apply-workflow
17. 后端把 pending workflow 写入真实 workflow
18. 前端刷新画布
```

这就是瑶光星要提供的真正能力：

- 用户不用懂节点
- 用户不用懂变量
- 用户不用自己排错
- 用户最终拿到的是一个可应用结果
