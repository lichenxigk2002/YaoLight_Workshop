# 瑶光星增强 · 未实现清单

> 本文档仅列出**尚未实现**的功能，便于排期与迭代。与 `04-ALKaid-Implementation-Summary.md`、`06-ALKaid-Implementation-Round2-Summary.md` 配套使用；实现后可从本清单移除或标注完成。

---

## 1. 未实现功能列表

| 序号 | 功能 | 对应任务 | 说明 |
|------|------|----------|------|
| 1 | **LLM tool_calls** | 阶段二 2.1 / 2.2 | 当前为固定管道（get_capabilities → get_workflow → LLM → validate → propose）。未接入「模型按需选工具、多轮 tool_calls 循环」。需：接入支持 function calling 的模型、维护 messages + tool result、解析 model 返回的 tool_calls、循环直至无 tool_calls 或达 max_steps。 |
| 2 | **OnWorkflowRunFailed Hook** | 阶段四 4.1 / 4.2 | 仅已实现 BeforeApplyWorkflow。OnWorkflowRunFailed：工作流试跑失败时调用，传入 event、sessionId、payload；可配置回调 URL，解析 allow/reason。 |
| 3 | **AfterGenerate Hook** | 阶段四 4.1 / 4.2 | LLM 生成完成后、写入会话前的回调；可做合规/风控。 |
| 4 | **BeforeGenerate Hook** | 阶段四 4.1 / 4.2 | LLM 生成前的回调；可做意图过滤或参数注入。 |
| 5 | **子代理** | 阶段四 4.4（可选） | 诊断子代理、修图子代理等的输入输出约定；主 Agent 通过「调用子代理」工具或内部调用，将子代理结果汇总回主会话。 |
| 6 | **联调与端到端测试** | 阶段五 5.3 | 端到端测试：发需求 → 多步工具 → 进度展示 → 提出工作流/补丁 → 应用 → 画布正确更新。需产出测试用例或测试清单。 |
| 7 | **安全与审计增强** | 阶段五 5.2（部分） | apply-workflow/apply-patch 权限校验已完成。未做：Hook 与工具不把 token/密钥写入 prompt 或日志的审计点与规范（可文档化 + 代码检查）。 |
| 8 | **pendingPatch 变更明细与画布预览** | 阶段三 3.5（增强） | 当前 pending_patch SSE 仅返回 patchCount，前端只显示「N 项变更」。本功能需要一套清晰的后端事件结构 + 前端 UI + 画布预览方案，详见下文 1.1。 |

---

## 1.1 pendingPatch 变更明细与画布预览 —— 详细方案

### 1.1.1 目标与范围

- **目标**：
  - 当出现待确认补丁时，让用户明确知道：**哪些节点会被新增/删除/修改，边是否会发生变化**。
  - 在不真正写库的前提下，以「预览高亮」形式在工作流画布上展示这些即将发生的变更，用户确认后再应用补丁。
- **范围**：
  - 仅针对 Agentic 流产生的 `pendingPatch`；不改变现有 `apply-patch` 接口语义。

### 1.1.2 后端改动（Agentic + 工具）

- **E1：扩展 pending_patch SSE 事件 payload**
  - 现状：`pending_patch` 事件 data 为 `{ patchCount: number }`。
  - 目标：扩展为（推荐）：
    ```json
    {
      "patchCount": 3,
      "summary": {
        "addedNodeIds": ["node-7"],
        "removedNodeIds": ["node-3"],
        "updatedNodeIds": ["node-5"],
        "edgesChanged": true
      }
    }
    ```
  - 实现要点：
    - 在 `ComputeWorkflowDiff` 计算补丁时，同时统计：
      - `addedNodeIds`：所有 `op=add` 补丁的 nodeId。
      - `removedNodeIds`：所有 `op=remove` 的 nodeId。
      - `updatedNodeIds`：所有 `op=set` 的 nodeId（可去重）。
      - `edgesChanged`：是否存在 `op=set_edges`。
    - 将上述字段封装进 `SSEPendingPatch`，由 `WritePendingPatch` 写出。

- **E2：会话接口中暴露 pendingPatch（可选增强）**
  - 在 `GetSession` 或 `GetMessages` 返回的 Session JSON 中，确保 `pendingPatch` 字段（会话中的完整补丁列表）可被前端读取（只读）。
  - 用途：当前端仅收到 summary 时，用户点击「查看详情」可选择性拉取完整补丁（PatchItem[]）用于更精细的 diff 或调试。

### 1.1.3 前端改动（AlkaidAssistant + PendingPatch + 画布）

- **F1：类型与状态更新**
  - 更新 `types/progress.ts` 中的：
    ```ts
    export interface SSEPendingPatch {
      patchCount: number;
      summary?: {
        addedNodeIds?: string[];
        removedNodeIds?: string[];
        updatedNodeIds?: string[];
        edgesChanged?: boolean;
      };
    }
    ```
  - 在 `AlkaidAssistant` 中新增：
    - `agenticPendingPatchSummary`：保存 `summary`，用于 UI 展示与画布预览。

- **F2：待确认补丁 UI（AlkaidPendingPatch 增强）**
  - 现状：只展示「待确认补丁：N 项变更」+「应用补丁 / 放弃」。
  - 目标：在 Popover 中追加「变更明细」：
    - 若有 `addedNodeIds`：列出“将新增节点：node-7, ...”（如有 label，可展示 label）。
    - 若有 `removedNodeIds`：列出“将删除节点：node-3, ...”。
    - 若有 `updatedNodeIds`：列出“将修改节点：node-5（位置/配置）”——文案可简单写为“配置或位置变更”，无需逐字段。
    - 若 `edgesChanged` 为 true：提示“边列表将更新”。
  - 所有文案使用 `workflowEditor.alkaid.*` 前缀（例如：`workflowEditor.alkaid.pendingPatch.addedNodes` 等）。

- **F3：画布预览（只读高亮，不改库）**
  - 在 WorkflowEditor 组件中增加一个简单的「预览状态」：
    ```ts
    interface PatchPreview {
      addedNodeIds?: string[];
      removedNodeIds?: string[];
      updatedNodeIds?: string[];
      edgesChanged?: boolean;
    }
    ```
  - 与 AlkaidAssistant 约定：
    - 收到 `pending_patch` 时，通过 props 或全局 store 将 `PatchPreview` 传给画布。
    - 用户点击「应用补丁」或「放弃」后，清空该预览状态。
  - 渲染效果建议（不改真实数据，只加样式）：
    - `addedNodeIds`：对应节点用「虚线边框」「淡色背景」或专用图标表示“将新增”；若画布上暂不存在该节点，可仅在列表中提示。
    - `removedNodeIds`：对应节点用红色边框或半透明表示“将删除”，并在 hover 时提示。
    - `updatedNodeIds`：对应节点用黄色边框或高亮描边表示“将修改配置/位置”。
    - `edgesChanged`：对所有边整体加一个轻微高亮，或在画布顶部显示“边列表将更新”的提示即可，避免过度复杂化。

### 1.1.4 交互与边界情况

- **覆盖策略**：若在一个会话中连续收到多次 `pending_patch`，前端只保留最新一份 summary/预览（以最后一次为准）。
- **当前无画布数据**：当 `currentWorkflow` 为空时，`ComputeWorkflowDiff` 会把所有节点视为新增；此时 UI 可仅展示“将新增 N 个节点、M 条边”，画布预览可选。
- **大补丁场景**：当 patchCount 很大时，可退化为只展示 top N 个节点 ID + 总数，画布只做轻量提示，避免渲染压力。

---

## 2. 按阶段归类

| 阶段 | 未实现项 |
|------|----------|
| **阶段二** | LLM tool_calls（模型选工具 + 多轮循环） |
| **阶段三** | pendingPatch 变更明细与画布预览（增强版 3.5） |
| **阶段四** | OnWorkflowRunFailed、AfterGenerate、BeforeGenerate 三个 Hook；子代理（可选） |
| **阶段五** | 联调与端到端测试；安全/审计增强（token 不落盘） |

---

## 3. 参考文档

- 任务清单与实现细则：`03-ALKaid-Implementation-TaskList-And-Tech.md`
- 功能增强目标：`02-ALKaid-Enhancement-ClaudeCode-Style.md`
- 当前实现总结：`04-ALKaid-Implementation-Summary.md`、`06-ALKaid-Implementation-Round2-Summary.md`

实现上述任一项后，建议在本清单中标注完成或移至「已实现」说明，并同步更新 04/06 文档。
