# 瑶光工坊 · 瑶光星 AI 助手（Alkaid）

## 1. 概述

瑶光星（Alkaid）是瑶光工坊工作流编辑器内置的 AI 对话式助手，用于将用户的自然语言目标自动转换为“可导入、可执行”的工作流。

核心输出物：
- 工作流 JSON（符合 `WorkflowExportData`），用户可直接导入并运行
- 可选的节点说明与注释卡片（commentCards），用于指导用户修改关键输入

核心目标：
- 降低新手搭建工作流门槛（不会“选节点/连线/变量传递”也能跑通）
- 提升首次跑通率与复用效率（模板化、可保存、可二次修改）

当前实现上，瑶光星支持两种对话流：**Agentic 流**（默认）与**旧流**。Agentic 流下，用户发消息后后端会按需调用能力说明、当前工作流、知识库检索等工具，经 LLM 生成回复并抽取工作流 JSON，校验后以「待确认工作流」或「待确认补丁」形式推送给前端；用户可查看阶段与工具步进度，并一键「应用到画布」或「应用补丁」。旧流仍为单轮流式生成，可从消息中解析工作流 JSON 导入。详见第 5.7 节与第 7、8 节。

## 2. 适用范围与边界

### 2.1 适用范围
- 面向目标清晰但不会搭建工作流的用户：适用于网页抓取、文本清洗、AI 摘要/结构化提取、文件输出等场景
- 面向需要快速生成模板后再进行微调的用户

### 2.2 当前边界（重要）
当前后端执行器对部分节点的实现为简化/占位，瑶光星第一阶段应避免生成依赖这些未完善能力的复杂工作流：

- `loop` 节点：后端当前仅将输入数组透传为 `results`，不会真正逐项驱动下游执行
- `transform` 节点：后端目前不执行 `script`（占位实现）

推荐第一阶段默认输出可运行最小模板：
```
start → crawler → dataclean → ai → output → end
```

## 3. 术语与数据协议

### 3.1 工作流导入/导出 JSON（WorkflowExportData）

导入/导出格式在前端已固定，瑶光星必须严格输出该结构：

- 入口文件：`src/utils/workflowImportExport.ts`
- 变换逻辑：`src/utils/workflowTransformers.ts`

#### 必填字段
- `version`: `"1.0.0"`
- `exportedAt`: ISO8601 时间戳字符串
- `nodes`: `NodeData[]`
- `edges`: `EdgeData[]`

#### 可选字段
- `name`: `string`
- `description`: `string`
- `commentCards`: `CommentCardData[]`

### 3.2 NodeData 最低要求

#### 必填字段
- `id`
- `type`

#### 建议字段
- `position`
- `data`：
  - `data.label`
  - `data.type`（需与 `type` 一致）
  - `data.connectionDirection`（建议使用 `"vertical"`）
  - `data.config`（参考节点默认配置）

#### 节点默认配置
用于配置补全与兜底，路径：`src/utils/nodeUtils.ts:getDefaultConfig`

### 3.3 EdgeData 最低要求

#### 必填字段
- `source`
- `target`

#### 建议字段
- `id`
- 条件分支（可选）：`sourceHandle: "true" | "false"`
- 合并多输入（可选）：`targetHandle: "input-0" | "input-1" | ...`

### 3.4 变量模板语法（后端模板解析）

执行器支持在多个节点配置字段中使用模板变量：

- 语法格式：`{{nodeId.variableName}}` 或 `{{nodeId.variableName.field}}`
- 实现入口：`backend/modules/workflow/services/variable_context.go`

#### 常用输出变量（以 `nodeIODefinitions` 为准）
- `start` 节点：`data`
- `crawler` 节点：`text`、`html`、`data`
- `dataclean` 节点：`cleaned`
- `ai` 节点：`result`

## 4. 节点知识库（瑶光星如何“懂节点”）

### 4.1 是否需要知识库
需要。瑶光星要稳定生成可执行 JSON，必须掌握：
- 支持的节点类型清单
- 每个节点的关键配置字段
- 节点 I/O 输出变量名（用于 contentVariable/dataVariable/urlVariable 等引用）
- 已知边界与推荐组合（例如避免 loop/transform 复杂逻辑）

### 4.1.1 重要共识：仅靠 RAG 不足以稳定生成可执行 JSON

即使未来所有节点都开发完整，也不建议仅依靠向量检索（RAG）来驱动工作流生成。原因：

- RAG 只能提供参考上下文，无法强制模型严格遵守 JSON 结构、字段枚举、必填项与变量引用规则
- 一次性生成容易出现：多输出解释文字、漏字段、字段拼写错误、枚举值不合法、变量引用不存在或来自错误上游

#### 推荐分工
- 结构化节点规格（NodeSpec / Capabilities）：负责硬约束（能配什么、必须配什么、变量名是什么）
- RAG：负责软知识（最佳实践、模板、排错手册、场景范式），用于提升生成质量与泛化能力

### 4.2 分层知识来源（推荐实现）

#### 第一阶段（必做，静态内置）
- 节点类型与默认配置：`src/utils/nodeUtils.ts`
- 节点 I/O 定义：`backend/modules/workflow/services/variable_context.go` 中的 `nodeIODefinitions`
- 执行逻辑约束：`workflow_executor.go` 中各 `executeXxxNode` 方法

#### 第二阶段（增强，动态注入）
- 系统预设模型列表、Provider 模板、用户已保存模型列表（用于选择 provider/modelName 的真实可用值）

#### 第三阶段（可选，RAG）
- 当节点和参数文档规模扩大时，引入向量检索，用于按场景检索最佳实践/模板/排错手册

### 4.3 知识库数据结构（建议）

建议在前端维护一份结构化常量，用于：

- 生成 API 请求时注入上下文
- 前端做二次校验/补全时使用

#### 示例（建议形态）
```json
{
  "nodeTypes": [
    {
      "type": "crawler",
      "label": "爬虫",
      "defaults": { "method": "GET", "extractMode": "smart", "extractType": "text" },
      "inputs": ["url", "headers"],
      "outputs": ["data", "html", "text"],
      "tips": ["优先使用 urlVariable 引用 Start 的 data.url1"]
    }
  ],
  "workflowSchema": {
    "version": "1.0.0",
    "requiredTopFields": ["version", "exportedAt", "nodes", "edges"]
  }
}
```

### 4.4 NodeSpec / Capabilities（建议命名）应包含什么

建议将节点知识库明确为一份可版本化的结构化规格（Capabilities），它是瑶光星生成可执行工作流的权威来源：

- `capabilitiesVersion`：版本号（前后端对齐，便于回溯与复现）
- `workflowSchema`：WorkflowExportData 的版本、顶层必填字段、边字段规则（condition 的 sourceHandle、merge 的 targetHandle 等）
- `nodeTypes[]`：每个节点的规格（type、label、defaults、configSchema、io、constraints、examples）
  - `defaults`：默认配置（优先来自 `getDefaultConfig(type)`）
  - `configSchema`：字段白名单、必填字段、枚举、是否允许模板变量（例如 urlVariable、contentVariable、dataVariable）
  - `io`：Inputs/Outputs 变量定义（以 `nodeIODefinitions` 为权威）
  - `constraints`：节点级与组合级约束（例如第一阶段默认避免 loop/transform）
  - `examples`：可运行最小片段 + 正确的变量引用写法

### 4.5 现状提示：以"后端真实执行行为"为准

生成工作流时，除了"前端默认配置"和"后端 NodeIO 定义"，还必须纳入后端执行器的真实行为与边界：

- 变量抽取依赖输出字段命名对齐（输出结构与 NodeIO 不一致会导致变量取不到）
- 部分节点实现可能是简化/占位（除 loop/transform 外，后续也可能新增类似边界）

因此建议在 Capabilities 中加入 `stability` 标记：

- `stable`：默认可用，可作为第一阶段模板的组成
- `experimental`：可生成但需要更严格校验/提示
- `stub`：暂不建议默认生成（除非用户显式要求）

### 4.6 后端逻辑摄入方案：如何让 AI 掌握"真实代码执行逻辑"

为了让瑶光星不仅仅是生成"看起来对"的 JSON，而是生成"逻辑上完全符合后端执行器"的工作流，必须建立从后端代码到 AI 上下文的自动化链路。推荐采用以下三级演进方案：

#### L1（模式驱动）：JSON Schema 强制对齐
- **实现**：后端为每个 `NodeConfig` 定义严格的 JSON Schema。
- **价值**：AI 通过阅读 Schema 掌握字段类型、必填项、枚举值（如 `extractMode` 只能是 `smart` 或 `regex`）。
- **同步方式**：后端启动时生成 `nodes_schema.json`，前端 `alkaidApi` 导入并注入 Prompt。

#### L2（代码反射）：自动提取 Struct Tags 与逻辑描述
- **实现**：利用 Go 反射（Reflection）遍历 `WorkflowExecutor` 中的节点结构体。
- **深度信息**：
  - 提取 `json` tag 确定字段名。
  - 提取自定义 tag（如 `alkaid:"用于配置抓取的 URL"`）作为 AI 的字段描述。
  - 提取 `validate` tag（如 `required,url`）作为生成约束。
- **自动化**：后端已实现 `GET /api/alkaid/capabilities` 与 CapabilitiesService，并可通过配置提取器从节点执行代码中更新配置字段，动态返回的“节点能力说明书”。

#### L3（校验闭环）："生成-验证-反馈"的 Trial-and-Error 循环
- **实现**：AI 生成 JSON 后，不直接交付，而是先由后端 `WorkflowExecutor.Validate()` 进行“干跑”校验。
- **反馈闭环**：
  1. AI 生成工作流。
  2. 后端返回详细错误（如：“node-2 的 url 格式不正确”或“node-4 引用了 node-1 不存在的输出变量”）。
  3. AI 根据错误信息进行自我修正（Self-Correction），直到校验通过。
- **价值**：即使后端逻辑发生变更（如新增了一个必填参数），AI 也能通过校验失败的反馈即时“学会”新逻辑，无需手动更新 Prompt。

通过上述方案，可以确保 AI 的生成能力与后端执行逻辑保持**强一致性**，真正实现“生成即运行”。

## 5. 瑶光星生成器（从需求到工作流）的策略

### 5.1 生成目标（必须满足）

- 输出必须是单个 JSON（WorkflowExportData 格式），可直接导入
- 节点数量控制：默认 6~10 个节点以内，避免复杂度过高与成本过大
- 默认可运行：不依赖 loop/transform 等未完善能力

### 5.2 默认模板（最小可运行）

适用于多数新手需求：

- `start`：输入 topic + url（或多个 url）
- `crawler`：抓取 URL（`urlVariable`）
- `dataclean`：清洗 crawler 的 `text`（`dataVariable`）
- `ai`：处理 dataclean 的 `cleaned`（`contentVariable`）
- `output`：输出 json/markdown（destination=file）
- `end`：结束

### 5.3 参数填充规则（可执行）

#### start 节点
- 默认：`inputDataType="json"`
- `inputData` 建议为对象字符串：
  - `topic`（可选）
  - `url`/`url1`/`url2`/...（按模板需要）

#### crawler 节点
- 优先使用 `urlVariable`：例如 `{{node-1.data.url}}` 或 `{{node-1.data.url1}}`
- `extractMode="smart"`，`extractType="text"`

#### dataclean 节点
- `dataVariable="{{node-x.text}}"`（x 为 crawler 节点 id）
- `cleanType="text"`，`trim=true`

#### ai 节点
- 必填：`prompt`
- `contentVariable="{{node-y.cleaned}}"`（y 为 dataclean 节点 id）
- 默认模型：`provider="deepseek"`，`modelName="deepseek-chat"`
- 默认参数：`temperature=0.2~0.3`，`maxTokens=1600~2400`

#### output 节点
- `format="json"` 或 `"markdown"`
- `destination="file"`

### 5.4 生成后校验与补全（强烈建议）

前端在应用到画布前执行以下步骤：

1. `JSON.parse` 解析
2. `validateWorkflowFile(data)`（结构校验）
3. 自动补全（Repair）：
   - node.position 缺失：补 `{x:0,y:0}` 或网格布局
   - node.data.label 缺失：按 type 填充默认名称
   - node.data.config 缺失：使用 `getDefaultConfig(type)`
   - edge.id 缺失：使用 `${source}-${target}`
4. 再次校验 → 导入

### 5.5 生成闭环（后端 AI 编排流水线：规划 → 产出 → 校验修复 → 可选试运行）

瑶光星内部也需要一条"生成工作流的工作流"（AI 编排流水线），它不同于应用里的可视化工作流：

- 规划（Planner）：把用户需求归一化为结构化意图，并选择合适的模板骨架
- 产出（Generator）：在 Capabilities 约束下，输出单个 WorkflowExportData JSON（只输出 JSON）
- 校验（Validator，确定性）：结构/必填字段/枚举/变量引用/图合法性（无环、节点数上限等）
- 修复（Repairer）：将机器可读的错误列表喂给模型，产出修复后的 JSON（可循环 1~3 次）
- 证明运行（Prover，可选但强烈建议）：调用后端执行器做一次试运行，失败则带上失败节点信息再次修复

这样才能做到生成即能导入，尽量一次跑通，并在失败时给出可定位的修复路径。

### 5.6 运行时纠错（执行失败时的瑶光星"小精灵"）

瑶光星不仅用于生成阶段，也可以用于运行阶段的诊断与纠错，让用户在执行失败时更容易跑通工作流：

#### 触发条件
用户点击运行后，任意节点执行失败。

#### 表现形式
- 前端自动定位并高亮失败节点（以及可选的上游输入路径）
- 在失败节点旁弹出瑶光星小精灵：解释失败原因、给出可执行的修复建议
- 支持一键应用修复（建议先做需要用户确认的 patch，避免静默改动）

#### 推荐分级实现（从稳到强）

**L1（必做）：诊断 + 建议**
- 把失败节点、错误码、错误信息、关键上下文展示给用户
- 输出 2~3 条可操作的建议（例如：变量引用不存在、必填字段缺失、参数格式错误）

**L2（一键修复）：AI 产出配置补丁（patch），用户确认后应用到画布**
- AI 输出补丁而不是整份新 workflow，冲突更少、可解释性更强
- 前端展示 diff（改了哪些字段、为什么改、潜在副作用），用户确认才写回

**L3（自愈闭环，可选）：应用 patch 后自动重试运行（最多 N 次）**
- 若仍失败，带上最新失败信息继续修复；最终输出"已修复并跑通"或"无法自动修复需用户补充信息"

### 5.7 Agentic 流与工具链（当前实现）

当前默认使用的 **Agentic 流** 由后端固定管道 + 可选 LLM 工具调用组成，前端通过 SSE 接收阶段、工具步、流式内容与待确认工作流/补丁。

#### 流式接口

- **请求**：`POST /api/alkaid/sessions/:id/stream`，Body：`{ message, interrupt?, context? }`。`context` 可含 `currentWorkflow` 供后端做 diff 生成补丁。
- **SSE 事件**：
  - `content`：流式文本片段（`delta`）
  - `phase_changed`：当前阶段（如 planning、generating、validating、idle）
  - `tool_step_started`：工具开始（stepId、toolName、phase）
  - `tool_step_finished`：工具结束（stepId、status、resultSummary、errorMessage）
  - `pending_workflow`：待确认工作流摘要（如 nodeCount、edgeCount）
  - `pending_patch`：待确认补丁（如 patchCount）
  - `done`：正常结束
  - `interrupted`：请求被取消（如用户打断）
  - `error`：错误信息

#### 后端工具（Agentic 内部）

| 工具名 | 说明 |
|--------|------|
| `get_capabilities` | 获取节点类型、工作流格式、规则等能力说明（CapabilitiesService） |
| `get_workflow` | 按会话关联的 workflowId 读取当前画布节点与边 |
| `get_node_spec` | 按节点类型返回规格（NodeSpec） |
| `validate_workflow` | 结构校验（version、nodes、edges、节点 id/type、边 source/target） |
| `run_workflow_trial` | 试运行工作流（WorkflowExecutor.Execute） |
| `propose_workflow` | 将生成的工作流写入会话的 PendingWorkflowJSON，不直接写画布 |
| `propose_patch` | 将 diff 得到的补丁写入会话的 PendingPatchJSON |
| `search_knowledge` | 从知识库检索最佳实践、示例、节点使用技巧等 |

#### 应用到画布与补丁

- **应用到画布**：`POST /api/alkaid/apply-workflow`，Body `{ sessionId, workflowId? }`。将会话中的 pendingWorkflow 转为节点/边并调用 `SaveWorkflowNodes` 写入画布，并清空 pending。支持 BeforeApplyWorkflow Hook（环境变量配置 URL，可拒绝并返回 reason）。
- **应用补丁**：`POST /api/alkaid/apply-patch`，Body `{ sessionId, workflowId? }`。将会话中的 pendingPatch 按 op（add/remove/set/set_edges）应用到当前画布并保存，再清空 pending。
- **打断**：发送新消息时前端可先取消当前流；后端在 request context 取消时发送 `interrupted` 并退出。

更细的 Agentic 接入说明见 `docs/05-ALKaid-Agentic-Integration.md`，实现总结见 `docs/04-ALKaid-Implementation-Summary.md`、`docs/06-ALKaid-Implementation-Round2-Summary.md`。

## 6. Prompt 与输出规范（让 AI 稳定"只输出 JSON"）

### 6.1 System 指令（规范）

必须约束：

- 只能输出单个 JSON（WorkflowExportData 格式），不允许解释、Markdown 或多段文本
- nodes/edges 必须满足最低必需字段
- 默认输出可运行最小模板
- 避免输出 loop/transform 复杂逻辑
- 变量引用必须使用 `{{nodeId.variable}}`，并与 I/O 定义一致

### 6.2 User 输入结构（建议）

建议在 UI 侧引导用户补齐四类信息：

- 目标：想做什么
- 输入：URL/文本/JSON
- 输出：json/markdown/文件/展示
- 限制：节点数量、是否多来源、是否需要条件分支

## 7. 前端集成（实现说明）

### 7.1 组件与目录结构

当前前端实现目录结构如下（API 与类型在 `src` 下统一管理）：

```
src/components/Alkaid/
  README.md
  AlkaidAssistant.tsx           # 主对话界面（Drawer 内）
  AlkaidAssistant.module.scss
  AlkaidButton.tsx              # 入口按钮，打开瑶光星 Drawer
  ProcessLoader.tsx              # 旧流进度展示（understanding → generating 等）
  ProcessLoader.module.scss
  utils.ts                      # 工作流 JSON 提取、校验、剥离展示（extractWorkflowJSON、parseWorkflowJSON、stripWorkflowJSONFromText 等）
  index.ts                      # 导出 AlkaidAssistant、utils、types、AlkaidProgress、AlkaidPendingWorkflow、AlkaidPendingPatch
  types/
    index.ts
    progress.ts                 # Phase、AgentToolStep、进度与 SSE 相关类型
  components/
    AlkaidProgress.tsx          # Agentic 流：阶段文案 + 最近 N 条工具步（可折叠）
    AlkaidProgress.module.scss
    AlkaidPendingWorkflow.tsx   # 待确认工作流摘要 +「应用到画布」「放弃」
    AlkaidPendingPatch.tsx      # 待确认补丁数量 +「应用补丁」「放弃」
    AlkaidPending.module.scss
    index.ts
  docs/                         # 与后端 modules/alkaid/docs 同步的详细文档
```

- **API**：`src/api/alkaid.ts`（会话 CRUD、消息、旧流 `sendMessageStream`、Agentic 流 `sessionStreamAgentic`、`applyWorkflow`、`applyPatch`）。
- **类型**：`src/types/alkaid.ts`（Session、Message、Phase、AgentToolStep、GetMessagesResponse 等）。

### 7.2 与 WorkflowEditor 的集成点

- **入口**：工作流面板通过 `AlkaidButton` 打开瑶光星，Drawer 内渲染 `AlkaidAssistant`。
- **Agentic 流**（默认 `useAgentic=true`）：
  1. 发消息 → `alkaidApi.sessionStreamAgentic(sessionId, message, callbacks)`，解析 SSE 更新 phase、toolSteps、流式内容、pendingWorkflow/pendingPatch。
  2. 加载中展示 `AlkaidProgress`（阶段 + 工具步）；有待确认时展示 `AlkaidPendingWorkflow` / `AlkaidPendingPatch`。
  3. 用户点击「应用到画布」→ `alkaidApi.applyWorkflow(sessionId, workflowId)`，成功后通过 `onWorkflowApplied` 回调（如 `loadWorkflowNodes`）刷新画布。
- **旧流**（`useAgentic=false`）：`sendMessageStream`，进度用 `ProcessLoader`，从助手消息中解析工作流 JSON 后通过 `onWorkflowGenerated` 导入画布。
- **打断**：发送新消息时若正在加载，会先取消当前流再发送。

### 7.3 直接复用的工具函数

- 导入/导出/校验：`src/utils/workflowImportExport.ts`（如 `validateWorkflowFile`）
- 默认配置：`src/utils/nodeUtils.ts`（如 `getDefaultConfig`）
- 组件内使用 `utils.ts` 的 `extractWorkflowJSON`、`parseWorkflowJSON`、`hasWorkflowJSONBlock`、`stripWorkflowJSONFromText` 做展示与解析。

### 7.4 最小「应用到画布」流程（旧流从消息解析时）

```typescript
const data = JSON.parse(modelOutputText)
if (!validateWorkflowFile(data)) throw new Error("invalid workflow")
const repaired = repairWorkflow(data)  // 可选：position/label/config/edge.id 补全
await importWorkflow(repaired)
```

Agentic 流下「应用到画布」由后端 `apply-workflow` 接口直接将会话中的 pendingWorkflow 写入画布，前端仅需调用 `applyWorkflow(sessionId, workflowId)` 并在成功后刷新画布。

## 8. 后端接口

### 8.0 已实现接口总览

以下为当前已实现的 HTTP 接口（均在需认证的 `/api` 下，如 `auth.GET` / `auth.POST`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/alkaid/capabilities | 获取能力说明（节点类型、工作流格式、规则等），供前端与 Agentic 工具使用 |
| POST | /api/alkaid/sessions | 创建会话，Body：`{ title?, workflowId? }` |
| GET | /api/alkaid/sessions | 获取当前用户会话列表，Query：page、pageSize |
| GET | /api/alkaid/sessions/:id | 获取会话详情 |
| PUT | /api/alkaid/sessions/:id/title | 更新会话标题，Body：`{ title }` |
| DELETE | /api/alkaid/sessions/:id | 删除会话 |
| POST | /api/alkaid/messages | 发送消息（非流式），Body：`{ sessionId, content }` |
| POST | /api/alkaid/messages/stream | 旧流式接口，Body：`{ sessionId, content }`，SSE：event: message |
| POST | /api/alkaid/sessions/:id/stream | **Agentic 流式接口**，Body：`{ message, interrupt?, context? }`，SSE 见 5.7 节 |
| GET | /api/alkaid/sessions/:id/messages | 获取会话消息列表（含历史 toolSteps），Query：limit? |
| POST | /api/alkaid/apply-workflow | 将会话 pendingWorkflow 写入画布，Body：`{ sessionId, workflowId? }` |
| POST | /api/alkaid/apply-patch | 将会话 pendingPatch 应用到画布并清空，Body：`{ sessionId, workflowId? }` |

### 8.1 获取能力与节点规格（已实现）

`GET /api/alkaid/capabilities`

- **用途**：前端展示支持哪些节点/字段/变量，Agentic 工具链中的 `get_capabilities` 也使用同一能力数据。
- **实现**：`CapabilitiesService.GetCapabilities()`，并可由配置提取器从节点执行代码中更新配置字段。
- **返回**：包含 `version`、`workflowSchema`、`nodeTypes[]`（含 type、label、description、stability、inputs、outputs、config、configRules、examples）、`template`、`rules` 等。结构定义见后端 `WorkflowCapabilities`、`NodeCapability`。

### 8.2 会话与消息（已实现）

会话 CRUD、发送消息、获取消息列表均已实现；创建会话时可关联 `workflowId`，便于 Agentic 流中 `get_workflow`、`apply-workflow`、`apply-patch` 操作当前画布。

### 8.3 Agentic 流式接口（已实现）

`POST /api/alkaid/sessions/:id/stream`

- **请求体**：`{ message, interrupt?, context? }`。`context` 可传 `currentWorkflow` 供后端生成补丁时做 diff。
- **SSE 事件**：见第 5.7 节（content、phase_changed、tool_step_started/finished、pending_workflow、pending_patch、done、interrupted、error）。
- **实现**：`modules/alkaid/services/agentic/loop.go` 的 `RunStream`，内含 BeforeGenerate Hook、工具调用、LLM 生成、校验、propose_workflow/propose_patch、SSE 写入。

### 8.4 应用到画布与应用补丁（已实现）

- **apply-workflow**：从会话读取 PendingWorkflowJSON，校验归属与 BeforeApplyWorkflow Hook，转为 `SaveWorkflowNodesRequest` 调用 `SaveWorkflowNodes`，再清空 pending。Hook 通过环境变量 `ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL` 配置。
- **apply-patch**：从会话读取 PendingPatchJSON，按 patch 列表（add/remove/set/set_edges）应用到当前画布并保存，再清空 pending。

### 8.5 可选扩展接口（未实现，供后续）

以下为文档中的建议接口，当前生成/校验/修复/补丁建议均在 Agentic 流内通过工具完成；若需独立 HTTP 入口可后续增加：

- `POST /api/alkaid/generate-workflow`：单轮根据 prompt 生成工作流 JSON。
- `POST /api/alkaid/repair-workflow`：根据 workflow + 错误信息返回修复后 workflow。
- `POST /api/alkaid/validate-workflow`：仅校验 workflow，返回 errors[]。
- `POST /api/alkaid/suggest-patch`：根据 workflow + ExecutionError 返回 patch[]。

运行失败诊断与补丁修复的**产品形态**（失败节点旁小精灵、一键应用补丁等）见第 5.6 节；后端已具备 `validate_workflow`、`run_workflow_trial`、`propose_patch` 等工具，可在此基础上扩展独立接口或更多 Hook。

## 9. 安全与合规（必须）

### 9.1 爬虫安全

- 默认限制：单次生成 crawler 节点数量（例如 ≤3）
- 提示用户遵守版权与 robots 协议，避免高频抓取
- 对 headers/cookies 的生成保持建议/引导，避免自动写入敏感值

### 9.2 Prompt 注入与敏感信息

- 不将用户的 token/cookie 明文拼进 prompt
- 生成的 JSON 中不包含密钥
- 若用户粘贴敏感信息，UI 提示风险并建议使用安全存储

## 10. 国际化（i18n）接入规范

参考项目国际化说明：`src/i18n/README.md`。

### 瑶光星使用的前缀与键

- **workflowEditor.alkaid.***：工作流编辑器中瑶光星相关文案（标题、打开、生成、应用、校验失败、待确认工作流/补丁、阶段与工具步状态、Hook 拒绝等）已在中英文中维护。
- **alkaid.***：瑶光星独立页或通用文案（如创建会话失败等）。

### 维护文件
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/en-US.json`

新增键时建议继续使用 `workflowEditor.alkaid.*` 或 `alkaid.*` 前缀，并在中英文两处同步添加。

## 11. 验收标准（可执行）

1. 任意输入需求，瑶光星输出的 JSON 通过 `validateWorkflowFile`
2. 一键导入后画布成功渲染节点与连线
3. 使用一个可访问 URL，可完整执行并在 output 节点产出数据
4. 用户仅修改 Start 的 `inputData` 即可复用同一模板重复运行
5. 校验失败或执行失败时，UI 能定位到原因并给出下一步建议（至少标明失败节点）

### 相关文档（本目录 docs/ 与后端 modules/alkaid/docs/）

- **00-README-Alkaid.md**：与本 README 同源的产品与协议说明
- **01-ALKaid-Architecture.md**：增强架构、目录隔离、前后端职责
- **04-ALKaid-Implementation-Summary.md**：当前实现总结（阶段一～三、路由、数据流）
- **05-ALKaid-Agentic-Integration.md**：Agentic 流前端接入（useAgentic、onWorkflowApplied、Progress/Pending 组件）
- **06-ALKaid-Implementation-Round2-Summary.md**：第二轮实现（打断、pendingPatch、Hooks、国际化、apply-patch 真实应用）
- **ALKaid-Unimplemented-Checklist.md**：未实现功能清单

## 12. 附录：可运行最小示例（WorkflowExportData）

```json
{
  "version": "1.0.0",
  "name": "瑶光星示例-抓取并总结",
  "description": "start→crawler→dataclean→ai→output→end",
  "exportedAt": "2026-01-18T00:00:00.000Z",
  "nodes": [
    {
      "id": "node-1",
      "type": "start",
      "position": { "x": 0, "y": 0 },
      "data": {
        "label": "开始",
        "type": "start",
        "connectionDirection": "vertical",
        "config": {
          "trigger": "manual",
          "inputDataType": "json",
          "inputData": "{\\n  \\\"url\\\": \\\"https://httpbin.org/html\\\"\\n}"
        }
      }
    },
    {
      "id": "node-2",
      "type": "crawler",
      "position": { "x": 0, "y": 140 },
      "data": {
        "label": "爬虫",
        "type": "crawler",
        "connectionDirection": "vertical",
        "config": {
          "urlVariable": "{{node-1.data.url}}",
          "method": "GET",
          "extractMode": "smart",
          "extractType": "text"
        }
      }
    },
    {
      "id": "node-3",
      "type": "dataclean",
      "position": { "x": 0, "y": 280 },
      "data": {
        "label": "清洗",
        "type": "dataclean",
        "connectionDirection": "vertical",
        "config": {
          "dataVariable": "{{node-2.text}}",
          "cleanType": "text",
          "trim": true
        }
      }
    },
    {
      "id": "node-4",
      "type": "ai",
      "position": { "x": 0, "y": 420 },
      "data": {
        "label": "AI总结",
        "type": "ai",
        "connectionDirection": "vertical",
        "config": {
          "modelMode": "system",
          "provider": "deepseek",
          "modelName": "deepseek-chat",
          "temperature": 0.2,
          "maxTokens": 1200,
          "contentVariable": "{{node-3.cleaned}}",
          "prompt": "请将输入网页内容总结为5条要点，用中文输出。"
        }
      }
    },
    {
      "id": "node-5",
      "type": "output",
      "position": { "x": 0, "y": 560 },
      "data": {
        "label": "输出",
        "type": "output",
        "connectionDirection": "vertical",
        "config": { "format": "markdown", "destination": "file" }
      }
    },
    {
      "id": "node-6",
      "type": "end",
      "position": { "x": 0, "y": 700 },
      "data": {
        "label": "结束",
        "type": "end",
        "connectionDirection": "vertical",
        "config": { "action": "none" }
      }
    }
  ],
  "edges": [
    { "id": "e-1-2", "source": "node-1", "target": "node-2" },
    { "id": "e-2-3", "source": "node-2", "target": "node-3" },
    { "id": "e-3-4", "source": "node-3", "target": "node-4" },
    { "id": "e-4-5", "source": "node-4", "target": "node-5" },
    { "id": "e-5-6", "source": "node-5", "target": "node-6" }
  ]
}
```
