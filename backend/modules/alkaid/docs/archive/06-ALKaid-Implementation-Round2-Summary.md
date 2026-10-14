# 瑶光星增强 · 第二轮实现总结（先做全）

> 本文档总结在「先做全、再做完善」前提下，本轮新增的代码与功能，并评估**已实现**与**未实现**项。与 `04-ALKaid-Implementation-Summary.md` 衔接，后者描述阶段一～三及 Agentic 流整体；本文档聚焦本轮补全内容。

---

## 1. 本轮实现范围概览

| 类别 | 内容 | 状态 |
|------|------|------|
| **打断**（阶段三 3.7） | 前端：发送新消息时若正在加载则先取消当前流再发；后端：request context 取消时写 `interrupted` 并退出 | ✅ 已完成 |
| **pendingPatch 前端**（阶段三 3.5 前端） | AlkaidPendingPatch 组件、onPendingPatch 状态、应用补丁/放弃、与 PendingWorkflow 同区展示 | ✅ 已完成 |
| **apply-patch 真实应用**（阶段三 3.5 后端） | 按 op（add/remove/set/set_edges）将 pendingPatch 应用到画布节点并 SaveWorkflowNodes | ✅ 已完成（见本轮补丁实现） |
| **Hooks**（阶段四 4.1～4.3） | BeforeApplyWorkflow 配置（环境变量 URL）、apply 前调用、拒绝时返回 reason；前端用现有 message.error 展示 | ✅ 已完成 |
| **国际化**（阶段五 5.1） | workflowEditor.alkaid.* 中英文键补全（pendingWorkflow/applyToCanvas/discard、pendingPatch/applyPatch/patchApplied、phase*、toolStep*、hookRejected） | ✅ 已完成 |
| **安全**（阶段五 5.2） | apply-workflow / apply-patch 校验工作流归属（wf.UserID == req.UserID） | ✅ 已完成 |

---

## 2. 本轮新增/修改文件清单

### 2.1 后端（backend/modules/alkaid）

| 路径 | 变更说明 |
|------|----------|
| **services/agentic/patch.go** | **新建**。`ComputeWorkflowDiff`（当前画布与提议工作流算 diff，产出 add/remove/set/set_edges）；`ApplyPatchToWorkflow`（按 patch 列表得到新 SaveWorkflowNodesRequest）；`PatchFromSession`（解析 PendingPatchJSON） |
| **models/progress.go** | 新增 `SSEInterrupted` 结构（interrupted 事件 payload） |
| **services/agentic/stream_writer.go** | 新增 `WriteInterrupted()`，发送 `event: interrupted` |
| **services/agentic/loop.go** | 使用 `ctx.Request.Context()`；在各步骤间 `checkCancel()`，取消时 `WriteInterrupted` 并 return；ChatStream 使用 reqCtx，流结束后若已取消则写 interrupted；移除未使用的 context 包 import |
| **services/agentic/apply.go** | ApplyWorkflow：获取工作流后校验、BeforeApplyWorkflow Hook、写画布。ApplyPatch：工作流归属校验后，用 `PatchFromSession` + `ApplyPatchToWorkflow` 得到新节点/边并 `SaveWorkflowNodes`，再清空 pending |
| **services/agentic/loop.go** | 捕获 get_workflow 结果为 currentWorkflow；校验通过并 propose_workflow 后，调用 `ComputeWorkflowDiff(currentWorkflow, proposedNodes, proposedEdges)`，若 patch 非空则 `ExecuteTool("propose_patch", ...)` 并 `WritePendingPatch(len(patch))` |
| **services/agentic/hooks.go** | **新建**。`CallBeforeApplyWorkflow(sessionID, workflowID, userID)`：读取环境变量 `ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL`，未配置则视为允许；否则 POST JSON `{ event, sessionId, workflowId, userId }`，解析 `{ allow, reason }`，拒绝时返回 (false, reason, nil) |

### 2.2 前端（frontend）

| 路径 | 变更说明 |
|------|----------|
| **api/alkaid.ts** | 解析 SSE `event: interrupted` 时调用 `onDone`，与正常结束一致清理状态 |
| **components/Alkaid/AlkaidAssistant.tsx** | 发送逻辑：若 `useAgentic && loading` 则先执行 `cancelStream()` 并清空 agentic 状态再发新消息（打断）；新增 `agenticPendingPatchCount`、`applyPatchLoading`；`onPendingPatch` 设置 patchCount；渲染 `AlkaidPendingPatch`，`handleApplyPatch` / `handleDiscardPendingPatch`；切换会话时清空 `agenticPendingPatchCount` |
| **components/Alkaid/components/AlkaidPendingPatch.tsx** | **新建**。待确认补丁：patchCount、应用补丁/放弃按钮，使用 `workflowEditor.alkaid.pendingPatch/applyPatch/discard` |
| **components/Alkaid/components/index.ts** | 导出 `AlkaidPendingPatch` |
| **components/Alkaid/index.ts** | 导出 `AlkaidPendingPatch` |
| **i18n/locales/zh-CN.json** | 在 `workflowEditor.alkaid` 下新增：pendingWorkflow、applyToCanvas、discard、pendingPatch、applyPatch、patchApplied、phaseIdle～phaseError、toolStepPending～toolStepError、hookRejected |
| **i18n/locales/en-US.json** | 同上，英文文案 |

---

## 3. 已实现功能汇总（含历史与本轮）

- **阶段一**：进度模型、会话扩展、工具骨架、GET capabilities、前端类型 ✅  
- **阶段二**：Agentic 流（固定管道）、SSE 事件、7 个工具、POST sessions/:id/stream ✅  
- **阶段三**：前端 SSE 解析、AlkaidProgress、AlkaidPendingWorkflow、apply-workflow/apply-patch 接口、**AlkaidAssistant 接入 Agentic（useAgentic、onWorkflowApplied）**、**打断（前端取消流+发新消息，后端 context 取消时写 interrupted）**、**pendingPatch 前端 UI（AlkaidPendingPatch、应用/放弃）** ✅  
- **阶段四**：**BeforeApplyWorkflow Hook（环境变量 URL、apply 前调用、拒绝返回 reason）** ✅；OnWorkflowRunFailed、AfterGenerate、BeforeGenerate、**子代理** ❌  
- **阶段五**：**workflowEditor.alkaid.* 国际化中英文** ✅、**apply-workflow/apply-patch 工作流归属权限校验** ✅；联调与端到端测试 ❌  

---

## 4. 未实现功能清单

| 序号 | 功能 | 对应文档 | 说明 |
|------|------|----------|------|
| 1 | **LLM tool_calls** | 阶段二 2.1/2.2 | 当前为固定管道；未接入「模型按需选工具、多轮 tool_calls 循环」。 |
| 2 | ~~**apply-patch 真实应用**~~ | 阶段三 3.5 后端 | 已实现：agentic/patch.go 计算 diff + ApplyPatchToWorkflow，apply.go 中 ApplyPatch 真正写画布。 |
| 3 | **OnWorkflowRunFailed / AfterGenerate / BeforeGenerate Hook** | 阶段四 4.1/4.2 | 仅实现 BeforeApplyWorkflow；其余 Hook 未配置与调用。 |
| 4 | **子代理** | 阶段四 4.4 | 诊断/修图等子代理及主 Agent 调用链未实现。 |
| 5 | **联调与端到端测试** | 阶段五 5.3 | 发需求→多步工具→进度→提出工作流→应用→画布更新的完整测试用例/清单未做。 |
| 6 | **安全增强** | 阶段五 5.2 | Hook 与工具不把 token/密钥写入 prompt 或日志的审计与规范，可按需补文档与检查。 |

---

## 5. SSE 事件与接口（本轮补充）

- **SSE 事件**：在既有 content / phase_changed / tool_step_* / pending_workflow / pending_patch / done / error 基础上，新增 **interrupted**（请求 context 取消时由后端发送）；前端解析后按 onDone 逻辑收尾。
- **Hook 配置**：环境变量 `ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL`；POST 请求体 `{ "event": "BeforeApplyWorkflow", "sessionId", "workflowId", "userId" }`，响应 `{ "allow": boolean, "reason": string }`。

---

## 6. 文档与索引

- 总体实现总结（阶段一～三 + 历史）：`04-ALKaid-Implementation-Summary.md`（已同步更新阶段四/五状态与「后续可做」）。
- 本轮回合总结：`06-ALKaid-Implementation-Round2-Summary.md`（本文档）。
- 与任务清单、增强文档冲突时，以《03-ALKaid-Implementation-TaskList-And-Tech》与《02-ALKaid-Enhancement-ClaudeCode-Style》为准。
