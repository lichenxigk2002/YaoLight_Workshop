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

---

## 2. 按阶段归类

| 阶段 | 未实现项 |
|------|----------|
| **阶段二** | LLM tool_calls（模型选工具 + 多轮循环） |
| **阶段四** | OnWorkflowRunFailed、AfterGenerate、BeforeGenerate 三个 Hook；子代理（可选） |
| **阶段五** | 联调与端到端测试；安全/审计增强（token 不落盘） |

---

## 3. 参考文档

- 任务清单与实现细则：`03-ALKaid-Implementation-TaskList-And-Tech.md`
- 功能增强目标：`02-ALKaid-Enhancement-ClaudeCode-Style.md`
- 当前实现总结：`04-ALKaid-Implementation-Summary.md`、`06-ALKaid-Implementation-Round2-Summary.md`

实现上述任一项后，建议在本清单中标注完成或移至「已实现」说明，并同步更新 04/06 文档。
