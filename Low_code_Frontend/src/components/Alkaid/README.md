# 瑶光工坊 · 瑶光星 AI 助手（Alkaid）

## 1. 概述

瑶光星（Alkaid）是瑶光工坊工作流编辑器内置的 AI 对话式助手，用于将用户的自然语言目标自动转换为“可导入、可执行”的工作流。

核心输出物：
- 工作流 JSON（符合 `WorkflowExportData`），用户可直接导入并运行
- 可选的节点说明与注释卡片（commentCards），用于指导用户修改关键输入

核心目标：
- 降低新手搭建工作流门槛（不会“选节点/连线/变量传递”也能跑通）
- 提升首次跑通率与复用效率（模板化、可保存、可二次修改）

## 2. 适用范围与边界

### 2.1 适用范围
- 面向“目标清晰但不会搭建”的用户：抓取网页、清洗文本、AI 摘要/结构化提取、输出文件
- 面向“想快速生成模板再微调”的用户

### 2.2 当前边界（重要）
当前后端执行器对部分节点的实现为简化/占位，瑶光星第一阶段应避免生成依赖这些未完善能力的复杂图：
- `loop`：后端当前仅把输入数组透传为 `results`，不会真正“逐项驱动下游执行”
- `transform`：后端目前不执行 `script`（占位）

推荐第一阶段默认输出“可运行最小模板”：
`start → crawler → dataclean → ai → output → end`

## 3. 术语与数据协议

### 3.1 工作流导入/导出 JSON（WorkflowExportData）
导入/导出格式在前端已固定，瑶光星必须严格输出该结构：
- 入口：`src/utils/workflowImportExport.ts`
- 变换：`src/utils/workflowTransformers.ts`

顶层字段（必须）：
- `version: "1.0.0"`
- `exportedAt: ISO8601 string`
- `nodes: NodeData[]`
- `edges: EdgeData[]`

可选字段：
- `name?: string`
- `description?: string`
- `commentCards?: CommentCardData[]`

### 3.2 NodeData 最低要求
- 必须：`id`, `type`
- 建议：`position`, `data`
  - `data.label`
  - `data.type`（与 `type` 一致）
  - `data.connectionDirection`（建议 `"vertical"`）
  - `data.config`（见节点默认配置）

节点默认配置（用于补全与兜底）：
- `src/utils/nodeUtils.ts:getDefaultConfig`

### 3.3 EdgeData 最低要求
- 必须：`source`, `target`
- 建议：`id`
- 条件分支（可选）：`sourceHandle: "true" | "false"`
- 合并多输入（可选）：`targetHandle: "input-0" | "input-1" ...`

### 3.4 变量模板语法（后端模板解析）
执行器支持在多个节点配置字段中使用模板变量：
- 语法：`{{nodeId.variableName}}` 或 `{{nodeId.variableName.field}}`
- 入口：`Low_code_Backend/modules/workflow/services/variable_context.go`

常用输出变量（以 `nodeIODefinitions` 为准）：
- start：`data`
- crawler：`text`, `html`, `data`
- dataclean：`cleaned`
- ai：`result`

## 4. 节点知识库（瑶光星如何“懂节点”）

### 4.1 是否需要知识库
需要。瑶光星要稳定生成可执行 JSON，必须掌握：
- 支持的节点类型清单
- 每个节点的关键配置字段
- 节点 I/O 输出变量名（用于 contentVariable/dataVariable/urlVariable 等引用）
- 已知边界与推荐组合（例如避免 loop/transform 复杂逻辑）

### 4.1.1 重要共识：仅靠 RAG 不足以稳定生成“可执行 JSON”
即使未来所有节点都开发完整，也不建议“只靠向量检索（RAG）”来驱动工作流生成。原因：
- RAG 只能提供参考上下文，无法强制模型严格遵守 JSON 结构、字段枚举、必填项与变量引用规则
- 一次性生成容易出现：多输出解释文字、漏字段、字段拼写错误、枚举值不合法、变量引用不存在/来自错误上游

推荐分工：
- 结构化节点规格（NodeSpec / Capabilities）：负责“硬约束”（能配什么、必须配什么、变量名是什么）
- RAG：负责“软知识”（最佳实践、模板、排错手册、场景范式），用于提升生成质量与泛化能力

### 4.2 分层知识来源（推荐实现）
第一阶段（必做，静态内置）：
- 节点类型与默认配置：`src/utils/nodeUtils.ts`
- 节点 I/O 定义：`Low_code_Backend/modules/workflow/services/variable_context.go` 的 `nodeIODefinitions`
- 执行逻辑约束：`workflow_executor.go` 各 `executeXxxNode`

第二阶段（增强，动态注入）：
- 系统预设模型列表、Provider 模板、用户已保存模型列表（用于选择 provider/modelName 的真实可用值）

第三阶段（可选，RAG）：
- 当节点和参数文档规模扩大时，再引入向量检索，用于“按场景检索最佳实践/模板/排错手册”

### 4.3 知识库数据结构（建议）
建议在前端维护一份结构化常量，供：
- 生成 API 请求时注入上下文
- 前端做二次校验/补全时使用

示例（建议形态）：
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
建议把“节点知识库”明确为一份可版本化的结构化规格（Capabilities），它是瑶光星生成可执行工作流的“真相来源”：
- `capabilitiesVersion`：版本号（前后端对齐、便于回溯与复现）
- `workflowSchema`：WorkflowExportData 的版本、顶层必填字段、边字段规则（condition 的 sourceHandle、merge 的 targetHandle 等）
- `nodeTypes[]`：每个节点的规格（type/label/defaults/configSchema/io/constraints/examples）
  - `defaults`：默认配置（优先来自 `getDefaultConfig(type)`）
  - `configSchema`：字段白名单、必填字段、枚举、是否允许模板变量（例如 urlVariable/contentVariable/dataVariable）
  - `io`：Inputs/Outputs 变量定义（以 `nodeIODefinitions` 为权威）
  - `constraints`：节点级与组合级约束（例如第一阶段默认避免 loop/transform）
  - `examples`：可运行最小片段 + 正确的变量引用写法

### 4.5 现状提示：以“后端真实执行行为”为准
生成工作流时，除了“前端默认配置”和“后端 NodeIO 定义”，还必须纳入后端执行器的真实行为与边界：
- 变量抽取依赖“输出字段命名对齐”（输出结构与 NodeIO 不一致会导致变量取不到）
- 部分节点实现可能是简化/占位（除 loop/transform 外，后续也可能新增类似边界）

因此建议在 Capabilities 中加入 `stability` 标记：
- `stable`：默认可用、可作为第一阶段模板的组成
- `experimental`：可生成但需要更严格校验/提示
- `stub`：暂不建议默认生成（除非用户显式要求）

## 5. 瑶光星生成器（从需求到工作流）的策略

### 5.1 生成目标（必须满足）
- 输出必须是单个 JSON（WorkflowExportData），可直接导入
- 节点数量控制：默认 6~10 个节点以内，避免复杂与成本过高
- 默认可运行：不依赖 loop/transform 的未完善能力

### 5.2 默认模板（最小可运行）
适用于多数新手需求：
- start：输入 topic + url（或多个 url）
- crawler：抓取 URL（`urlVariable`）
- dataclean：清洗 crawler 的 `text`（`dataVariable`）
- ai：处理 dataclean 的 `cleaned`（`contentVariable`）
- output：输出 json/markdown（destination=file）
- end：结束

### 5.3 参数填充规则（可执行）
start：
- 默认：`inputDataType="json"`
- `inputData` 建议为对象字符串：
  - `topic`（可选）
  - `url`/`url1/url2/...`（按模板需要）

crawler：
- 优先使用 `urlVariable`：例如 `{{node-1.data.url}}` 或 `{{node-1.data.url1}}`
- `extractMode="smart"`，`extractType="text"`

dataclean：
- `dataVariable="{{node-x.text}}"`（x 为 crawler 节点 id）
- `cleanType="text"`，`trim=true`

ai：
- 必填：`prompt`
- `contentVariable="{{node-y.cleaned}}"`（y 为 dataclean 节点 id）
- 默认模型：`provider="deepseek"`, `modelName="deepseek-chat"`
- 默认参数：`temperature=0.2~0.3`, `maxTokens=1600~2400`

output：
- `format="json" | "markdown"`
- `destination="file"`

### 5.4 生成后校验与补全（强烈建议）
前端在“应用到画布”前执行以下步骤：
1. `JSON.parse` 解析
2. `validateWorkflowFile(data)`（结构校验）
3. 自动补全（Repair）：
   - node.position 缺失：补 `{x:0,y:0}` 或网格布局
   - node.data.label 缺失：按 type 填充默认名称
   - node.data.config 缺失：使用 `getDefaultConfig(type)`
   - edge.id 缺失：使用 `${source}-${target}`
4. 再次校验 → 导入

### 5.5 生成闭环（后端 AI 编排流水线：规划 → 产出 → 校验修复 → 可选试运行）
瑶光星内部也需要一条“生成工作流的工作流”（AI 编排流水线），它不同于应用里的可视化工作流：
- 规划（Planner）：把用户需求归一化为结构化意图，并选择合适的模板骨架
- 产出（Generator）：在 Capabilities 约束下，输出单个 WorkflowExportData JSON（只输出 JSON）
- 校验（Validator，确定性）：结构/必填字段/枚举/变量引用/图合法性（无环、节点数上限等）
- 修复（Repairer）：将机器可读的错误列表喂给模型，产出修复后的 JSON（可循环 1~3 次）
- 证明运行（Prover，可选但强烈建议）：调用后端执行器做一次试运行，失败则带上失败节点信息再次修复

这样才能做到“生成即能导入，尽量一次跑通”，并在失败时给出可定位的修复路径。

## 6. Prompt 与输出规范（让 AI 稳定“只输出 JSON”）

### 6.1 System 指令（规范）
必须约束：
- 只能输出单个 JSON（WorkflowExportData），不允许解释、Markdown 或多段文本
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

## 7. 前端集成（建议落点与接口）

### 7.1 组件落点
建议目录结构：
```
src/components/Alkaid/
  README.md
  AlkaidPanel.tsx
  AlkaidPanel.module.scss
  alkaidKnowledge.ts
  alkaidTypes.ts
  alkaidWorkflowRepair.ts
  alkaidApi.ts
  index.ts
```

### 7.2 与 WorkflowEditor 的集成点
建议作为工作流面板的一个入口（按钮/图标），打开 Drawer 或 Modal：
- 入口 UI：`AlkaidPanel`
- 关键流程：
  1) 发送对话请求（生成 workflow JSON）
  2) 校验/补全
  3) 调用 `importWorkflow` 应用到画布

### 7.3 直接复用的工具函数
- 导入/导出/校验：`src/utils/workflowImportExport.ts`
- 默认配置：`src/utils/nodeUtils.ts`

### 7.4 最小“应用到画布”伪代码（仅说明流程）
```ts
const data = JSON.parse(modelOutputText)
if (!validateWorkflowFile(data)) throw new Error("invalid workflow")
const repaired = repairWorkflow(data)
await importWorkflow(repaired)
```

## 8. 后端接口（建议）

### 8.0 获取能力与节点规格（建议新增，强烈推荐）
`GET /api/alkaid/capabilities`
- 用途：前端展示“支持哪些节点/字段/变量”，同时为生成请求提供权威上下文（Capabilities）
- 返回建议包含：
  - `capabilitiesVersion`
  - `workflowSchema`
  - `nodeTypes[]`（含 defaults/configSchema/io/constraints/examples）
  - （第二阶段）系统可用的 provider/model 列表与能力开关（例如是否支持 stream/thinking）

### 8.1 生成工作流
`POST /api/alkaid/generate-workflow`

请求体建议：
```json
{
  "prompt": "用户自然语言需求",
  "language": "zh-CN",
  "context": {
    "nodeTypes": ["start","crawler","dataclean","ai","condition","merge","output","end"],
    "nodeDefaults": {},
    "nodeIO": {}
  },
  "constraints": {
    "maxNodes": 12,
    "preferProviders": ["deepseek", "qwen"]
  }
}
```

响应体建议：
- 直接返回 `WorkflowExportData`（推荐），或返回 `{ workflow, explanation, warnings }`

### 8.2 修复工作流（可选）
`POST /api/alkaid/repair-workflow`
- 输入：workflow + 校验/执行错误信息
- 输出：修复后的 workflow

### 8.3 校验工作流（建议新增，便于前后端一致）
`POST /api/alkaid/validate-workflow`
- 输入：workflow
- 输出：机器可读的错误列表（errors[]），用于：
  - 前端提示用户
  - 后端 repair 流水线驱动模型做定向修复

（可选）如果你已有前端 `validateWorkflowFile`，后端校验仍建议保留一份“以 Capabilities 为准”的实现，避免前后端规则漂移。

## 9. 安全与合规（必须）

### 9.1 爬虫安全
- 默认限制：单次生成 crawler 节点数量（例如 ≤3）
- 提示用户遵守版权与 robots，避免高频抓取
- 对 headers/cookies 的生成保持“建议/引导”，避免自动写入敏感值

### 9.2 Prompt 注入与敏感信息
- 不将用户的 token/cookie 明文拼进 prompt
- 生成的 JSON 中不包含密钥
- 若用户粘贴敏感信息，UI 提示风险并建议使用安全存储

## 10. 国际化（i18n）接入规范

参考项目国际化说明：`src/i18n/README.md`。

瑶光星建议使用前缀命名：
- `workflowEditor.alkaid.title`
- `workflowEditor.alkaid.open`
- `workflowEditor.alkaid.generate`
- `workflowEditor.alkaid.apply`
- `workflowEditor.alkaid.validationFailed`

同时维护：
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/en-US.json`

## 11. 验收标准（可执行）

1. 任意输入需求，瑶光星输出的 JSON 通过 `validateWorkflowFile`
2. 一键导入后画布成功渲染节点与连线
3. 使用一个可访问 URL，可完整执行并在 output 节点产出数据
4. 用户仅修改 Start 的 `inputData` 即可复用同模板重复运行
5. 校验失败或执行失败时，UI 能定位到原因并给出下一步建议（至少标明失败节点）

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
