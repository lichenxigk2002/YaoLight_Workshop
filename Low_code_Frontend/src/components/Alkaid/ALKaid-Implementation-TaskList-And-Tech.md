# 瑶光星增强 · 开发任务清单与详细技术实现

> 本文档与《瑶光星 · 功能增强文档（智能体与工作流进度）》配套，给出**分阶段任务清单**与**各模块的详细技术实现说明**，便于排期与落地开发。

---

# 第一部分：开发任务清单

## 阶段一：基础能力（进度模型 + 工具骨架 + 会话）

| 序号 | 任务 | 负责 | 产出 | 依赖 |
|------|------|------|------|------|
| 1.1 | 定义并实现**进度与工具步**的共享类型（Phase 枚举、AgentToolStep、事件 payload） | 后端 + 前端约定 | 类型定义文件 / OpenAPI 片段 | 无 |
| 1.2 | 后端：实现**会话**创建与存储（sessionId、消息历史、当前 phase、toolSteps 列表、待确认的 workflow/patch） | 后端 | 会话存储接口 + 内存/Redis 实现 | 1.1 |
| 1.3 | 后端：实现 **GET /api/alkaid/capabilities**（或复用现有），保证返回结构满足智能体使用 | 后端 | 接口可用 + 文档 | 无 |
| 1.4 | 后端：实现**工具层骨架**——工具注册表、统一调用入口 `executeTool(name, params, sessionId)`，先实现占位返回 | 后端 | 工具路由 + 占位实现 | 1.1, 1.2 |
| 1.5 | 前端：定义**进度状态**（currentPhase、toolSteps[]）、与后端事件 payload 对齐的类型 | 前端 | 类型 + 状态结构 | 1.1 |

**阶段一验收**：可创建会话；后端能根据工具名路由到占位实现并返回；前后端对 Phase/AgentToolStep 结构一致。

---

## 阶段二：Agentic Loop 与工具实现

| 序号 | 任务 | 负责 | 产出 | 依赖 |
|------|------|------|------|------|
| 2.1 | 后端：接入 **LLM（支持 tool/function calling）**，实现单轮「发消息 → 收 response（含 tool_calls）→ 执行工具 → 把结果 append 到消息」 | 后端 | Agent 单轮流程 | 1.2, 1.4 |
| 2.2 | 后端：实现 **Agentic Loop**：循环调用 LLM 直至无 tool_calls 或达到 max_steps；在每步工具前后推送 phase/tool_step 事件 | 后端 | 完整 Loop + 事件推送占位 | 2.1, 1.4 |
| 2.3 | 后端：实现只读工具 **get_capabilities**、**get_workflow**、**get_node_spec**（get_workflow 需对接前端/画布状态或会话内缓存的「当前画布」） | 后端 | 3 个工具可调通 | 1.3, 1.4 |
| 2.4 | 后端：实现 **validate_workflow**（对接现有校验逻辑），返回 `{ valid, errors[] }`；实现 **run_workflow_trial**（对接执行器试跑），返回成功摘要或 ExecutionError | 后端 | 2 个工具可调通 | 1.4, 现有 validate/执行器 |
| 2.5 | 后端：实现 **propose_workflow**、**propose_patch**（仅写入会话状态「待确认」，不写画布），返回确认提示 | 后端 | 2 个工具可调通 + 会话中可存 pendingWorkflow/pendingPatch | 1.2, 1.4 |
| 2.6 | 后端：编写 **LLM system prompt**：角色、输出规范、可用工具说明、Phase 与工具对应关系（供模型合理选择工具） | 后端/算法 | system prompt 文档 + 注入逻辑 | 2.1 |
| 2.7 | 后端：**流式接口**：`POST /api/alkaid/chat` 或 `POST /api/alkaid/session/{sessionId}/stream`，请求体含 userMessage；响应为 SSE 流，包含 assistant 流式文本 + 进度事件（phase_changed、tool_step_*） | 后端 | 接口可用 + SSE 协议文档 | 2.2 |

**阶段二验收**：用户发一条消息后，后端能完成多轮工具调用并流式返回回复；进度事件在 SSE 中可被解析；至少 5 个工具（get_capabilities、get_workflow、get_node_spec、validate_workflow、propose_workflow）有真实实现。

---

## 阶段三：前端进度 UI 与人类在环

| 序号 | 任务 | 负责 | 产出 | 依赖 |
|------|------|------|------|------|
| 3.1 | 前端：**解析 SSE 流**，区分「assistant 文本块」与「进度事件」（phase_changed、tool_step_started、tool_step_finished），更新本地 state（phase、toolSteps） | 前端 | 流解析 + 状态更新 | 2.7, 1.5 |
| 3.2 | 前端：**进度展示组件**——当前 Phase 文案 + 最近 N 条 ToolStep 列表（pending/running/success/error），可折叠/展开详细 | 前端 | AlkaidProgress 或等价组件 | 3.1 |
| 3.3 | 前端：瑶光星面板集成进度组件（顶部或侧边），与对话区域同屏展示 | 前端 | 布局 + i18n 占位 | 3.2 |
| 3.4 | 前端：当会话中存在 **pendingWorkflow** 时，展示摘要（节点数、边数、关键节点类型）+ 按钮「应用到画布」「放弃」；点击「应用」调用 **apply-workflow** 并清空 pending | 前端 | 确认 UI + 调用接口 | 2.5, 后端 apply-workflow |
| 3.5 | 前端：当会话中存在 **pendingPatch** 时，展示 diff 或变更列表 + 「应用」「放弃」；点击「应用」调用 **apply-patch** 并清空 pending | 前端 | 确认 UI + 调用接口 | 2.5, 后端 apply-patch |
| 3.6 | 后端：**POST /api/alkaid/apply-workflow**、**POST /api/alkaid/apply-patch**（需会话 id + 当前用户权限校验）；内部执行写画布或应用 patch，并清空该会话的 pending | 后端 | 2 个接口 | 1.2, 现有导入/patch 逻辑 |
| 3.7 | 前端：**打断**——用户在有未完成 Agent 轮次时发送新消息，前端标记「已打断」并发送新消息；后端需支持「取消当前轮次、以新消息为新一轮」 | 前端+后端 | 打断语义一致 | 2.2 |

**阶段三验收**：对话过程中能看到阶段与工具步；出现待确认工作流/补丁时可确认应用或放弃；应用后画布更新；打断后 Agent 以新输入继续。

---

## 阶段四：Hooks 与可选子代理

| 序号 | 任务 | 负责 | 产出 | 依赖 |
|------|------|------|------|------|
| 4.1 | 后端：**Hook 配置**：支持在配置中注册 BeforeGenerate、AfterGenerate、BeforeApplyWorkflow、OnWorkflowRunFailed 的回调 URL 或脚本路径 | 后端 | 配置结构 + 加载逻辑 | 无 |
| 4.2 | 后端：在相应时机**调用 Hook**（生成前/后、应用前、运行失败时），传入 event、sessionId、payload；解析返回的 allow/reason，拒绝时中断并返回原因给前端 | 后端 | Hook 执行器 + 与 Loop/apply 集成 | 4.1, 2.2, 3.6 |
| 4.3 | 前端：当 Hook 拒绝时展示 **reason**，不执行应用或继续生成 | 前端 | 错误展示 | 4.2 |
| 4.4 | （可选）后端：**子代理**——诊断子代理、修图子代理的输入输出约定；主 Agent 通过「调用子代理」工具或内部函数调用，将子代理结果汇总回主会话 | 后端 | 子代理调用链 | 2.2 |

**阶段四验收**：至少 BeforeApplyWorkflow 或 OnWorkflowRunFailed 之一可配置并生效；拒绝时前端能看到原因。

---

## 阶段五：国际化、安全与联调

| 序号 | 任务 | 负责 | 产出 | 依赖 |
|------|------|------|------|------|
| 5.1 | 国际化：为 Phase 文案、ToolStep 状态、按钮（应用/放弃）、错误提示等增加 **workflowEditor.alkaid.*** 键，中英文 | 前端 | zh-CN / en-US 条目 | 3.2, 3.4, 3.5 |
| 5.2 | 安全：**apply-workflow / apply-patch** 校验当前用户对该工作流/画布的权限；Hook 与工具不把 token/密钥写入 prompt 或日志 | 后端 | 权限校验 + 审计点 | 3.6, 4.2 |
| 5.3 | 联调：端到端测试——发需求 → 多步工具 → 进度展示 → 提出工作流 → 应用 → 画布正确更新 | 全员 | 测试用例/清单 | 阶段二、三完成 |

---

# 第二部分：详细技术实现

## 1. 进度与事件模型（后端 + 前端共享）

### 1.1 类型定义（TypeScript 示例，后端可用等价结构体）

```ts
// 阶段
type Phase =
  | 'idle'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'repairing'
  | 'running_trial'
  | 'summarizing'
  | 'waiting_approval'
  | 'error';

// 工具步
interface AgentToolStep {
  stepId: string;
  phase: Phase;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt: string;   // ISO8601
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}

// SSE 事件类型（每条一行 JSON）
type ProgressEvent =
  | { event: 'phase_changed'; phase: Phase; at: string }
  | { event: 'tool_step_started'; stepId: string; toolName: string; phase: Phase; at: string }
  | { event: 'tool_step_finished'; stepId: string; status: AgentToolStep['status']; resultSummary?: string; errorMessage?: string; at: string };
```

### 1.2 会话状态（后端存储）

建议每个会话保存：

- `sessionId: string`
- `workflowEditorInstanceId` 或 `canvasId`（关联当前画布，用于 get_workflow / apply）
- `messages: Array<{ role: 'user'|'assistant'|'system'; content: string; toolCalls?: ...; toolCallId?: string }>`
- `currentPhase: Phase`
- `toolSteps: AgentToolStep[]`（可只保留最近 50 条）
- `pendingWorkflow: WorkflowExportData | null`
- `pendingPatch: PatchItem[] | null`
- `createdAt`, `updatedAt`

---

## 2. Agentic Loop 流程（后端）

### 2.1 主流程伪代码

```
1. 收到 POST /api/alkaid/session/:sessionId/stream { message: string }
2. 将 user message 追加到 session.messages
3. 若存在 pending 且未超时，可选：将 pending 摘要作为 context 注入
4. 设置 currentPhase = 'planning'，推送 phase_changed
5. Loop:
   a. 调用 LLM（messages + tools 定义），stream=true
   b. 对于 stream 中每个 delta：
      - 若为 content delta：转发给前端（SSE data 行）
      - 若为 tool_calls：累积完整 tool_calls
   c. 若本轮 response 无 tool_calls：
      - 设置 phase = 'idle' 或 'summarizing' 后 'idle'，推送 phase_changed
      - 结束 Loop
   d. 对每个 tool_call：
      - 生成 stepId，推送 tool_step_started，phase 按工具名映射（如 validate_workflow -> validating）
      - 执行 executeTool(toolName, toolArgs, sessionId)
      - 推送 tool_step_finished（含 resultSummary/errorMessage）
      - 将 tool 结果以 assistant message 形式追加到 messages（role=assistant, content 含 tool_call_id + result）
   e. 若 step 数 >= maxSteps 或 用户已打断：退出 Loop，推送 phase = 'idle' 或 'error'
   f. 回到 5.a（继续请求 LLM，此时 messages 已含工具结果）
6. 关闭 SSE 流
```

### 2.2 工具名 → Phase 映射（建议）

| toolName | phase |
|----------|--------|
| get_capabilities, get_workflow, get_node_spec | planning |
| 内部「生成」或调用生成服务 | generating |
| validate_workflow | validating |
| 内部 repair / propose_patch | repairing |
| run_workflow_trial | running_trial |
| propose_workflow, propose_patch | 之后设为 waiting_approval |

### 2.3 打断处理

- 前端发送新消息时，若当前有未结束的 stream，可带 query 参数 `interrupt=true` 或单独 `POST .../interrupt`。
- 后端：标记该 session 的「当前轮次」为已取消，不再向已打开的 SSE 写入新内容（或写入一条 `event: interrupted`）；新请求作为新一轮，从步骤 1 开始。

---

## 3. 各工具实现要点

### 3.1 get_capabilities

- 输入：无或 `{ capabilitiesVersion?: string }`。
- 实现：调用现有 `GET /api/alkaid/capabilities` 的逻辑或直接读 Capabilities 静态/动态数据。
- 返回：`{ capabilitiesVersion, workflowSchema, nodeTypes: [...] }`，便于模型生成时遵守规范。
- resultSummary：如 "返回 N 种节点类型"。

### 3.2 get_workflow

- 输入：无。
- 实现：从会话关联的「当前画布」读取；若前端在打开瑶光星时已把当前画布 JSON 发到服务端（如存在 session 或单独接口），则从该处取；否则返回 `{ workflow: null }`。
- 返回：`WorkflowExportData | null`。
- resultSummary：有则 "当前画布共 X 节点"；无则 "当前无画布"。

### 3.3 get_node_spec

- 输入：`{ nodeType: string }`。
- 实现：从 Capabilities 的 nodeTypes 中取对应 type 的 spec（defaults、configSchema、io、constraints）。
- 返回：单节点规格对象。
- resultSummary：如 "crawler 节点规格"。

### 3.4 validate_workflow

- 输入：`{ workflow: WorkflowExportData }`。
- 实现：复用现有校验逻辑（如原 8.3），返回 `{ valid: boolean, errors: { path?, message?, code? }[] }`。
- 返回：完整 errors 给模型；resultSummary 给用户如 "校验通过" 或 "发现 2 处错误"。

### 3.5 run_workflow_trial

- 输入：`{ workflow: WorkflowExportData, timeout?: number }`。
- 实现：调用执行器试跑；成功则返回摘要（如各节点状态、输出条数）；失败则返回 ExecutionError（failedNodeId、errorCode、message、details）。
- 权限/安全：若配置要求用户确认试跑，需在首次试跑前由前端确认后再调该工具（或由后端检查 session 内「用户已同意试跑」标记）。

### 3.6 propose_workflow

- 输入：`{ workflow: WorkflowExportData, explanation?: string }`。
- 实现：写入 `session.pendingWorkflow = workflow`，可选存 explanation；不写画布。
- 返回：`{ status: 'pending_approval', message: '已生成工作流，请在前端确认应用' }`。
- resultSummary：如 "已提出工作流，共 6 节点，等待用户确认"。

### 3.7 propose_patch

- 输入：`{ patch: PatchItem[], reason?: string }`。PatchItem 建议：`{ op: 'set'|'add'|'remove', nodeId: string, path: string, value?: unknown }`。
- 实现：写入 `session.pendingPatch = patch`；不直接改画布。
- 返回：同 propose_workflow 风格。
- resultSummary：如 "已提出 2 处修改，等待用户确认"。

---

## 4. SSE 流式接口协议

### 4.1 请求

- **POST** `/api/alkaid/session/:sessionId/stream`
- Body：`{ message: string, interrupt?: boolean }`
- Header：`Accept: text/event-stream`，鉴权同现有接口。

### 4.2 响应（Content-Type: text/event-stream）

- 每行一个 event，格式为 SSE：`event: <type>\ndata: <json>\n\n`。
- 类型约定：
  - **content**：assistant 文本流。`data` 为 `{ delta: string }`，前端拼接为当前回复内容。
  - **phase_changed**：`data` 为 `{ phase: Phase, at: string }`。
  - **tool_step_started**：`data` 为 `{ stepId, toolName, phase, at }`。
  - **tool_step_finished**：`data` 为 `{ stepId, status, resultSummary?, errorMessage?, at }`。
  - **pending_workflow**：模型调用了 propose_workflow 后推送，`data` 为 `{ summary: { nodeCount, edgeCount } }`，前端可据此显示「有待确认的工作流」。
  - **pending_patch**：同上，`data` 为 `{ patchCount: number }`。
  - **done**：本轮结束，`data` 为 `{}`。
  - **error**：本轮异常，`data` 为 `{ message: string }`。

### 4.3 前端解析示例

```ts
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  let eventType = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) eventType = line.slice(7).trim();
    else if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (eventType === 'content') appendAssistantContent(data.delta);
      else if (eventType === 'phase_changed') setPhase(data.phase);
      else if (eventType === 'tool_step_started') appendToolStep(data);
      else if (eventType === 'tool_step_finished') updateToolStep(data);
      // ...
    }
  }
}
```

---

## 5. 前端状态与组件职责

### 5.1 状态建议（如 React）

- `sessionId: string | null`
- `phase: Phase`
- `toolSteps: AgentToolStep[]`（保留最近 10～20 条）
- `assistantContent: string`（当前轮次累积的回复）
- `pendingWorkflow: WorkflowExportData | null`
- `pendingPatch: PatchItem[] | null`
- `streaming: boolean`
- `error: string | null`

### 5.2 组件拆分

- **AlkaidPanel**：容器，包含对话区 + 进度区 + 待确认区。
- **AlkaidProgress**：展示 phase 文案 + toolSteps 列表；支持简洁/详细模式。
- **AlkaidPendingWorkflow**：展示待确认工作流摘要 + 「应用到画布」「放弃」；调用 apply-workflow。
- **AlkaidPendingPatch**：展示 patch 列表/diff + 「应用」「放弃」；调用 apply-patch。
- **AlkaidChat**：输入框 + 发送；支持打断（发送时若 streaming 则带 interrupt 或先调 interrupt 再发）。

### 5.3 应用工作流/补丁流程

1. 用户点击「应用到画布」。
2. 前端调用 `POST /api/alkaid/apply-workflow`（body 可只含 sessionId，服务端从 session 取 pendingWorkflow）或 `apply-patch`。
3. 后端执行：权限校验 → 可选 BeforeApplyWorkflow Hook → 写入画布（调用现有 importWorkflow 或 applyPatch）→ 清空 session 的 pending → 返回成功。
4. 前端清空 pending 状态，关闭待确认卡片，并通知画布刷新（或由画布轮询/WebSocket 拉取最新数据）。

---

## 6. Hooks 实现要点

### 6.1 配置结构（示例）

```json
{
  "alkaid": {
    "hooks": {
      "BeforeGenerate": { "type": "http", "url": "https://..." },
      "BeforeApplyWorkflow": { "type": "script", "script": "/path/to/check.sh" }
    }
  }
}
```

### 6.2 调用约定

- 入参 POST body：`{ event, sessionId, payload }`。payload 示例：
  - BeforeGenerate：`{ userMessage: string }`
  - BeforeApplyWorkflow：`{ workflow: WorkflowExportData }`
  - OnWorkflowRunFailed：`{ executionError: ExecutionError, workflowId?: string }`
- 返回：200 + `{ allow: true }` 或 200 + `{ allow: false, reason: string }`。
- 超时：如 5s；超时或异常时视为 allow: true 并打日志。

### 6.3 集成点

- BeforeGenerate：在 Agent Loop 第一次进入「即将调用生成」时（例如模型决定调用 propose_workflow 之前，或第一轮 LLM 返回前由业务判断）调用。
- BeforeApplyWorkflow：在 apply-workflow 接口内，写画布之前调用。
- OnWorkflowRunFailed：在 run_workflow_trial 工具内，试跑失败时调用；可根据 Hook 返回决定是否自动把错误注入会话以便模型修复（可选）。

---

## 7. 子代理（可选）实现要点

- 主 Agent 的 system prompt 中增加一个「工具」：`invoke_subagent`，参数为 `{ subagent: 'diagnoser'|'repairer', input: object }`。
- 后端：`executeTool('invoke_subagent', args)` 时，不调用外部 LLM，而是调用内部「诊断服务」或「修图服务」：输入为 args.input（如 ExecutionError + 工作流片段），输出为结构化诊断或 patch 列表；将结果格式化为 tool result 返回主 Agent。
- 进度：可增加 phase `diagnosing` / `repairing`，并推送一条 tool_step（toolName=invoke_subagent），resultSummary 为子代理结果摘要。

---

## 8. 需要实现/对接的接口汇总

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/alkaid/capabilities | GET | 已有或新增，返回 Capabilities |
| /api/alkaid/session | POST | 创建会话，返回 sessionId；body 可含 canvasId |
| /api/alkaid/session/:id/stream | POST | 发送消息并接收 SSE 流（assistant + 进度事件） |
| /api/alkaid/session/:id/interrupt | POST | 打断当前轮次（可选，或由 stream 请求带参数） |
| /api/alkaid/apply-workflow | POST | 将 session 的 pendingWorkflow 应用到画布；body 含 sessionId |
| /api/alkaid/apply-patch | POST | 将 session 的 pendingPatch 应用到画布；body 含 sessionId |
| /api/alkaid/validate-workflow | POST | 已有或复用，body 含 workflow，返回 { valid, errors } |
| 执行器试跑 | 内部 | run_workflow_trial 内部调用，返回摘要或 ExecutionError |

---

以上任务清单与实现说明可直接用于排期与编码；与增强文档冲突时以《瑶光星 · 功能增强文档》为准，本文档作为实现细则。
