# ALKaid Agentic Loop 重构执行方案

> 目标：在不破坏现有工具调用能力的前提下，逐步拆解当前 `agentic/loop.go` 的超大职责，完成从“单文件硬编排”到“路由 + 模式 + 执行管线”的重构。
>
> 本文档是执行清单。后续每完成一项，直接在本文档中勾选，不另开新表。

---

## 1. 背景与判断

当前 Alkaid 的核心问题，不是工具不可用，而是调度层过度集中：

- `loop.go` 同时负责消息保存、分流、Hook、工具预取、Plan、Tool Loop、JSON 提取、校验、试跑、修复、提案、SSE 写回
- 普通问答、工作流分析、工作流修改三类请求共享同一条重型执行链，导致体感僵硬
- 前端展示过多内部阶段，放大了“像脚本而不是像智能体”的感受

因此，本次重构的主战场是：

- `backend/modules/alkaid/services/agentic/loop.go`

配套需要轻改的文件：

- `backend/modules/alkaid/services/intent_analyzer.go`
- `frontend/src/components/Alkaid/AlkaidPanel.tsx`

本次重构默认保留不动的能力：

- `tools.Runner`
- `tools.Registry`
- 各类工具实现，如 `get_workflow`、`validate_workflow`、`propose_workflow`

---

## 2. 重构目标

### 2.1 用户体验目标

- 普通问答直接回复，不进入 Agent Plan
- 查看当前工作流时，允许调用工具，但不进入修改执行链
- 真正生成、修改、修复工作流时，才进入完整 Agent 流
- 内部规划默认静默，只有需要展示进度时才上屏

### 2.2 工程目标

- `RunStream` 只保留“入口 + 路由 + 调度”职责
- 将三类模式拆为独立文件：`chat / analyze / act`
- 将 `act` 模式进一步拆成清晰阶段：准备、推理、提取、校验、试跑、修复、提案
- 逐步收敛 SSE 事件，让前端只消费必要事件

### 2.3 约束

- 不一次性重写，采用可回滚的渐进式重构
- 每个阶段结束后都必须可测试、可运行、可合并
- 每一阶段优先保护现有能力，不追求一步到位的“完美架构”

---

## 3. 目标架构

重构完成后的后端结构建议如下：

```text
agentic/
  loop.go                  # 仅保留入口与调度
  router.go                # 路由决策：chat / analyze / act
  context.go               # TurnContext / RouteDecision / 公共依赖组装
  chat_mode.go             # 普通问答直答
  analyze_mode.go          # 查看/解释/分析当前工作流
  act_mode.go              # 真正的生成/修改工作流入口
  act_pipeline.go          # validate / trial / repair / propose
  event_writer.go          # SSE 事件收敛与辅助方法
  tool_context.go          # 工具结果给 LLM 的压缩、裁剪、上下文整理
```

目标行为：

- `RunStream -> BuildTurnContext -> DecideRoute -> runChatMode/runAnalyzeMode/runActMode`

---

## 4. 里程碑与勾选清单

## 里程碑 A：冻结现状，建立回归保护

### A1. 建立基线测试

- [x] 为普通问答建立回归测试
- [x] 为“查看当前工作流”建立回归测试
- [ ] 为“生成/修改工作流 -> validate -> trial/propose”建立回归测试
- [x] 为 SSE 关键事件顺序建立测试

### A2. 明确不允许退化的能力

- [x] 记录当前可用工具列表与关键入口
- [x] 记录当前必须保留的事件类型
- [x] 记录当前 UI 必须保留的用户感知能力

当前基线快照：

- 工具关键入口保持不动：`tools.Runner`、`tools.Registry`、`registry.ExecuteTool(...)`
- 当前必须保留的核心工具能力：`get_workflow`、`get_capabilities`、`search_knowledge`、`validate_workflow`、`run_workflow_trial`、`propose_workflow`、`propose_patch`
- 当前必须保留的关键事件：`content`、`phase_changed`、`tool_step_started`、`tool_step_finished`、`pending_workflow`、`pending_patch`、`done`、`error`
- 当前 UI 必须保留的用户感知能力：普通问答直答、工作流查看分析、待确认工作流/补丁展示、执行阶段可视化、最终可应用到画布

### 验收标准

- `go test ./modules/alkaid/...` 通过
- 至少覆盖三类核心路径：`chat / analyze / act`

---

## 里程碑 B：抽出公共上下文与路由决策

### B1. 抽公共结构

- [x] 新建 `context.go`
- [x] 定义 `TurnContext`
- [x] 定义 `RouteMode`
- [x] 定义 `RouteDecision`
- [x] 把 `history/session/request context` 的组装逻辑从 `loop.go` 中迁出

建议结构：

```go
type RouteMode string

const (
    RouteChat    RouteMode = "chat"
    RouteAnalyze RouteMode = "analyze"
    RouteAct     RouteMode = "act"
)

type RouteDecision struct {
    Mode         RouteMode
    NeedWorkflow bool
    NeedTools    bool
    NeedApproval bool
    ShowProgress bool
    Reason       string
}
```

### B2. 抽路由器

- [x] 新建 `router.go`
- [x] 将 `shouldUseAgenticPlanning` 升级为 `DecideRoute`
- [ ] 将 `IntentAnalyzer` 的出口从布尔值升级为结构化判断
- [x] 在 `RunStream` 中改为先路由、后分发

### 验收标准

- `RunStream` 能根据路由结果进入不同模式
- 此阶段不要求删掉旧代码，但旧代码不能再直接控制所有分支

---

## 里程碑 C：完成 Chat Mode 独立

### C1. 拆出普通问答模式

- [x] 新建 `chat_mode.go`
- [x] 将 `runDirectChatStream` 搬入独立文件
- [x] 将直答流的协议清洗逻辑一并迁出
- [x] 确保 `chat mode` 不展示 plan，不触发 validate/trial/propose

### C2. 收敛 Chat Mode 责任

- [x] 只保留文本回复、历史上下文、基础 SSE 输出
- [x] 禁止在 `chat mode` 内做工作流 JSON 提取
- [x] 禁止在 `chat mode` 内做待确认提案

### 验收标准

- 普通问答只看到内容流，不看到多余执行阶段
- 现有 `[CONTENT_DELTA]` 清洗逻辑仍然有效

---

## 里程碑 D：完成 Analyze Mode 独立

### D1. 新建分析模式

- [x] 新建 `analyze_mode.go`
- [x] 支持查看当前工作流
- [x] 支持解释当前工作流结构
- [x] 支持给出修改建议，但不直接进入修改执行

### D2. 限制 Analyze Mode 的工具范围

- [x] 允许：`get_workflow`
- [x] 允许：`get_capabilities`
- [x] 允许：`search_knowledge`
- [x] 禁止：`validate_workflow`
- [x] 禁止：`run_workflow_trial`
- [x] 禁止：`propose_workflow/propose_patch`

### 验收标准

- “帮我看看当前工作流”进入 analyze，而不是 act
- analyze 可以调用工具，但不会进入等待确认状态

---

## 里程碑 E：完成 Act Mode 外壳独立

### E1. 新建执行模式

- [x] 新建 `act_mode.go`
- [x] 将 `loop.go` 中真正负责工作流生成/修改的主链迁出
- [x] 保留现有工具调用和 Hook 能力
- [x] 保留当前 `plan/tool_step` 输出能力

### E2. 保持功能等价

- [x] 继续支持工具调用循环
- [x] 继续支持工作流 JSON 提取
- [x] 继续支持 `validate`
- [x] 继续支持 `trial`
- [x] 继续支持 `repair`
- [x] 继续支持 `propose_workflow/propose_patch`

### 验收标准

- Act 模式的能力与当前主链一致
- `RunStream` 中不再直接承载全部执行细节

当前结果：

- `loop.go` 已从约 `1633` 行收缩到 `48` 行
- 主执行链已迁入 `act_mode.go`
- 分流入口已形成 `chat / analyze / act` 三种 mode

---

## 里程碑 F：拆 Act Pipeline

### F1. 拆准备阶段

- [ ] 将 Hook 前置检查迁出
- [ ] 将 crawler 预取与 URL 预检迁出
- [ ] 将 prompt 组装迁出

建议目标函数：

- `prepareActContext`
- `prepareCrawlerRequirements`
- `buildActPrompt`

### F2. 拆工具推理阶段

- [ ] 将 tool loop 迁出
- [ ] 将 plan step 维护逻辑迁出
- [ ] 将 tool result 注入 LLM 的逻辑迁出

建议目标函数：

- `runToolReasoningLoop`
- `buildToolContentForLLM`
- `selectOrCreatePlanStep`

### F3. 拆结果处理阶段

- [x] 将工作流 JSON 提取迁出
- [x] 将 fallback 结构化整理迁出
- [ ] 将 assistant 内容落库保留在统一出口

建议目标函数：

- `extractWorkflowResult`
- `generateWorkflowJSONFallback`
- `saveAssistantMessage`

### F4. 拆校验/试跑/修复/提案阶段

- [x] 将 `validate` 迁入 `act_pipeline.go`
- [x] 将 URL 校验迁入 `act_pipeline.go`
- [x] 将 `trial` 迁入 `act_pipeline.go`
- [x] 将 `repair` 迁入 `act_pipeline.go`
- [x] 将 `propose_workflow/propose_patch` 迁入 `act_pipeline.go`

建议目标函数：

- `validateWorkflowResult`
- `validateWorkflowURLs`
- `runWorkflowTrial`
- `repairWorkflowIfNeeded`
- `proposeWorkflowResult`

### 验收标准

- `act_mode.go` 只保留执行编排，不保留具体阶段细节
- `loop.go` 不再直接包含校验、试跑、修复、提案的大段逻辑

---

## 里程碑 G：收敛事件协议与展示策略

### G1. 区分“内部执行”与“用户可见执行”

- [ ] 规划默认静默
- [ ] 只有工具调用时才显示工具步骤
- [ ] 只有进入 `act` 模式才显示完整执行 dock
- [ ] 分析模式仅显示必要的轻量进度

### G2. 收敛后端事件

- [ ] 梳理当前 SSE 事件类型
- [ ] 区分内部事件和前端消费事件
- [ ] 补统一的事件写入辅助方法

建议最终优先保留的用户可见事件：

- `content`
- `progress`
- `approval_required`
- `done`
- `error`

### 验收标准

- 用户不再感受到“任何一句话都像在跑流程”
- 前端不需要通过复杂 phase 猜测当前行为

---

## 里程碑 H：前端收口

### H1. 前端状态收敛

- [ ] 将 Alkaid 会话状态抽到 hook
- [ ] 减少 `AlkaidPanel.tsx` 中的流程判断
- [ ] 让前端以“模式 + 事件”驱动展示，而不是以“巨型 phase 判断”驱动

建议拆分：

- `useAlkaidSession`
- `ProgressDock`
- `PendingApprovalPanel`
- `ChatMessageList`

### H2. 展示策略配合后端模式

- [x] `chat` 模式默认不显示进度 dock
- [x] `analyze` 模式只显示必要轻量提示
- [ ] `act` 模式显示完整执行态和待确认卡片

### 验收标准

- 前端组件职责清晰
- 进度 UI 与后端模式一致

---

## 里程碑 I：删旧代码与文档收尾

### I1. 清理旧逻辑

- [ ] 删除 `loop.go` 中已失效的重复逻辑
- [ ] 删除旧的布尔式分流残留
- [ ] 删除过时的注释和临时兼容代码

### I2. 更新文档

- [ ] 更新本执行方案中的勾选状态
- [ ] 增加一份重构完成总结
- [ ] 更新 `docs/README.md` 目录说明

### 验收标准

- `loop.go` 回归为入口文件，而不是全能文件
- 文档与实际结构一致

---

## 5. 推荐执行顺序

建议严格按下面顺序推进，不要跳步：

1. 先补基线测试
2. 先抽 `context.go` 与 `router.go`
3. 先独立 `chat_mode.go`
4. 再独立 `analyze_mode.go`
5. 再独立 `act_mode.go`
6. 最后拆 `act_pipeline.go`
7. 等后端稳定后，再收前端
8. 最后删旧逻辑

原因：

- 这样每一步都能运行
- 每一步都能回退
- 不会因为一次大改导致工具能力一起失效

---

## 6. 当前建议的第一刀

如果马上开始执行，建议第一刀只做下面这些：

- [ ] 新建 `context.go`
- [ ] 新建 `router.go`
- [ ] 把 `RunStream` 改成“先路由，后分发”
- [ ] 把 `runDirectChatStream` 正式迁到 `chat_mode.go`

这是最小但收益最大的改动，因为它会立刻带来两个结果：

- `loop.go` 开始瘦身
- 普通问答和重型执行链彻底脱钩

---

## 7. 进度记录

后续执行时，在这里追加记录，保持本文档单一来源：

- [x] 第 1 次执行：建立基线测试
- [x] 第 2 次执行：抽 `context.go` / `router.go`
- [x] 第 3 次执行：迁出 `chat_mode.go`
- [x] 第 4 次执行：迁出 `analyze_mode.go`
- [x] 第 5 次执行：迁出 `act_mode.go`
- [x] 第 6 次执行：拆 `act_pipeline.go`
- [ ] 第 7 次执行：前端收口
- [x] 第 8 次执行：删除旧逻辑并补总结
## 2026-03-19 Updates

- [x] `act_pipeline.go` has been created and is now wired into the active `runActMode` execution path.
- [x] `validate`, URL validation, `trial`, `repair`, and `propose_workflow/propose_patch` now run through `act_pipeline.go`.
- [x] `go test ./modules/alkaid/...` passes after the pipeline handoff.
- [x] Backend now emits an explicit `interaction_mode` SSE event so the frontend no longer has to infer `chat / analyze / act` purely from phase.
- [x] The commented legacy tail in `act_mode.go` has been physically removed, and `runActMode` now compiles cleanly without the legacy commented block.
- [x] `go test ./modules/alkaid/...` still passes after the physical cleanup of `act_mode.go`.
