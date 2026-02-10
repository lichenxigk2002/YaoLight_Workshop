# 瑶光星增强 · 实现总结文档

> 本文档总结按《瑶光星增强 · 开发任务清单与详细技术实现》与《瑶光星 · 功能增强文档》已完成的代码实现，便于后续维护与扩展。

---

## 1. 实现范围概览

| 阶段 | 内容 | 状态 |
|------|------|------|
| **阶段一** | 进度模型、会话扩展、工具骨架、GET capabilities、前端类型 | ✅ 已完成 |
| **阶段二** | Agentic 流（固定管道）、SSE 进度事件、7 个工具真实实现、新流式接口 | ✅ 已完成 |
| **阶段三** | 前端 SSE 解析、进度/待确认组件、apply-workflow/apply-patch 前后端 | ✅ 已完成 |
| **阶段四** | Hooks、子代理 | ⏸ 未实现 |
| **阶段五** | 国际化补全、安全与联调 | ⏸ 部分（i18n 键已预留） |

**说明**：当前 Agentic 流采用「固定管道」（get_capabilities → get_workflow → LLM 生成 → validate → propose），未接入 LLM 的 tool_calls；新旧流并行，默认仍为原有 `POST /alkaid/messages/stream`。

---

## 2. 后端实现（Low_code_Backend/modules/alkaid）

### 2.1 新增/修改文件

| 路径 | 说明 |
|------|------|
| **models/progress.go** | Phase 常量、AgentToolStep、SSE 事件 payload 结构（SSEContent、SSEPhaseChanged、SSEToolStepStarted 等） |
| **models/alkaid.go** | 会话表扩展：CurrentPhase、ToolStepsJSON、PendingWorkflowJSON、PendingPatchJSON |
| **migrations/010_alkaid_session_agentic_fields.sql** | 为 alkaid_sessions 增加上述四列 |
| **services/tools/registry.go** | 工具注册表，ExecuteTool(name, paramsJSON, sessionID)；支持 Runner 注入 |
| **services/tools/runner.go** | Runner 依赖：CapabilitiesProvider、Repo、WorkflowServiceProvider、Executor、NodeSpecByType |
| **services/tools/get_capabilities.go** | get_capabilities 占位 + runGetCapabilities（调 CapabilitiesService） |
| **services/tools/get_workflow.go** | get_workflow 从 session.WorkflowID + WorkflowService.GetWorkflowNodes 读取 |
| **services/tools/get_node_spec.go** | get_node_spec 通过 Runner.NodeSpecByType(nodeType) 返回规格 |
| **services/tools/validate_workflow.go** | validate_workflow 结构校验（version、nodes、edges、节点 id/type、边 source/target） |
| **services/tools/run_workflow_trial.go** | run_workflow_trial 将 workflow 转为 ExecutionRequest，调用 WorkflowExecutor.Execute |
| **services/tools/propose_workflow.go** | propose_workflow 写入 session.PendingWorkflowJSON，不写画布 |
| **services/tools/propose_patch.go** | propose_patch 写入 session.PendingPatchJSON |
| **services/agentic/stream_writer.go** | SSE 写入器：WriteContent、WritePhaseChanged、WriteToolStepStarted/Finished、WritePendingWorkflow/Patch、WriteDone、WriteError |
| **services/agentic/loop.go** | RunStream：保存用户消息 → 推送 phase planning → 执行 get_capabilities/get_workflow → 调用现有 LLM 流式生成 → 抽取 JSON → validate → propose_workflow → 推送 pending_workflow/done；capabilitiesProviderAdapter、workflowServiceAdapter |
| **services/agentic/apply.go** | ApplyWorkflow（pending 转 SaveWorkflowNodesRequest 写画布并清空 pending）、ApplyPatch（当前仅清空 pending） |
| **services/alkaid_service.go** | 新增 GetCapabilities、BuildSystemPromptForAgentic |
| **controllers/alkaid_controller.go** | 新增 GetCapabilities、SessionStream、ApplyWorkflow、ApplyPatch |

### 2.2 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/alkaid/capabilities | 返回能力说明（节点类型、工作流规范等） |
| POST | /api/alkaid/sessions/:id/stream | **Agentic 流式接口**，Body: `{ message, interrupt? }`，SSE: content / phase_changed / tool_step_* / pending_workflow / pending_patch / done / error |
| POST | /api/alkaid/apply-workflow | Body: `{ sessionId, workflowId? }`，将会话 pendingWorkflow 写入画布 |
| POST | /api/alkaid/apply-patch | Body: `{ sessionId, workflowId? }`，清空会话 pendingPatch（实际应用 patch 逻辑可后续补全） |

### 2.3 数据流（Agentic 流）

1. 客户端 POST `/api/alkaid/sessions/:id/stream`，Body `{ message }`。
2. 服务端保存用户消息，创建 SSE 写入器，推送 `phase_changed: planning`。
3. 依次执行工具并推送 `tool_step_started` / `tool_step_finished`：get_capabilities、get_workflow。
4. 推送 `phase_changed: generating`，调用现有 DeepSeek ChatStream 生成回复，逐 delta 推送 `content`。
5. 保存助手消息，从回复中抽取工作流 JSON；若存在则推送 `phase_changed: validating`，执行 validate_workflow，再执行 propose_workflow，推送 `pending_workflow`、`phase_changed: idle`、`done`。
6. 客户端解析 SSE，更新 phase、toolSteps、assistantContent、pendingWorkflow；用户可点击「应用到画布」调用 apply-workflow。

---

## 3. 前端实现（Low_code_Frontend）

### 3.1 新增/修改文件

| 路径 | 说明 |
|------|------|
| **components/Alkaid/types/progress.ts** | Phase、ToolStepStatus、AgentToolStep、SSE 事件 data 类型、AlkaidProgressState、WorkflowExportData、PatchItem |
| **components/Alkaid/types/index.ts** | 导出上述类型 |
| **components/Alkaid/components/AlkaidProgress.tsx** | 展示当前 Phase 文案 + 最近 N 条 ToolStep（pending/running/success/error），可折叠 |
| **components/Alkaid/components/AlkaidPendingWorkflow.tsx** | 待确认工作流摘要 +「应用到画布」「放弃」按钮 |
| **components/Alkaid/components/AlkaidProgress.module.scss** | 进度区样式 |
| **api/alkaid.ts** | sessionStreamAgentic(sessionId, message, callbacks)、applyWorkflow、applyPatch；Session 类型增加 currentPhase、toolSteps、pendingWorkflow、pendingPatch |
| **types/alkaid.ts** | Session 增加可选字段 currentPhase、toolSteps、pendingWorkflow、pendingPatch |

### 3.2 API 使用说明

- **原有流**：`alkaidApi.sendMessageStream(sessionId, content, onMessage, onError)`，事件为 `event: message`，data 为 `{ content, step, done }`。
- **Agentic 流**：`alkaidApi.sessionStreamAgentic(sessionId, message, { onContent, onPhaseChanged, onToolStepStarted, onToolStepFinished, onPendingWorkflow, onPendingPatch, onDone, onError })`，SSE 事件与文档 4.2 一致。
- **应用工作流**：`alkaidApi.applyWorkflow(sessionId, workflowId?)`；**应用补丁**：`alkaidApi.applyPatch(sessionId, workflowId?)`。

### 3.3 集成方式

- **AlkaidAssistant** 当前仍使用原有 `sendMessageStream` 与 ProcessLoader；若要启用 Agentic 流，可在组件内增加开关（如 `useAgentic`），为 true 时调用 `sessionStreamAgentic` 并展示 `AlkaidProgress`，在收到 `onPendingWorkflow` 时展示 `AlkaidPendingWorkflow`，点击「应用到画布」调用 `applyWorkflow` 并刷新画布（或通过 onWorkflowGenerated 回调传入从 session 拉取的 pending 数据并执行现有 importWorkflow）。

---

## 4. 架构与隔离

- **后端**：Agentic 逻辑全部在 `modules/alkaid` 内（agentic 子包、tools 子包）；与 workflow 的对接通过 `workflowServiceAdapter` 与 `apply.ApplyWorkflow` 调用现有 `SaveWorkflowNodes`。
- **前端**：新类型与组件均在 `components/Alkaid` 下；新旧流通过不同 API 入口区分，互不影响。
- **替换策略**：将 AlkaidAssistant 默认改为调用 `sessionStreamAgentic` 并挂载 AlkaidProgress、AlkaidPendingWorkflow 后，即可切到新流；旧流保留为兼容或移除。

---

## 5. 后续可做

1. **LLM tool_calls**：接入支持 function calling 的模型，将固定管道改为「LLM 决定调用哪些工具、循环直到无 tool_calls」。
2. **打断**：SessionStream 支持 Body `interrupt: true`，后端标记当前轮次取消并可选 `event: interrupted`。
3. **apply-patch 真实应用**：根据 pendingPatch 的 op/path/value 调用 SaveWorkflowNode 或批量更新后 SaveWorkflowNodes。
4. **Hooks**：BeforeApplyWorkflow、OnWorkflowRunFailed 等配置与调用点。
5. **国际化**：为 `workflowEditor.alkaid.*` 补全中英文键（已预留 applyToCanvas、discard、pendingWorkflow 等）。

---

## 6. 文档与规范

- 架构说明：`ALKaid-Architecture.md`
- 任务清单与实现细则：`ALKaid-Implementation-TaskList-And-Tech.md`
- 功能增强目标：`ALKaid-Enhancement-ClaudeCode-Style.md`
- 与上述文档冲突时，以任务清单与增强文档为准；本总结仅描述当前代码实现状态。
