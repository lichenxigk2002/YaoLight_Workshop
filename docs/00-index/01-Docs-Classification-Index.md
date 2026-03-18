# 文档分类索引

## 1. 当前结构

`docs` 目录已经按主题整理完成，并统一加入了序号。

当前一级目录如下：

- `00-index`
- `01-product`
- `02-alkaid`
- `03-workflow`
- `04-project-assets`
- `05-governance`
- `06-frontend`
- `07-ops-and-todo`
- `08-thesis`

这样处理之后，根目录不再堆放大量平铺文档，后续查找会更直观。

## 2. 分类说明

### `00-index`

放目录说明、索引、总入口文档。

当前文件：

- `01-Docs-Classification-Index.md`

### `01-product`

放平台级产品能力、模块 PRD、平台规则类文档。

当前文件：

- `01-Concurrent-DAG-Engine-PRD.md`
- `02-Schema-Registry-PRD.md`
- `03-Trigger-Scheduler-PRD.md`
- `04-Node-Types-Management-Spec.md`

### `02-alkaid`

放 Alkaid / AI 智能体相关设计、工具能力、优化说明。

当前文件：

- `01-Alkaid-Agent-Plan-Design.md`
- `02-Alkaid-GetNodeSpec-Optimization.md`
- `03-Alkaid-Large-Workflow-Streaming-And-Fallback.md`
- `04-Alkaid-Patch-Repair-PRD.md`
- `05-Alkaid-URL-Accessibility-Validation.md`
- `06-Crawler-Node-Smart-Fill-PRD.md`

### `03-workflow`

放工作流、执行引擎、工作流 API、模板复用相关文档。

当前文件：

- `01-Nested-Workflow-Plugin-Hub-PRD.md`
- `02-Output-Node-Timeline-Network-Data-Format.md`
- `03-Workflow-API-Access-Docs-Detail.md`
- `04-Workflow-API-Publish-Implementation-Guide.md`
- `05-Workflow-API-Publish-PRD.md`
- `06-Workflow-Template-Consent-Feature.md`
- `07-Workflow-Template-Reuse-Guide.md`

### `04-project-assets`

放项目知识、网站源、生成物等项目资产类文档。

当前文件：

- `01-Project-Knowledge-PRD.md`
- `02-Project-Knowledge-WebsiteSource-Artifact-PRD.md`

### `05-governance`

放权限、治理、凭证、安全侧文档。

当前文件：

- `01-RBAC-Implementation-Guide.md`
- `02-RBAC-PRD.md`
- `03-Vault-Credentials-Manager-PRD.md`

### `06-frontend`

放前端设计规范、UI 规范、样式系统文档。

当前文件：

- `01-Admin-Frontend-UI-Guidelines.md`
- `02-Frontend-Minimal-Style-System.md`

### `07-ops-and-todo`

放 Checklist、TODO、阶段性整理文档。

当前文件：

- `01-Admin-Notifications-MVP-Checklist.md`
- `02-RBAC-TODO.md`

### `08-thesis`

放 thesis 相关文档。

当前文件：

- `01-参考文献_候选.md`
- `02-开题报告_草稿.md`
- `03-第1章_绪论.md`

## 3. 命名规则

这次统一采用了两层序号：

- 目录序号：控制一级主题分组
- 文件序号：控制该目录下的文档顺序

当前规则：

- 目录使用 `00-` 到 `08-`
- 文件使用 `01-`、`02-`、`03-` 这类前缀

说明：

- 这次序号主要是为了让结构更整齐
- 目前不强调优先级和严格先后
- 后续如果某类文档增多，可以继续顺延编号

## 4. 后续维护建议

后面新增文档时，建议按下面规则继续保持一致：

- 先判断属于哪个一级目录
- 尽量补充已有主题文档，不轻易新增平行文档
- `PRD`、实现说明、`TODO` 不要混写在同一份文档里
- 文件名保留主题语义，序号只负责排序

## 5. 一句话结论

现在的 `docs` 已经从“平铺杂糅”整理成了“按主题分层 + 文件带序号”的结构，后面继续维护会轻松很多。
