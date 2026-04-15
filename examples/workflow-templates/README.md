# Workflow Templates

这些文件可直接通过前端编辑器的“导入工作流”功能导入。

包含 4 套模板：

- `01-minimal-ai-summary.json`
  - 极简模板，6 个节点
  - 适合快速验证“抓取 -> 清洗 -> AI -> 输出”

- `02-medium-competitor-research.json`
  - 中型模板，12 个节点
  - 双分支抓取、双 AI 分析、合并后输出多份结果

- `03-branching-market-intelligence.json`
  - 多分支合并模板，17 个节点
  - 新闻 / 官网 / 政策 三路并发，最终导出时间线和关系网络

- `04-large-ai-research-factory.json`
  - 大型重 AI 模板，35 个节点
  - 多来源并发抓取、分主题 AI 提炼、总报告、风险图表、关系网络

- `05-mega-intelligence-war-room.json`
  - 超重型模板，45 个节点
  - 8 路来源并发、8 个一线 AI、4 个主题综合、最终报告/时间线/关系网络/风险图

- `06-ultra-research-matrix.json`
  - 超重型模板，53 个节点
  - 10 路来源并发、10 个清洗、10 个一线 AI、6 个专题综合、总报告与多种导出

使用建议：

- AI 节点默认使用 `system` 模式、`deepseek` 提供商、`deepseek-chat` 模型。
- 如果你的环境没有配置 `DEEPSEEK_API_KEY`，导入后把 AI 节点切到你已配置好的系统模型或保存模型。
- 爬虫节点的 URL 都是示例地址，导入后按你的真实站点改掉即可。
