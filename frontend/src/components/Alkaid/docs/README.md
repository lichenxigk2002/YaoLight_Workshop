# 瑶光星（Alkaid）文档目录

本目录与 **Backend: `backend/modules/alkaid/docs/`** 保持同一套文档，前后端各存一份便于查阅。

| 步骤 | 文档 | 说明 |
|------|------|------|
| 00 | [00-README-Alkaid.md](./00-README-Alkaid.md) | 瑶光星 AI 助手产品说明、数据协议、知识库与接口建议（原 Alkaid README） |
| 01 | [01-ALKaid-Architecture.md](./01-ALKaid-Architecture.md) | 增强架构说明：目录隔离、前后端职责、数据流、实施顺序 |
| 02 | [02-ALKaid-Enhancement-ClaudeCode-Style.md](./02-ALKaid-Enhancement-ClaudeCode-Style.md) | 功能增强文档：Agentic、进度可见、人类在环、Hooks、子代理 |
| 03 | [03-ALKaid-Implementation-TaskList-And-Tech.md](./03-ALKaid-Implementation-TaskList-And-Tech.md) | 开发任务清单与详细技术实现（阶段一～五、SSE 协议、工具要点） |
| 04 | [04-ALKaid-Implementation-Summary.md](./04-ALKaid-Implementation-Summary.md) | 当前实现总结：已完成范围、文件清单、路由、后续可做 |
| 05 | [05-ALKaid-Agentic-Integration.md](./05-ALKaid-Agentic-Integration.md) | Agentic 流前端接入说明：useAgentic、onWorkflowApplied、Progress/PendingWorkflow、与后端接口对应 |
| 06 | [06-ALKaid-Implementation-Round2-Summary.md](./06-ALKaid-Implementation-Round2-Summary.md) | 第二轮实现总结：打断、pendingPatch 前端、Hooks、国际化、安全；已实现与未实现功能评估 |

**附录（单独编号，不参与 00～06 主流程）**

| 文档 | 说明 |
|------|------|
| [ALKaid-Unimplemented-Checklist.md](./ALKaid-Unimplemented-Checklist.md) | 未实现清单：LLM tool_calls、其余 Hooks、子代理、联调测试、安全审计 |

冲突时以《瑶光星 · 功能增强文档》与《开发任务清单与详细技术实现》为准。
