# 瑶光星增强 · 校验与优化功能实现总结

> 本文档记录"校验与优化"和"确认与交付"两个工具步的完整实现，补充了 Agentic Loop 中缺失的工作流试跑和自动修复功能。

---

## 1. 实现概述

### 1.1 背景

原有的 Agentic Loop 实现为简化的固定管道：
```
get_capabilities → get_workflow → LLM 生成 → validate_workflow → propose_workflow
```

缺少了关键的**工作流试跑**和**失败自动修复**环节，导致前端定义的"校验与优化"和"确认与交付"两个阶段无法充分展示。

### 1.2 本次实现

完善了完整的工作流生命周期管理：
```
validate_workflow (校验结构)
    ↓ (通过)
run_workflow_trial (试跑预演)
    ↓ (失败) → repairing (自动修复) → 重新校验 → 继续
    ↓ (成功)
propose_workflow (提出工作流)
    ↓
propose_patch (生成补丁)
    ↓
waiting_approval (等待用户确认)
```

---

## 2. 详细实现

### 2.1 阶段 1：校验工作流结构 (Validating)

**执行工具**: `validate_workflow`

**功能**:
- 检查工作流 JSON 结构完整性
- 验证必填字段（version, nodes, edges）
- 检查节点和边的 id、type、source、target 等字段

**处理逻辑**:
```go
// 调用 validate_workflow 工具
valResult, valSummary, valErr := registry.ExecuteTool("validate_workflow", params, req.SessionID)

// 解析校验结果
var valid bool
var validationErrors []interface{}
if m, ok := valResult.(map[string]interface{}); ok {
    valid, _ = m["valid"].(bool)
    validationErrors, _ = m["errors"].([]interface{})
}

// 校验失败则终止流程
if valErr != nil || !valid {
    _ = sw.WriteToolStepFinished("step-validate", alkaidModels.ToolStepError, valSummary, errMsg)
    _ = sw.WritePhaseChanged(alkaidModels.PhaseError)
    return nil
}
```

**前端展示**: "校验与优化" 阶段开始，显示 `validate_workflow` 工具步

---

### 2.2 阶段 2：试跑工作流 (Running Trial)

**执行工具**: `run_workflow_trial`

**功能**:
- 将工作流转换为 ExecutionRequest
- 调用 WorkflowExecutor 进行试跑
- 返回执行结果或错误详情

**处理逻辑**:
```go
// 调用 run_workflow_trial 工具
_ = sw.WritePhaseChanged(alkaidModels.PhaseRunningTrial)
trialResult, trialSummary, trialErr := registry.ExecuteTool("run_workflow_trial", params, req.SessionID)

// 解析试跑结果
var trialSuccess bool
var trialErrorMsg string
if m, ok := trialResult.(map[string]interface{}); ok {
    trialSuccess, _ = m["success"].(bool)
    if errField, hasErr := m["error"]; hasErr && errField != nil {
        trialErrorMsg = fmt.Sprintf("%v", errField)
    }
}
```

**前端展示**: "校验与优化" 阶段中的 `run_workflow_trial` 工具步

---

### 2.3 阶段 2.5：自动修复 (Repairing) - 新增

**触发条件**: `run_workflow_trial` 失败时自动进入

**功能**:
1. 将试跑错误信息反馈给 LLM
2. LLM 分析错误并生成修复后的工作流
3. 重新校验修复后的工作流
4. 如果修复成功，使用新工作流继续；否则终止并提示用户

**处理逻辑**:
```go
if trialErr != nil || !trialSuccess {
    // 进入修复阶段
    _ = sw.WritePhaseChanged(alkaidModels.PhaseRepairing)
    _ = sw.WriteContent("\n\n⚠️ 工作流试跑失败，正在尝试自动修复...\n")
    
    // 构造修复提示
    repairPrompt := fmt.Sprintf("工作流试跑失败，错误信息：%s\n\n请分析错误原因并生成修复后的工作流。", errMsg)
    
    // 调用 LLM 进行修复
    messages = append(messages, providers.ChatMessage{
        Role:    "user",
        Content: repairPrompt,
    })
    
    repairResp, repairErr := aiProvider.ChatWithTools(reqCtx, aiConfig, systemPrompt, messages, toolDefs, ...)
    
    // 提取修复后的工作流
    repairedWorkflowJSON := extractWorkflowJSON(repairResp.Content)
    
    // 重新校验
    valResult2, valSummary2, valErr2 := registry.ExecuteTool("validate_workflow", fmt.Sprintf(`{"workflow":%s}`, repairedWorkflowJSON), req.SessionID)
    
    // 如果修复成功，使用新工作流
    if validRepair {
        workflowJSON = repairedWorkflowJSON
        _ = sw.WriteContent("\n✅ 工作流已自动修复并通过校验\n")
    }
}
```

**前端展示**: 
- Phase 切换到 `repairing`
- 显示 "校验与优化" 阶段中的修复相关工具步
- 流式输出修复建议和状态更新

---

### 2.4 阶段 3：确认与交付 (Waiting Approval)

**执行工具**: `propose_workflow` + `propose_patch`

**功能**:
1. 将验证和测试通过的工作流写入会话的 `pendingWorkflow`
2. 如果存在当前画布，计算 diff 并生成 `pendingPatch`
3. 推送 `pending_workflow` 和 `pending_patch` 事件给前端
4. 等待用户确认应用或放弃

**处理逻辑**:
```go
// 提出工作流
_ = sw.WritePhaseChanged(alkaidModels.PhaseWaitingApproval)
_ = sw.WriteToolStepStarted("step-propose", "propose_workflow", alkaidModels.PhaseWaitingApproval)
_, propSummary, _ := registry.ExecuteTool("propose_workflow", fmt.Sprintf(`{"workflow":%s}`, workflowJSON), req.SessionID)
_ = sw.WriteToolStepFinished("step-propose", alkaidModels.ToolStepSuccess, propSummary, "")

// 推送待确认工作流摘要
_ = sw.WritePendingWorkflow(nodeCount, edgeCount)

// 生成补丁（如果有当前画布）
if proposedNodes != nil && currentWorkflowForDiff != nil {
    patch, patchErr := ComputeWorkflowDiff(currentWorkflowForDiff, proposedNodes, proposedEdges)
    if patchErr == nil && len(patch) > 0 {
        _ = sw.WriteToolStepStarted("step-patch", "propose_patch", alkaidModels.PhaseWaitingApproval)
        _, _, _ = registry.ExecuteTool("propose_patch", string(patchJSON), req.SessionID)
        _ = sw.WriteToolStepFinished("step-patch", alkaidModels.ToolStepSuccess, fmt.Sprintf("已生成 %d 项补丁", len(patch)), "")
        _ = sw.WritePendingPatch(len(patch))
    }
}
```

**前端展示**: 
- Phase 切换到 `waiting_approval`
- "确认与交付" 阶段高亮
- 显示 `propose_workflow` 和 `propose_patch` 工具步
- 在消息列表下方弹出 "待确认工作流" 卡片

---

## 3. Phase 与工具步对应关系

| Phase | 阶段名称 | 执行的工具 | 前端展示 |
|-------|---------|-----------|---------|
| `planning` | 意图分析与规划 | `get_capabilities`, `get_workflow` | "意图分析与规划" |
| `generating` | 内容生成 | LLM 生成工作流 JSON | "内容生成" |
| `validating` | 校验与优化 - 结构校验 | `validate_workflow` | "校验与优化" ✨ |
| `running_trial` | 校验与优化 - 执行试跑 | `run_workflow_trial` | "校验与优化" ✨ |
| `repairing` | 校验与优化 - 自动修复 | LLM 修复 + `validate_workflow` | "校验与优化" ✨ |
| `waiting_approval` | 确认与交付 | `propose_workflow`, `propose_patch` | "确认与交付" ✨ |
| `idle` | 空闲 | - | 所有步骤完成 |
| `error` | 错误 | - | 错误状态 |

---

## 4. 错误处理与容错

### 4.1 校验失败

- **触发**: `validate_workflow` 返回 `valid: false`
- **处理**: 终止流程，将错误信息展示给用户，Phase 设为 `error`
- **前端**: 显示错误的工具步，phase 为 error 状态

### 4.2 试跑失败 + 修复成功

- **触发**: `run_workflow_trial` 失败
- **处理**: 
  1. 进入 `repairing` 阶段
  2. 调用 LLM 分析错误并生成修复方案
  3. 重新校验修复后的工作流
  4. 如果通过，使用修复后的工作流继续
- **前端**: 显示修复过程和状态更新

### 4.3 试跑失败 + 修复失败

- **触发**: 修复后的工作流仍然校验失败，或无法提取有效工作流
- **处理**: 终止流程，提示用户手动调整
- **前端**: Phase 设为 `error`，显示错误信息

### 4.4 用户中断

- **触发**: 用户在任何阶段点击"停止"或发送新消息
- **处理**: 通过 `checkCancel()` 检测 context 取消，发送 `interrupted` 事件并退出
- **前端**: 停止进度展示，清空当前状态

---

## 5. 前端集成

### 5.1 进度组件映射

`AlkaidProgress.tsx` 中定义的 4 个步骤与 Phase 的对应关系：

```typescript
const PIPELINE_STEPS: PipelineStep[] = [
  {
    key: 'planning',
    label: '意图分析与规划',
    phases: ['planning'],
  },
  {
    key: 'generating',
    label: '内容生成',
    phases: ['generating'],
  },
  {
    key: 'validating',
    label: '校验与优化',        // ← 本次实现的重点
    phases: ['validating', 'repairing', 'running_trial'],
  },
  {
    key: 'finishing',
    label: '确认与交付',        // ← 本次实现的重点
    phases: ['waiting_approval', 'summarizing'],
  }
];
```

### 5.2 SSE 事件流示例

完整流程的 SSE 事件序列：
```
event: phase_changed
data: {"phase":"planning","at":"2025-02-10T..."}

event: tool_step_started
data: {"stepId":"step-xxx","toolName":"get_capabilities","phase":"planning","at":"..."}

event: tool_step_finished
data: {"stepId":"step-xxx","status":"success","resultSummary":"返回 12 种节点类型","at":"..."}

event: phase_changed
data: {"phase":"generating","at":"..."}

event: content
data: {"delta":"根据您的需求，我为您设计了以下工作流..."}

event: phase_changed
data: {"phase":"validating","at":"..."}

event: tool_step_started
data: {"stepId":"step-validate","toolName":"validate_workflow","phase":"validating","at":"..."}

event: tool_step_finished
data: {"stepId":"step-validate","status":"success","resultSummary":"校验通过","at":"..."}

event: phase_changed
data: {"phase":"running_trial","at":"..."}

event: tool_step_started
data: {"stepId":"step-trial","toolName":"run_workflow_trial","phase":"running_trial","at":"..."}

event: tool_step_finished
data: {"stepId":"step-trial","status":"success","resultSummary":"试跑成功，3 个节点执行完成","at":"..."}

event: phase_changed
data: {"phase":"waiting_approval","at":"..."}

event: tool_step_started
data: {"stepId":"step-propose","toolName":"propose_workflow","phase":"waiting_approval","at":"..."}

event: tool_step_finished
data: {"stepId":"step-propose","status":"success","resultSummary":"已提出工作流，共 3 节点，等待用户确认","at":"..."}

event: pending_workflow
data: {"summary":{"nodeCount":3,"edgeCount":2}}

event: phase_changed
data: {"phase":"idle","at":"..."}

event: done
data: {}
```

---

## 6. 测试建议

### 6.1 正常流程测试

1. 发送工作流生成请求
2. 观察前端进度展示是否正确切换阶段
3. 确认"校验与优化"阶段显示 `validate_workflow` 和 `run_workflow_trial` 工具步
4. 确认"确认与交付"阶段显示 `propose_workflow` 工具步
5. 点击"应用到画布"，验证画布更新正确

### 6.2 自动修复流程测试

1. 构造一个容易失败的工作流请求（如节点配置错误）
2. 观察试跑失败后是否进入 `repairing` 阶段
3. 确认前端显示修复提示和进度
4. 验证修复后的工作流能否继续流程

### 6.3 错误处理测试

1. 测试校验失败的情况（如生成的 JSON 格式错误）
2. 测试试跑失败且无法修复的情况
3. 测试用户中断流程的情况
4. 确认错误信息正确展示给用户

---

## 7. 与文档的对应关系

### 7.1 完成的任务清单项

参考 `03-ALKaid-Implementation-TaskList-And-Tech.md`：

- ✅ **阶段二 2.4**: 实现 `validate_workflow` 和 `run_workflow_trial` 工具
- ✅ **阶段二 2.5**: 实现 `propose_workflow` 和 `propose_patch` 工具
- ✅ **阶段三 3.4**: 前端展示 `pendingWorkflow` 并支持应用
- ✅ **阶段三 3.5**: 前端展示 `pendingPatch` 并支持应用

### 7.2 未实现清单更新

参考 `ALKaid-Unimplemented-Checklist.md`：

本次实现**未涉及**以下功能（仍为未实现状态）：
- ❌ LLM tool_calls（完全由 LLM 自主选择工具，而非固定管道）
- ❌ OnWorkflowRunFailed Hook（工作流试跑失败时的外部回调）
- ❌ AfterGenerate / BeforeGenerate Hook
- ❌ 子代理

但本次实现**部分满足**了自动修复的需求，通过在试跑失败时调用 LLM 进行修复，实现了基础的错误自愈能力。

---

## 8. 后续优化方向

1. **更智能的修复策略**：
   - 根据错误类型（节点配置错误、连接错误、执行错误）采用不同的修复提示
   - 限制修复尝试次数，避免无限循环

2. **Hook 集成**：
   - 在 `run_workflow_trial` 失败时调用 `OnWorkflowRunFailed` Hook
   - 允许外部系统参与修复决策

3. **细粒度进度反馈**：
   - 试跑时展示每个节点的执行状态
   - 修复时展示 LLM 的思考过程

4. **用户交互增强**：
   - 修复失败时询问用户是否手动调整
   - 提供"跳过试跑"选项（适用于大型工作流）

---

## 9. 文件清单

本次实现涉及的文件：

| 文件 | 变更说明 |
|------|---------|
| `Low_code_Backend/modules/alkaid/services/agentic/loop.go` | 完善工作流生命周期管理：validate → trial → repair → propose |
| `Low_code_Backend/modules/alkaid/services/tools/validate_workflow.go` | 已有实现，本次直接使用 |
| `Low_code_Backend/modules/alkaid/services/tools/run_workflow_trial.go` | 已有实现，本次直接使用 |
| `Low_code_Backend/modules/alkaid/services/tools/propose_workflow.go` | 已有实现，本次直接使用 |
| `Low_code_Backend/modules/alkaid/services/tools/propose_patch.go` | 已有实现，本次直接使用 |
| `Low_code_Frontend/src/components/Alkaid/components/AlkaidProgress.tsx` | 前端进度组件，已定义"校验与优化"和"确认与交付"阶段 |
| `Low_code_Backend/modules/alkaid/docs/07-ALKaid-Validation-Trial-Implementation.md` | 本文档，记录实现细节 |

---

## 10. 总结

本次实现补充了 Agentic Loop 中关键的"校验与优化"和"确认与交付"功能，使得：

1. ✅ 工作流在提交给用户前经过**结构校验**和**执行试跑**
2. ✅ 试跑失败时能够**自动修复**，提高成功率
3. ✅ 前端能够完整展示工作流生成的**全生命周期**
4. ✅ 用户可以在**确认与交付**阶段查看工作流摘要并决定是否应用

通过这些改进，瑶光星助手的工作流生成能力更加健壮和用户友好，符合"Claude Code Style"的增强目标。
