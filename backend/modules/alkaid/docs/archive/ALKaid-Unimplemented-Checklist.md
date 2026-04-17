# 瑶光星增强 · 未实现清单

> 本文档仅列出**尚未实现**的功能，便于排期与迭代。与 `04-ALKaid-Implementation-Summary.md`、`06-ALKaid-Implementation-Round2-Summary.md`、`07-ALKaid-Validation-Trial-Implementation.md` 配套使用；实现后可从本清单移除或标注完成。

---

## 0. 最近完成的功能（2026-02-10）

| 功能 | 说明 | 实现文档 |
|------|------|----------|
| **工作流试跑（run_workflow_trial）** | 在 validate 通过后自动试跑工作流，验证执行正确性 | `07-ALKaid-Validation-Trial-Implementation.md` |
| **自动修复（repairing）** | 试跑失败时调用 LLM 分析错误并生成修复方案，重新校验后继续流程 | `07-ALKaid-Validation-Trial-Implementation.md` |
| **完整的工作流生命周期** | validate → trial → repair → propose → waiting_approval | `07-ALKaid-Validation-Trial-Implementation.md` |
| **Hooks 系统（4个钩子）** | BeforeGenerate、AfterGenerate、BeforeApplyWorkflow、OnWorkflowRunFailed | `08-ALKaid-Hooks-Implementation.md` |
| **工具步持久化** | 工具步自动保存到数据库，按对话轮次分组显示，切换会话或刷新页面后可查看历史执行过程（不传给 AI） | `10-ALKaid-ToolSteps-Persistence.md` |
| **智能工具选择** | 新增 search_knowledge 工具，优化工具描述，让 AI 根据用户意图智能选择工具（而不是固定调用 get_workflow） | `11-ALKaid-Smart-Tool-Selection.md` |

---

## 1. 未实现功能列表

| 序号 | 功能 | 对应任务 | 说明 |
|------|------|----------|------|
| 1 | **LLM tool_calls（完全自主）** | 阶段二 2.1 / 2.2 | 当前已实现 LLM tool_calls 的基础调用，但仍为增强的固定管道（包含试跑和修复）。未来可改为完全由模型自主选择工具和调用顺序。需：更灵活的 system prompt、移除固定管道逻辑、完全信任模型的工具选择。 |
| 2 | **子代理** | 阶段四 4.4（可选） | 诊断子代理、修图子代理等的输入输出约定；主 Agent 通过「调用子代理」工具或内部调用，将子代理结果汇总回主会话。 |
| 3 | **用户打断功能（完善）** | 阶段三 3.7 | 当前有 context 取消检测，但缺少显式的打断接口和前端"停止"按钮。需：interrupt 接口、前端打断 UI、打断后的状态恢复。 |
| 4 | **联调与端到端测试** | 阶段五 5.3 | 端到端测试：发需求 → 多步工具 → 进度展示 → 提出工作流/补丁 → 应用 → 画布正确更新。需产出测试用例或测试清单。 |
| 5 | **安全与审计增强** | 阶段五 5.2（部分） | apply-workflow/apply-patch 权限校验已完成。未做：Hook 与工具不把 token/密钥写入 prompt 或日志的审计点与规范（可文档化 + 代码检查）。 |

---

## 2. 按阶段归类

| 阶段 | 未实现项 |
|------|----------|
| **阶段二** | LLM tool_calls（完全自主模式，当前为增强的固定管道） |
| **阶段三** | 用户打断功能（完善） |
| **阶段四** | 子代理（可选） |
| **阶段五** | 联调与端到端测试；安全/审计增强（token 不落盘） |

---

## 3. 参考文档

- 任务清单与实现细则：`03-ALKaid-Implementation-TaskList-And-Tech.md`
- 功能增强目标：`02-ALKaid-Enhancement-ClaudeCode-Style.md`
- 当前实现总结：`04-ALKaid-Implementation-Summary.md`、`06-ALKaid-Implementation-Round2-Summary.md`

实现上述任一项后，建议在本清单中标注完成或移至「已实现」说明，并同步更新 04/06 文档。
