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

- `07-guan-yu-thesis-minimal.json`
  - 论文极简模板，6 个节点
  - 针对“关羽形象”题目，抓取《三国志·关羽传》后直接生成一篇研究综述

- `08-guan-yu-thesis-comparative.json`
  - 论文比较模板，14 个节点
  - 正史与《三国演义》并行抓取，生成一篇比较研究稿

- `09-guan-yu-thesis-deep-analysis.json`
  - 论文深度模板，28 个节点
  - 正史、忠义话语、演义关键章节多路并发，最终输出一篇完整论文式总结文章

- `10-guan-yu-thesis-mega-workshop.json`
  - 巨型论文模板，43 个节点
  - 8 路文本、8 个一线分析、4 个章节生成、2 个总述综合，最后出一篇更完整的论文稿

- `11-guan-yu-thesis-monster-factory.json`
  - 怪物级论文模板，52 个节点
  - 10 路文本、10 个一线分析、4 个中层综合、2 个上层总述、初稿重写与终稿润色，目标是尽量压出高质量总结文档

- `12-guan-yu-thesis-omni-bibliography-factory.json`
  - 全源论文模板，40+ 个节点
  - 原典爬虫 + 手动参考文献输入 + 文献综述分支 + 章节统稿 + 参考文献编排，适合把本科论文一次性做完整

使用建议：

- AI 节点默认使用 `system` 模式、`deepseek` 提供商、`deepseek-chat` 模型。
- 如果你的环境没有配置 `DEEPSEEK_API_KEY`，导入后把 AI 节点切到你已配置好的系统模型或保存模型。
- 新增的关羽论文模板统一使用 `ctext.org` 已公开可访问页面，包含：
  - `https://ctext.org/text.pl?if=gb&node=603534&remap=gb`
  - `https://ctext.org/datawiki.pl?if=gb&res=330476`
  - `https://ctext.org/zhong-jing`
  - `https://ctext.org/sanguo-yanyi/ch25/zh`
  - `https://ctext.org/sanguo-yanyi/ch27/zh`
  - `https://ctext.org/sanguo-yanyi/ch75/zh`
- `12-guan-yu-thesis-omni-bibliography-factory.json` 额外支持在开始节点直接粘贴：
  - `referenceBibliographyRaw`：参考文献原始列表
  - `literatureNotesRaw`：文献摘要、读书笔记、导师意见整理
