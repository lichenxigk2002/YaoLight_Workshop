# 瑶光星增强 · 架构说明（Alkaid 目录内自包含）

> 与《瑶光星增强 · 开发任务清单与详细技术实现》《瑶光星 · 功能增强文档》配套。  
> 原则：**新逻辑只在 alkaid 目录下扩展，不破坏现有功能；先造轮子，完成后再替换。**

---

## 1. 总体原则

| 原则 | 说明 |
|------|------|
| **目录隔离** | 所有增强相关代码仅落在 **Backend: `modules/alkaid/`** 与 **Frontend: `components/Alkaid/`**（及前端 `api/alkaid.ts`、`types/alkaid.ts` 的增量）。 |
| **并行实现** | 新流（Agentic Loop、进度事件、待确认应用）与现有「单轮生成 + 流式 content/step/done」**并行存在**，通过开关或新入口切换。 |
| **替换时机** | 新流验收通过后，再改为默认并逐步下线旧流，避免影响现有功能。 |
| **分步交付** | 按任务清单阶段一 → 二 → 三顺序实现，每阶段可独立验收。 |

---

## 2. 后端架构（`Low_code_Backend/modules/alkaid/`）

### 2.1 目录结构（目标）

```
modules/alkaid/
├── controllers/
│   └── alkaid_controller.go          # 现有；增量：GET capabilities, apply-workflow, apply-patch, interrupt
├── models/
│   ├── alkaid.go                     # 现有；增量：会话 Phase/ToolSteps/Pending 字段或新表
│   ├── knowledge.go
│   └── progress.go                   # 新增：Phase 常量、AgentToolStep、SSE 事件 payload 结构
├── repositories/
│   └── alkaid_repository.go          # 现有；增量：Session 新字段的读写、Pending 读写
├── services/
│   ├── alkaid_service.go            # 现有；保留不动，供现有流式接口使用
│   ├── agentic/
│   │   ├── loop.go                  # 新增：Agentic Loop 主流程（LLM + 工具循环，写 SSE）
│   │   ├── stream_writer.go         # 新增：SSE 事件封装（content / phase_changed / tool_step_* / done / error）
│   │   └── messages.go              # 新增：构建 LLM messages（含 tool_calls / tool result 格式）
│   ├── tools/
│   │   ├── registry.go              # 新增：工具注册表、ExecuteTool(name, params, sessionId)
│   │   ├── get_capabilities.go
│   │   ├── get_workflow.go
│   │   ├── get_node_spec.go
│   │   ├── validate_workflow.go
│   │   ├── run_workflow_trial.go
│   │   ├── propose_workflow.go
│   │   └── propose_patch.go
│   ├── capabilities_service.go      # 现有；GET /capabilities 直接复用
│   ├── intent_analyzer.go           # 现有；可选：Agentic 模式下仍可用于预判是否进 Loop
│   ├── knowledge_service.go
│   ├── prompt_builder.go
│   └── ...
└── ...
```

### 2.2 职责划分

| 模块 | 职责 | 与现有关系 |
|------|------|------------|
| **models/progress.go** | Phase 枚举、AgentToolStep、SSE 事件数据结构；与前端类型对齐。 | 纯新增。 |
| **models/alkaid.go** | 会话增加 CurrentPhase、ToolSteps、PendingWorkflow、PendingPatch（或独立表/JSONB）。 | 仅做字段/表扩展，旧接口忽略新字段。 |
| **repositories** | 对 Session 的 Phase/ToolSteps/Pending 读写；可选 ToolSteps 单独表。 | 扩展方法，不删旧逻辑。 |
| **services/tools/** | 工具实现；`ExecuteTool` 统一入口，内部根据 name 分发。 | 仅被 Agentic Loop 调用，不影响现有 alkaid_service。 |
| **services/agentic/** | Loop：读 session → 追加 user message → 循环「LLM(tools) → tool_calls → ExecuteTool → 写 SSE → 追加 tool result」→ 结束。 | 新入口；现有 `SendMessageStream` 不变。 |
| **controllers** | 新增或扩展：GET capabilities、POST session/:id/stream（v2 或同 path 用 query 区分）、POST apply-workflow、POST apply-patch、POST interrupt。 | 新路由与旧路由并存。 |

### 2.3 与现有 workflow 模块的对接

- **apply-workflow**：从 session 取 `pendingWorkflow` 与 `workflowId`，将 WorkflowExportData 转为 `SaveWorkflowNodesRequest`，调用 `workflow.Service.SaveWorkflowNodes(workflowID, req)`，然后清空 session 的 pendingWorkflow。
- **validate_workflow / run_workflow_trial**：在 alkaid/tools 内调用 workflow 的校验与执行器，不暴露新 HTTP；仅 Agentic 内部使用。
- **get_workflow**：从会话关联的「当前画布」读；画布数据来源由前端在创建会话或发 stream 时上传并写入 session，或通过 session.workflowId 拉取已有工作流节点。

### 2.4 隔离策略（不破坏现有）

- 现有 **POST /alkaid/messages/stream** 仍只走 `alkaid_service.SendMessageStream`（现有意图分析 + 单轮生成 + event: message）。
- 新流采用其一即可（任选，推荐 ①）：
  - **① 新 path**：如 **POST /alkaid/session/:id/stream**，body `{ message, interrupt? }`，仅新 path 走 Agentic Loop + 新 SSE 协议。
  - **② 同 path + 开关**：如 body 增加 `useAgentic: true` 或 query `?agentic=1`，当为 true 时走 Agentic，否则走现有逻辑。
- GET capabilities、apply-workflow、apply-patch、interrupt 均为新增接口，与现有无冲突。

---

## 3. 前端架构（`Low_code_Frontend/src/components/Alkaid/`）

### 3.1 目录结构（目标）

```
src/components/Alkaid/
├── 01-ALKaid-Architecture.md        # 本文件
├── 02-ALKaid-Enhancement-ClaudeCode-Style.md
├── 03-ALKaid-Implementation-TaskList-And-Tech.md
├── README.md
├── types/
│   └── progress.ts                 # 新增：Phase、AgentToolStep、SSE 事件类型（与后端一致）
├── api/
│   └── agentic.ts                  # 新增：streamSession、applyWorkflow、applyPatch、interrupt（或合并进 @/api/alkaid）
├── context/
│   └── AlkaidAgenticContext.tsx    # 可选：phase、toolSteps、pendingWorkflow、pendingPatch、streaming、error
├── components/
│   ├── AlkaidProgress.tsx          # 新增：Phase 文案 + ToolStep 列表（可折叠）
│   ├── AlkaidPendingWorkflow.tsx   # 新增：待确认工作流摘要 + 应用/放弃
│   ├── AlkaidPendingPatch.tsx      # 新增：待确认补丁列表 + 应用/放弃
│   └── AlkaidChat.tsx              # 可选拆分：输入框 + 发送 + 打断（或保留在 AlkaidAssistant 内）
├── hooks/
│   ├── useAgenticStream.ts         # 新增：解析新 SSE（content / phase_changed / tool_step_*），更新 state
│   └── usePendingApply.ts          # 可选：applyWorkflow/applyPatch 调用与清空 pending
├── AlkaidAssistant.tsx             # 现有；后续：接入 useAgenticStream + AlkaidProgress + Pending*，用开关切新旧流
├── AlkaidAssistant.module.scss
├── AlkaidButton.tsx
├── ProcessLoader.tsx                # 现有；可与 AlkaidProgress 并存（旧流用 ProcessLoader，新流用 AlkaidProgress）
├── ProcessLoader.module.scss
├── utils.ts
└── index.ts
```

### 3.2 职责划分

| 模块 | 职责 | 与现有关系 |
|------|------|------------|
| **types/progress.ts** | Phase、AgentToolStep、SSE 各 event 的 data 类型；与后端、文档一致。 | 纯新增；现有 types/alkaid.ts 保留。 |
| **api/agentic.ts** | 新流式接口（session/:id/stream）、apply-workflow、apply-patch、interrupt；SSE 解析可在此或 useAgenticStream。 | 与现有 alkaidApi 并列，或合并进 alkaid 并加方法。 |
| **useAgenticStream** | 读 SSE event 类型，更新 phase、toolSteps、assistantContent、pendingWorkflow/pendingPatch、streaming、error。 | 仅在新流时使用；现有 sendMessageStream 逻辑不改。 |
| **AlkaidProgress** | 展示当前 Phase 文案 + 最近 N 条 ToolStep（pending/running/success/error），可折叠。 | 新流时展示；旧流仍用 ProcessLoader。 |
| **AlkaidPendingWorkflow / AlkaidPendingPatch** | 待确认 UI + 调用 apply-workflow/apply-patch，成功后清空 pending 并刷新画布。 | 仅在新流且后端推送了 pending_workflow/pending_patch 时展示。 |
| **AlkaidAssistant** | 容器：对话区 + 进度区（Progress 或 ProcessLoader）+ 待确认区；发送时根据开关走旧 api 或新 stream。 | 先加开关（如 useAgentic=false），默认旧流；新流稳定后改为 true 或去掉旧流。 |

### 3.3 与 WorkflowEditor 的集成

- 仍由 **WorkflowEditor** 挂载 `<AlkaidAssistant workflowId=... onWorkflowGenerated=... hasExistingNodes=... />`。
- **onWorkflowGenerated**：旧流为「解析 JSON 后直接 setNodes/setEdges」；新流在用户点击「应用到画布」后，可仍走 onWorkflowGenerated（前端用 session 的 pendingWorkflow 转 nodes/edges 调用现有 import），或由后端 apply-workflow 写库后前端刷新画布（需与后端约定）。
- 画布数据同步：若采用「后端 apply-workflow 写库」，前端需在 apply 成功后拉取最新 nodes/edges 或通过现有保存/加载流程刷新。

### 3.4 隔离策略（不破坏现有）

- 默认使用 **现有流**（现有 sendMessageStream + ProcessLoader + 直接导入工作流），直到新流开关打开。
- 新流通过 **feature 或 URL 参数** 开启（如 `useAgentic=true` 或从后端配置下发），再启用 useAgenticStream、AlkaidProgress、Pending* 组件与新 API。
- 类型与 API 分层后，替换时仅改 AlkaidAssistant 内「是否用 Agentic」的分支与展示组件，不影响 WorkflowEditor 其余逻辑。

---

## 4. 数据流简述

### 4.1 新流（Agentic）

1. 用户在前端发消息 → 前端调用 **POST /alkaid/session/:id/stream** `{ message }`。
2. 后端 **Agentic Loop**：追加 user message → 设 phase=planning → 推送 phase_changed → 循环：LLM(messages, tools) → 若有 content delta 推送 content → 若有 tool_calls 则对每个执行 ExecuteTool，推送 tool_step_started/tool_step_finished，结果 append 到 messages → 无 tool_calls 则推送 done 并结束。
3. 前端 **useAgenticStream** 解析 SSE，更新 phase、toolSteps、assistantContent；若收到 pending_workflow/pending_patch，更新 pending 状态。
4. 前端展示 **AlkaidProgress**（phase + toolSteps）与 **AlkaidPendingWorkflow / AlkaidPendingPatch**；用户点击「应用」→ 调用 apply-workflow/apply-patch → 后端写画布并清空 pending → 前端清空 pending 并刷新画布。

### 4.2 旧流（保留）

1. 用户发消息 → **POST /alkaid/messages/stream** `{ sessionId, content }`。
2. 后端 **alkaid_service.SendMessageStream**：意图分析 → 单轮生成 → 推送 event: message `{ content, step, done }`。
3. 前端现有逻辑：累积 content，用 ProcessLoader 展示 step，解析 JSON 后直接导入画布。无 phase/toolSteps/pending。

---

## 5. 实施顺序（与任务清单对应）

| 步骤 | 内容 | 产出 |
|------|------|------|
| **阶段一** | 进度模型 + 会话扩展 + 工具骨架 + GET capabilities + 前端类型/状态 | 可创建会话；工具路由占位；前后端类型一致。 |
| **阶段二** | Agentic Loop + 真实工具实现 + 新 SSE 流式接口 | 多轮工具调用 + 进度事件可解析；至少 5 个工具有实现。 |
| **阶段三** | 前端解析新 SSE + AlkaidProgress + Pending* UI + apply-workflow/apply-patch + 打断 | 进度可见、人类在环、画布更新、打断生效。 |
| **阶段四/五** | Hooks、子代理（可选）、国际化与安全 | 按文档收尾。 |

---

## 6. 小结

- **后端**：在 `modules/alkaid/` 内通过 **models/progress**、**services/tools**、**services/agentic** 与控制器增量，实现新接口与 Agentic Loop；现有 `alkaid_service` 与 `/alkaid/messages/stream` 保持不变。
- **前端**：在 `components/Alkaid/` 内通过 **types/progress**、**api/agentic**、**hooks/useAgenticStream**、**AlkaidProgress**、**AlkaidPending*** 与 AlkaidAssistant 开关，实现新流；现有 ProcessLoader 与发送/导入逻辑保留。
- **替换**：新流验收通过后，将默认行为切到 Agentic，再择机移除旧流代码。

与《瑶光星增强 · 开发任务清单与详细技术实现》冲突时以任务清单为准；本架构为目录与职责划分的落地细则。
