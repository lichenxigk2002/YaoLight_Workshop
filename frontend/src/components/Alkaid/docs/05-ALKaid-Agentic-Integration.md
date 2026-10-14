# 瑶光星 Agentic 流前端接入说明

> 本文档描述 AlkaidAssistant 接入 Agentic 流（进度可见、待确认工作流、应用到画布）的实现，与后端 `POST /alkaid/sessions/:id/stream`、`apply-workflow` 对应。前后端各保留一份便于联调与维护。

---

## 1. 功能概述

- **Agentic 流**：用户发消息后走 `POST /api/alkaid/sessions/:id/stream`，后端执行固定管道（get_capabilities → get_workflow → LLM 生成 → 抽取 JSON → validate → propose_workflow），通过 SSE 推送阶段、工具步、流式内容、待确认工作流。
- **前端**：瑶光星助手支持开关 `useAgentic`（默认 **true**）。为 true 时使用新流，展示阶段与工具步进度、待确认工作流卡片，支持「应用到画布」「放弃」；为 false 时保持原有单轮流式接口与 ProcessLoader 行为。
- **画布刷新**：用户点击「应用到画布」后，前端调用 `apply-workflow`，成功后通过回调 `onWorkflowApplied` 由 WorkflowEditor 重新拉取节点，画布与后端一致。

---

## 2. 前端变更（AlkaidAssistant）

### 2.1 新增 Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `useAgentic` | `boolean` | `true` | 是否使用 Agentic 流（进度 + 待确认工作流）。为 false 时使用旧流 `sendMessageStream`。 |
| `onWorkflowApplied` | `() => void` | — | Agentic 流下「应用到画布」成功后调用，用于刷新画布（如执行 `loadWorkflowNodes()`）。 |

其余 props（`workflowId`、`onWorkflowGenerated`、`hasExistingNodes`）与原有一致；旧流下仍通过 `onWorkflowGenerated` 导入从消息中解析出的工作流 JSON。

### 2.2 状态（仅 useAgentic 为 true 时使用）

| 状态 | 说明 |
|------|------|
| `agenticPhase` | 当前阶段（idle / planning / generating / validating / …），与 SSE `phase_changed` 同步。 |
| `agenticToolSteps` | 最近工具步列表，由 `tool_step_started` / `tool_step_finished` 更新。 |
| `agenticPendingSummary` | 待确认工作流摘要 `{ nodeCount, edgeCount }`，来自 SSE `pending_workflow`。 |
| `applyLoading` | 「应用到画布」请求进行中。 |

切换会话或发起新消息时清空 `agenticPendingSummary`；新消息开始时重置 `agenticToolSteps` 并将 `agenticPhase` 设为 planning。

### 2.3 发送逻辑分支

- **useAgentic === true**  
  - 调用 `alkaidApi.sessionStreamAgentic(sessionId, messageContent, { … })`。  
  - 回调：`onContent` 累积到当前助手消息；`onPhaseChanged` → `setAgenticPhase`；`onToolStepStarted` / `onToolStepFinished` → 更新 `agenticToolSteps`；`onPendingWorkflow` → `setAgenticPendingSummary(data.summary)`；`onDone` 结束 loading、phase 置为 idle；`onError` 提示并结束。  
  - 不调用 `sendMessageStream`，不维护 `processSteps` / `needsWorkflow`。

- **useAgentic === false**  
  - 保持原有 `sendMessageStream` 及 ProcessLoader、消息内工作流卡片（解析 JSON 导入）逻辑不变。

### 2.4 UI 展示

- **加载中的助手消息**  
  - Agentic 流：展示 **AlkaidProgress**（`phase`、`toolSteps`，最近 10 条工具步）。  
  - 旧流：展示 **ProcessLoader**（understanding → retrieving → generating → completed 等步骤）。

- **待确认工作流**  
  - 当 `agenticPendingSummary !== null` 时，在消息列表下方、输入框上方渲染 **AlkaidPendingWorkflow**：  
    - 展示摘要（节点数、边数）。  
    - 「应用到画布」→ 调用 `handleApplyWorkflow`。  
    - 「放弃」→ 调用 `handleDiscardPendingWorkflow`（仅清空本地 pending 展示）。

### 2.5 「应用到画布」与「放弃」

- **handleApplyWorkflow**  
  - 调用 `alkaidApi.applyWorkflow(sessionId, workflowId ? parseInt(workflowId, 10) : undefined)`。  
  - 成功后：`message.success`、`setAgenticPendingSummary(null)`、`onWorkflowApplied?.()`。  
  - 失败：`message.error`；finally 中 `setApplyLoading(false)`。

- **handleDiscardPendingWorkflow**  
  - `setAgenticPendingSummary(null)`，仅前端不再展示待确认卡片（后端会话中的 pending 由下次 stream 或切换会话覆盖，无需单独清空接口）。

---

## 3. WorkflowEditor 集成

- 挂载瑶光星时传入 **onWorkflowApplied**，用于 apply 成功后刷新画布：  
  `onWorkflowApplied={loadWorkflowNodes}`  
  其中 `loadWorkflowNodes` 来自 `useWorkflowSave`，会重新拉取当前 `workflowId` 的节点/边并更新 React Flow 状态。
- 这样在 Agentic 流下点击「应用到画布」后，画布与后端保存结果一致，无需手动刷新。

---

## 4. 使用方式

- **默认**：`useAgentic` 不传或传 `true`，瑶光星使用 Agentic 流；用户可见阶段与工具步，并在生成工作流后看到待确认卡片与「应用到画布」「放弃」。
- **切回旧流**：在挂载 AlkaidAssistant 处传 `useAgentic={false}`，即恢复单轮流式 + ProcessLoader + 从消息内容解析工作流 JSON 导入。

---

## 5. 与后端接口对应关系

| 前端行为 | 后端接口 |
|----------|----------|
| 发送消息（useAgentic 为 true） | `POST /api/alkaid/sessions/:id/stream`，Body: `{ message, interrupt? }`，SSE: content / phase_changed / tool_step_* / pending_workflow / pending_patch / done / error |
| 点击「应用到画布」 | `POST /api/alkaid/apply-workflow`，Body: `{ sessionId, workflowId? }` |
| 点击「放弃」 | 仅前端清空展示，无必调接口 |

---

## 6. 文件清单（本次接入涉及）

| 位置 | 文件 | 变更说明 |
|------|------|----------|
| 前端 | `components/Alkaid/AlkaidAssistant.tsx` | 新增 useAgentic、onWorkflowApplied；Agentic 状态与发送分支；AlkaidProgress / AlkaidPendingWorkflow 展示；handleApplyWorkflow、handleDiscardPendingWorkflow；切换会话时清空 pending。 |
| 前端 | `components/WorkflowEditor/index.tsx` | 传入 `onWorkflowApplied={loadWorkflowNodes}`。 |
| 后端 | 无代码变更 | 沿用现有 `sessions/:id/stream`、`apply-workflow` 及 agentic loop、apply 逻辑。 |

与《瑶光星增强 · 实现总结文档》冲突时，以本文档描述的前端接入行为为准。
