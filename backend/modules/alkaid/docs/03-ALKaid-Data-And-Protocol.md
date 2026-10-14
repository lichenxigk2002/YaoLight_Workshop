# ALKaid 瑶光星助手数据与协议文档

> 当前有效版本。
>
> 本文件沉淀当前 V1 主线的 SSE、task mode、artifact、report、apply/discard 协议约定。

---

## 1. Task Mode

当前对外任务模式为：

| mode | 含义 | 是否改画布 | 是否试跑 | 主产物 |
|------|------|------------|----------|--------|
| `chat` | 普通问答 | 否 | 否 | 文本 |
| `explain` | 解释当前工作流 | 否 | 否 | `ExplainReport` |
| `generate` | 生成新工作流 | 是 | 是 | `WorkflowDraft` / `pendingWorkflow` |
| `repair` | 修复当前工作流 | 是 | 是 | `PatchDraft` 或 `WorkflowDraft` |
| `trial_debug` | 试跑并定位失败 | 否 | 是 | `TrialReport` |

兼容说明：

- 旧内部模式 `analyze` 只作为 `explain` 的兼容执行器存在。
- 旧内部模式 `act` 只作为 `generate/repair` 的兼容执行器存在。
- 前端不应再把 `analyze/act` 当成新版对外模式。

---

## 2. SSE 事件

Agentic 流式接口：

```http
POST /api/alkaid/sessions/:id/stream
```

请求体：

```json
{
  "message": "帮我试跑当前工作流看看哪里报错",
  "interrupt": false,
  "context": {
    "currentWorkflow": {},
    "projectId": 1,
    "workflowId": 2
  }
}
```

### 2.1 `interaction_mode`

```json
{
  "mode": "trial_debug",
  "reason": "explicit_trial_debug",
  "showProgress": true,
  "at": "2026-04-26T00:00:00Z"
}
```

### 2.2 `phase_changed`

```json
{
  "phase": "validating",
  "at": "2026-04-26T00:00:00Z"
}
```

阶段枚举：

- `idle`
- `planning`
- `generating`
- `validating`
- `repairing`
- `running_trial`
- `summarizing`
- `waiting_approval`
- `error`

### 2.3 `content`

```json
{
  "delta": "调试完成：发现当前工作流存在需要处理的问题。"
}
```

### 2.4 `tool_step_started`

```json
{
  "stepId": "step-123-get_workflow",
  "planStepId": "plan-1",
  "userMessageId": 10,
  "userMessageContent": "试跑一下",
  "toolName": "get_workflow",
  "phase": "validating",
  "at": "2026-04-26T00:00:00Z"
}
```

### 2.5 `tool_step_finished`

```json
{
  "stepId": "step-123-get_workflow",
  "status": "success",
  "resultSummary": "已获取当前工作流：4 个节点，3 条连线",
  "errorMessage": "",
  "at": "2026-04-26T00:00:00Z"
}
```

### 2.6 `pending_workflow`

```json
{
  "summary": {
    "nodeCount": 4,
    "edgeCount": 3
  }
}
```

### 2.7 `pending_patch`

```json
{
  "patchCount": 3,
  "summary": {
    "addedNodeIds": ["node-1"],
    "removedNodeIds": [],
    "updatedNodeIds": ["node-2"],
    "edgesChanged": true
  }
}
```

当前后端 `pending_patch` 至少保证 `patchCount`，`summary` 可选。

### 2.8 `explain_report`

```json
{
  "summary": "当前工作流用于抓取并总结网页。",
  "nodeCount": 4,
  "edgeCount": 3,
  "risks": ["检测到 2 个根节点，流程入口可能不够明确"],
  "suggestions": ["检测到 2 个叶子节点，可检查是否都能输出或结束"],
  "variableFlow": ["节点类型分布: start: 1, crawler: 1, ai: 1, output: 1"]
}
```

### 2.9 `debug_report`

```json
{
  "success": false,
  "failedNodeId": "ai-1",
  "failedNodeLabel": "AI 总结",
  "observations": ["模型未配置"],
  "summary": "调试完成，发现需要处理的问题。"
}
```

### 2.10 结束事件

成功结束：

```json
{}
```

事件名：`done`

错误：

```json
{
  "message": "工作流校验失败"
}
```

事件名：`error`

中断：

```json
{
  "at": "2026-04-26T00:00:00Z"
}
```

事件名：`interrupted`

---

## 3. Artifact 结构

### 3.1 `WorkflowDraft`

```json
{
  "workflowJson": "{\"version\":\"1.0.0\",\"nodes\":[],\"edges\":[]}",
  "summary": "已生成工作流草稿",
  "source": "generate",
  "confidence": 0.7,
  "validationPass": true,
  "trialPass": true
}
```

### 3.2 `PatchDraft`

```json
{
  "patchJson": "[{\"op\":\"set\",\"nodeId\":\"ai-1\",\"path\":\"data.config.prompt\",\"value\":\"...\"}]",
  "summary": "已根据当前画布生成可应用补丁",
  "targetWorkflow": 1,
  "confidence": 0.7,
  "validationPass": true,
  "trialPass": true
}
```

### 3.3 `ValidationReport`

```json
{
  "valid": false,
  "errors": ["nodes[0].id: 节点缺少 id"],
  "warnings": ["未检测到 output/end 节点"],
  "summary": "发现 1 处错误"
}
```

### 3.4 `TrialReport`

```json
{
  "success": false,
  "failedNodeId": "ai-1",
  "failedNodeLabel": "AI 总结",
  "observations": ["模型未配置"],
  "summary": "试跑失败，失败节点: ai-1"
}
```

### 3.5 `ExplainReport`

```json
{
  "summary": "当前工作流用于抓取并总结网页。",
  "nodeCount": 4,
  "edgeCount": 3,
  "risks": [],
  "suggestions": [],
  "variableFlow": []
}
```

---

## 4. Apply / Discard

### 4.1 Apply Workflow

```http
POST /api/alkaid/apply-workflow
```

```json
{
  "sessionId": 1,
  "workflowId": 2
}
```

行为：

- 读取 `alkaid_sessions.pending_workflow_json`
- 覆盖目标 workflow 的 nodes / edges / commentCards
- 成功后清空 `pending_workflow_json`

### 4.2 Apply Patch

```http
POST /api/alkaid/apply-patch
```

```json
{
  "sessionId": 1,
  "workflowId": 2
}
```

行为：

- 读取 `alkaid_sessions.pending_patch_json`
- 对目标 workflow 应用 patch
- 成功后清空 `pending_patch_json`

### 4.3 Discard Pending

```http
POST /api/alkaid/discard-pending
```

```json
{
  "sessionId": 1,
  "type": "workflow"
}
```

`type` 枚举：

- `workflow`
- `patch`

行为：

- 清空对应 pending JSON
- 不修改画布

---

## 5. 当前 V1 约束

1. `generate/repair` 已进入 artifact pipeline，但模型草稿阶段仍兼容旧文本提取。
2. `trial_debug` 是确定性工具链，不依赖模型选择工具。
3. `explain` 会先确定性读取当前 workflow，再进行自然语言解释。
4. `debug_report/explain_report` 是结构化报告卡片的数据来源。
5. `pendingWorkflow/pendingPatch` 必须由用户确认后才应用到画布。
