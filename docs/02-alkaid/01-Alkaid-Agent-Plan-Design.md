# Alkaid Agent Plan Design

## 1. 背景

当前瑶光星的 Agentic 流程已经具备以下能力：

- 流式回复
- 多轮工具调用
- 阶段状态（phase）
- 工具步骤（tool steps）
- 待确认工作流 / 待确认补丁

但现阶段的执行过程仍偏“固定流水线”：

- `phase` 基本由后端固定切换
- 工具步骤虽然部分来自模型真实调用，但展示形式更像执行日志
- 用户只能看到“调了什么工具”，看不到“为什么调这个工具”
- 当模型需要多次检索或调整策略时，界面缺少清晰的“计划层”表达

结果是：

- 用户对 AI 的思考过程感知弱
- 复杂任务时容易觉得“卡住”或“像写死的”
- 工具调用虽多轮，但不够像真正的 agent

本设计的目标，是在现有 Agentic 基础上增加一层 **Agent Plan**，让用户看到：

- AI 当前准备做什么
- 为什么这么做
- 这个计划步骤下面调用了哪些工具
- 如果第一次信息不够，AI 如何继续补查、调整计划

## 2. 目标

### 2.1 产品目标

将瑶光星从“固定流程 + 工具日志”升级为“AI 决策计划 + 工具执行”的可解释型 agent。

### 2.2 用户目标

当用户发起复杂任务时，希望看到：

1. AI 先拆解任务
2. AI 说明每一步的理由
3. AI 按步骤调用工具
4. AI 若不确定，会继续查、继续补，而不是直接猜

### 2.3 设计目标

- 保持当前 SSE 流和工具执行框架不推倒重来
- 在现有 `phase + tool_steps` 之上增加 `plan_steps`
- 支持“一个计划步骤下有多个工具子步骤”
- 支持“首次不确定时继续二次检索”
- 后端仍保留执行控制权，不把状态机交给模型

## 3. 非目标

本阶段不追求：

- 完整自治型 agent runtime
- 任意计划树无限嵌套
- 模型直接决定数据库写入或最终状态
- 大规模 prompt orchestration 平台化

本阶段优先做 **标准版 Agent Plan**，而不是一步做到全动态 replan 系统。

## 4. 总体思路

引入两层结构：

### 4.1 计划层

由模型生成或辅助生成，回答：

- 当前准备做什么
- 为什么这么做
- 预计会用哪些工具

例如：

```json
{
  "id": "plan-1",
  "title": "确认数据源是否适合抓取",
  "reason": "用户需求涉及外部网站，若直接生成 crawler 节点，可能使用搜索页或受限页导致工作流失败",
  "status": "running",
  "phase": "planning",
  "toolHints": ["search_knowledge", "check_url_accessibility"],
  "expectedOutput": "得到可用数据源列表与 crawler 默认配置"
}
```

### 4.2 执行层

由后端执行实际工具调用，回答：

- 具体调了哪个工具
- 成功还是失败
- 产出了什么结论

例如：

- 计划步骤：确认数据源是否适合抓取
- 子步骤：
  - `search_knowledge`
  - `check_url_accessibility`
  - `search_knowledge`

## 5. 用户感知效果

### 5.1 当前效果

用户看到：

- 意图分析与规划
- 检索知识库
- 获取能力说明
- 长时间等待
- 最后开始输出

### 5.2 目标效果

用户看到：

1. 计划：确认 crawler 数据源规则
   - 原因：当前任务涉及外部网站抓取，必须先排除搜索页和登录页
   - 子步骤：
     - 检索知识库
     - 检索 crawler 最佳实践

2. 计划：验证候选 URL
   - 原因：避免生成不可运行的 crawler 节点
   - 子步骤：
     - 检查 URL A
     - 检查 URL B

3. 计划：整理并生成工作流方案
   - 原因：已具备足够上下文，可以开始输出结构化方案
   - 子步骤：
     - 获取节点能力
     - 获取 merge 节点规格

这会显著提升“AI 正在思考和决策”的感知。

## 6. 推荐版本划分

### 6.1 V1 可用版

不引入完整 planner，仅在每次工具调用前增加一条“AI 决策步骤”。

特点：

- 成本低
- 可快速上线
- 能马上改善“像写死流程”的问题

限制：

- 没有真正的计划集合
- 难以表达后续步骤依赖关系

### 6.2 V2 标准版

增加真正的 `plan step` 概念：

- 每轮先有计划步骤
- 计划步骤下挂工具子步骤
- 计划步骤有状态变化
- 支持同一步骤里多次工具调用

这是推荐实施版本。

### 6.3 V3 完整版

引入 replan：

- 当前计划不够时，可以新增步骤
- 可重新排序后续步骤
- 可在失败后插入修复步骤

这是更高级版本，但复杂度明显更高。

## 7. 推荐实施版本：V2 标准版

建议按 V2 设计。

### 7.1 原因

- 现有系统已经有 phase、tool step、SSE、前端进度 UI
- 增加 `plan step` 是自然扩展
- 可以复用已有工具执行循环
- 用户能明显感知 agent 的“计划 -> 执行”结构

## 8. 核心数据结构

### 8.1 AgentPlanStep

建议新增后端/前端共享结构：

```ts
type PlanStepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

interface AgentPlanStep {
  planStepId: string;
  userMessageId: number;
  phase: string;
  title: string;
  reason: string;
  expectedOutput?: string;
  toolHints?: string[];
  status: PlanStepStatus;
  startedAt: string;
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}
```

### 8.2 ToolStep 与 PlanStep 的关系

现有 `AgentToolStep` 建议扩展一个字段：

```ts
interface AgentToolStep {
  stepId: string;
  planStepId?: string;
  ...
}
```

这样前端就可以把工具步骤挂到对应计划步骤下面。

## 9. SSE 事件设计

建议新增以下 SSE 事件：

### 9.1 `plan_created`

一次性通知当前轮次的初始计划。

```json
{
  "steps": [
    {
      "planStepId": "plan-1",
      "title": "确认数据源是否适合抓取",
      "reason": "..."
    }
  ]
}
```

### 9.2 `plan_step_started`

表示某个计划步骤开始执行。

### 9.3 `plan_step_updated`

用于更新计划步骤的说明、状态、结果摘要。

### 9.4 `plan_step_finished`

表示某个计划步骤完成。

### 9.5 现有 `tool_step_started/finished`

保留，但增加 `planStepId`，让前端知道它属于哪个计划步骤。

## 10. 后端执行策略

### 10.1 核心原则

- AI 决定“建议做什么”
- 后端决定“实际执行什么、状态是什么”
- 模型不能直接写数据库状态
- 模型不能直接宣称某一步成功

### 10.2 推荐 loop 流程

#### Step 1. 先做计划生成

收到用户消息后，不立即进入工具调用，而是先让模型输出一个短计划。

计划输出要求：

- 步骤不超过 3 到 5 个
- 每个步骤要有标题和理由
- 只允许描述，不直接输出最终答案
- 如任务简单，可只生成 1 到 2 步

#### Step 2. 后端校验计划

后端只接受这些字段：

- `title`
- `reason`
- `expectedOutput`
- `toolHints`

其余字段丢弃。

#### Step 3. 推送计划到前端

通过 SSE 推送 `plan_created`。

#### Step 4. 执行计划步骤

后端开始执行第一条计划步骤，并推送 `plan_step_started`。

#### Step 5. 计划步骤内允许多次工具调用

例如“确认 crawler 配置规则”这一步内，模型可能会：

1. 调 `search_knowledge(query='crawler 工作流示例')`
2. 发现仍不确定
3. 再调 `search_knowledge(query='crawler 坏源规则', target='crawler', category='best_practice')`

这正是用户想看到的“自己决定多调用几次”。

#### Step 6. 若结果不足，可继续下一计划步骤或触发 replan

标准版暂不做完整 replan，只允许：

- 在当前计划步骤内继续多次调用工具
- 或提前结束当前步骤并进入下一个步骤

#### Step 7. 完成后输出最终内容

当计划步骤执行到“生成方案”时，进入现有的流式正文阶段。

## 11. 模型如何生成计划

### 11.1 计划生成 Prompt 原则

应增加一个专门的“生成计划” prompt，而不是直接让主回复 prompt 顺带计划。

要求：

- 输出结构化 JSON
- 只输出计划，不输出正文
- 标题简短
- 理由具体
- 不要超过 5 步

### 11.2 示例

```json
{
  "steps": [
    {
      "title": "检索 crawler 配置和坏源规则",
      "reason": "任务涉及外部网页采集，需要先确认哪些链接适合进入 crawler 节点",
      "toolHints": ["search_knowledge"],
      "expectedOutput": "得到 crawler 节点默认配置和不可用数据源类型"
    },
    {
      "title": "确认候选数据源是否可抓取",
      "reason": "如果直接使用搜索页或受限页，会导致工作流试跑失败",
      "toolHints": ["check_url_accessibility"],
      "expectedOutput": "得到可直接抓取的 URL 列表"
    },
    {
      "title": "生成工作流方案",
      "reason": "已具备足够上下文，可以输出结构化工作流",
      "toolHints": ["get_capabilities", "get_node_spec"],
      "expectedOutput": "完整且符合规范的工作流 JSON"
    }
  ]
}
```

## 12. 前端展示设计

### 12.1 展示结构

前端进度区从：

- 当前 phase
- 一组工具步骤

升级为：

- 当前 phase
- 一组计划步骤
  - 每个计划步骤下面挂对应工具子步骤

### 12.2 UI 建议

每个计划步骤展示：

- 标题
- 原因
- 状态
- 子步骤折叠区

工具子步骤展示：

- 工具名
- 状态
- 结果摘要

### 12.3 展示效果示例

```text
确认 crawler 数据源规则
原因：需要先排除搜索页和登录页，避免生成不可运行的 crawler 节点

  ✓ search_knowledge
  ✓ search_knowledge

验证候选 URL
原因：确认外部站点是否能在当前服务器环境下抓取

  ✓ check_url_accessibility
  ✓ check_url_accessibility

生成工作流方案
原因：上下文已足够，可以开始输出结构化工作流

  ✓ get_capabilities
  ✓ get_node_spec
```

## 13. 与当前架构的兼容方式

### 13.1 可以保留的部分

- 现有 `phase`
- 现有 `tool_step_started/finished`
- 现有 `pending_workflow / pending_patch`
- 现有流式正文输出

### 13.2 需要新增的部分

- `AgentPlanStep`
- `plan_*` SSE 事件
- `tool_step.planStepId`
- 后端计划生成与执行映射
- 前端计划步骤 UI

### 13.3 不建议本阶段重做的部分

- 整个 agent runtime 推翻重写
- phase 完全交给模型决定
- 工具调用完全脱离当前 loop

## 14. 风险与控制

### 14.1 风险：模型生成的计划过长

控制：

- 限制步骤数
- 限制标题长度
- 限制 reason 长度

### 14.2 风险：计划与实际执行不一致

控制：

- 计划是“指导性”，不是强约束
- 后端实际工具执行仍独立控制

### 14.3 风险：前端状态复杂度上升

控制：

- 先做两层结构，不做无限嵌套
- `planStep -> toolSteps[]` 即可

### 14.4 风险：模型乱规划

控制：

- 后端校验计划字段
- 限制工具建议范围
- 不把计划状态交给模型

## 15. 分阶段实施建议

### Phase A

先做“计划步骤 + 工具子步骤”的基础模型：

- 新增后端 plan step 结构
- SSE 扩展
- 前端渲染

### Phase B

加入计划生成：

- 每轮对话先生成短计划
- 将工具步骤挂到计划步骤下

### Phase C

加入计划内多次检索策略：

- 明确鼓励二次检索
- 在 crawler 场景自动偏向 `search_knowledge + check_url_accessibility`

### Phase D

最后考虑 replan：

- 执行中可插入新步骤
- 失败后生成修复计划

## 16. 推荐结论

建议直接做 **V2 标准版**，不要只做文案增强，也不要一步做到完整自治 planner。

推荐原因：

- 对现有代码入侵相对可控
- 用户感知提升最明显
- 可以自然承载“第一次不确定就继续多次调用工具”的能力
- 为后续完整 agent / replan 打下结构基础

## 17. 一句话总结

要让瑶光星真正像 agent，不是简单把固定子步骤改个文案，而是增加一层 **AI 决策计划（Plan）**：

- 先告诉用户“准备做什么、为什么”
- 再执行工具
- 工具执行结果挂在计划步骤下面
- 如果信息不够，就继续补查，而不是直接猜

这会让瑶光星从“执行流水线”升级为“可解释的智能代理”。
