# 项目知识 / 助手上下文模块 PRD 与实施方案

| 项目 | 说明 |
|------|------|
| 产品名称 | 瑶光工坊 · 项目知识 / 助手上下文 |
| 文档版本 | 1.0 |
| 适用系统 | Low_code_Frontend、Low_code_Backend、Admin_Frontend |
| 文档目标 | 明确一个轻量、可落地、服务于低代码工作流主线的“项目知识”能力 |

---

## 1. 产品定位

### 1.1 背景

当前项目的主轴是：

- 低代码工作流设计与执行
- Alkaid 助手辅助生成、修改、诊断工作流
- 管理端维护系统级知识与运营配置

系统已经具备：

- Alkaid 知识检索链路
- 系统知识表 `alkaid_knowledge`
- 管理端“知识库管理”能力

但缺少一个更贴近用户主流程的能力：

- 让用户在自己的项目里沉淀规则、经验、术语、注意事项
- 让 Alkaid 在项目上下文中使用这些信息
- 让工作流生成与排错更贴近项目真实需求

### 1.2 本模块定位

本模块不是“用户 RAG 平台”，而是：

- 项目级知识沉淀
- Alkaid 的项目上下文增强
- 工作流生成与排错的辅助能力

一句话定义：

> 让每个项目都拥有少量、结构简单、可被 Alkaid 使用的上下文知识。

### 1.3 非目标

本期明确不做：

- 通用文档中心
- 向量数据库平台化
- 复杂 chunk 管理
- 大规模知识运营体系
- 团队级复杂共享权限
- 文件解析流水线平台
- 知识审核流、发布流

---

## 2. 目标与收益

### 2.1 产品目标

- 让 Alkaid 在项目内更懂用户业务背景
- 让工作流生成结果更贴近项目规则
- 让排错建议能结合项目经验
- 让用户能在项目内维护少量高价值知识，而不是反复手写提示词

### 2.2 业务收益

- 降低用户重复描述成本
- 提升 Alkaid 生成工作流的命中率
- 提升工作流修改、诊断效率
- 提升项目复用能力和知识沉淀能力

---

## 3. 核心原则

### 3.1 轻量原则

只做“项目知识”，不做“知识平台”。

### 3.2 主线优先

模块设计必须服务于：

- 项目
- 工作流
- Alkaid 对话

而不是脱离主流程独立存在。

### 3.3 低心智负担

用户不需要理解：

- 检索增强生成
- 向量召回
- chunk
- embedding

用户只需要理解：

- 这是该项目的说明和经验
- 助手会用这些内容

### 3.4 可验证

用户必须能测试：

- 某条知识是否会被召回
- 某次对话用了哪些知识

---

## 4. 用户场景

### 4.1 项目规则沉淀

用户在某项目中记录：

- 字段口径
- 业务术语
- 输出格式要求
- 节点使用约定

Alkaid 在该项目内生成工作流时自动参考这些规则。

### 4.2 项目排错经验沉淀

用户记录：

- 某类站点容易失败的原因
- 某个节点的推荐参数
- 某条工作流常见问题

Alkaid 在项目内回答排错问题时优先参考这些内容。

### 4.3 工作流专属补充说明

用户为某个工作流补充：

- 输入要求
- 输出约定
- 特殊节点顺序
- 风险说明

在编辑该工作流或针对该工作流提问时，助手可带入更具体上下文。

---

## 5. 产品范围

## 5.1 MVP 必做

- 项目知识列表
- 新建知识
- 编辑知识
- 删除知识
- 启用 / 停用
- 项目内检索测试
- Alkaid 在项目场景自动使用项目知识
- 对话中展示“本次引用了哪些知识”

## 5.2 第二阶段可做

- 工作流级知识
- Markdown 预览
- URL 导入
- txt / md 文件导入
- 标签建议
- 排序 / 置顶

## 5.3 当前不做

- PDF / DOCX 深度解析
- 自动切片策略编辑
- 向量召回配置
- 知识共享市场
- 复杂协作权限

---

## 6. 信息架构与页面设计

### 6.1 推荐路由

推荐按“项目域”落地，而不是放进独立知识中心。

推荐新增：

- `/projects/:projectId/knowledge`

可选扩展：

- `/projects/:projectId/workflows/:workflowId/knowledge`

### 6.2 页面入口建议

#### 方案 A：项目页二级导航

在项目页增加：

- 工作流
- 项目知识

优点：

- 最贴近项目主线
- 用户能理解“这是该项目的知识”

#### 方案 B：助手页项目上下文入口

在 `/assistant` 或工作流编辑器中的 Alkaid 面板增加：

- 当前项目知识
- 检索测试

优点：

- 贴近助手使用场景

建议：

- **MVP 采用 A**
- **第二阶段补 B**

### 6.3 页面模块

#### 页面 1：项目知识列表页

模块包含：

- 顶部项目信息
- 概览卡片
- 条目列表
- 筛选栏
- 新建按钮
- 检索测试按钮

#### 页面 2：知识编辑抽屉 / 弹窗

字段包含：

- 标题
- 分类
- target
- 标签
- 正文
- 启用状态

#### 页面 3：检索测试弹窗

能力包含：

- 输入测试 query
- 返回召回条目
- 展示标题、分类、摘要、匹配范围

#### 页面 4：助手引用展示

在 Alkaid 回复中展示：

- 本次引用知识数
- 引用的知识标题
- 来源范围（系统 / 项目 / 工作流）

---

## 7. 功能需求

### 7.1 项目知识管理

- 用户可以查看某项目下全部知识条目
- 用户可以按关键词、分类、启停状态筛选
- 用户可以创建项目知识条目
- 用户可以编辑项目知识条目
- 用户可以删除项目知识条目
- 用户可以启用 / 停用项目知识条目

### 7.2 知识条目结构

MVP 字段建议：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 主键 |
| `user_id` | number | 是 | 所属用户 |
| `project_id` | number | 是 | 所属项目 |
| `workflow_id` | number \| null | 否 | 若为空表示项目级；若有值表示工作流级 |
| `category` | string | 是 | `best_practice` / `error_repair` / `scene_template` / `business_rule` |
| `target` | string | 否 | 关联对象，如 `crawler`、`ai`、`output` |
| `title` | string | 是 | 标题 |
| `content` | text | 是 | 正文 |
| `tags` | string[] | 否 | 标签 |
| `is_active` | boolean | 是 | 是否启用 |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |

### 7.3 检索测试

- 用户可以在项目下输入一句自然语言测试召回
- 系统返回召回到的条目列表
- 用户可以据此优化标题、标签、内容

### 7.4 Alkaid 集成

在这些场景下，项目知识要参与上下文构建：

- 项目页中打开 Alkaid
- 工作流编辑器中打开 Alkaid
- 项目相关对话或诊断请求

### 7.5 引用可见性

MVP 里助手回复后应显示：

- 使用了多少条知识
- 每条知识的标题
- 来源类型

这样用户才能感知功能生效。

---

## 8. 技术方案

### 8.1 总体策略

推荐采用：

- **复用现有 `alkaid_knowledge` 体系**
- **扩展字段做项目级过滤**
- **继续使用 SQL 级检索**
- **不引入向量数据库**

这是当前阶段最符合成本收益比的方案。

### 8.2 推荐数据设计

#### 方案：扩展现有 `alkaid_knowledge`

当前表已有：

- `user_id`
- `category`
- `target`
- `title`
- `content`
- `tags`
- `is_active`

推荐新增：

| 字段 | 类型 | 说明 |
|------|------|------|
| `project_id` | bigint null | 项目级知识归属 |
| `workflow_id` | bigint null | 工作流级知识归属 |
| `source_type` | varchar(20) | `manual` / `imported` / `url` |

语义约定：

- 系统知识：`user_id is null and project_id is null and workflow_id is null`
- 项目知识：`user_id = 当前用户 and project_id = 指定项目 and workflow_id is null`
- 工作流知识：`user_id = 当前用户 and project_id = 指定项目 and workflow_id = 指定工作流`

### 8.3 为什么推荐复用而不是新建独立知识表

优点：

- 复用现有检索服务
- 复用现有 Alkaid 知识注入链路
- 复用现有管理端知识概念
- 避免出现两套知识模型

缺点：

- 需要给现有知识模块补项目 / 工作流维度过滤

综合判断：

- 当前阶段收益远大于成本

### 8.4 检索策略

在项目 / 工作流场景下，推荐按如下顺序召回：

1. 工作流级知识
2. 项目级知识
3. 系统知识

并在每一层内部优先：

1. `target` 命中
2. 标题 / 标签命中
3. 正文命中
4. 通用最佳实践兜底

MVP 不做：

- 向量召回
- 多路融合排序
- 相似度阈值配置

### 8.5 Alkaid 上下文注入策略

在现有 `context.currentWorkflow` 基础上，新增：

- `context.projectId`
- `context.workflowId`

后端构建 prompt 时：

- 先取当前项目 / 工作流知识
- 再取系统知识
- 进行裁剪后注入 prompt

建议注入结构：

```ts
{
  projectId: 123,
  workflowId: 456,
  currentWorkflow: {...}
}
```

---

## 9. 后端实施方案

### 9.1 数据库改动

对 `alkaid_knowledge` 增加字段：

- `project_id`
- `workflow_id`
- `source_type`

增加索引：

- `(user_id, project_id, workflow_id, is_active)`
- `(project_id, is_active)`
- `(workflow_id, is_active)`
- `category`
- `target`

### 9.2 服务层改动

需要新增或改造：

- `ListProjectKnowledge(userID, projectID, filters)`
- `GetProjectKnowledgeDetail(userID, projectID, id)`
- `CreateProjectKnowledge(userID, projectID, payload)`
- `UpdateProjectKnowledge(userID, projectID, id, payload)`
- `DeleteProjectKnowledge(userID, projectID, id)`
- `SetProjectKnowledgeStatus(userID, projectID, id, isActive)`
- `SearchProjectKnowledge(userID, projectID, query, workflowID?)`

### 9.3 检索器改造

改造 `KnowledgeRetriever`：

- 新增项目 / 工作流过滤参数
- 支持按上下文召回多层知识

建议接口：

```go
RetrieveRelevantKnowledge(userMessage string, userID uint, projectID *uint, workflowID *uint, maxResults int)
```

### 9.4 API 设计

推荐使用项目域路由：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/projects/:projectId/knowledge` | GET | 列表 |
| `/api/projects/:projectId/knowledge` | POST | 新建 |
| `/api/projects/:projectId/knowledge/:id` | GET | 详情 |
| `/api/projects/:projectId/knowledge/:id` | PUT | 更新 |
| `/api/projects/:projectId/knowledge/:id` | DELETE | 删除 |
| `/api/projects/:projectId/knowledge/:id/status` | PATCH | 启停 |
| `/api/projects/:projectId/knowledge/search-test` | POST | 检索测试 |

可选二期：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/projects/:projectId/workflows/:workflowId/knowledge` | GET/POST | 工作流级知识 |

### 9.5 权限控制

项目知识必须满足：

- 只能由项目所属用户访问
- 不允许跨用户读取和编辑
- 工作流级知识必须校验 `workflow.project_id == projectId`

---

## 10. 前端实施方案

### 10.1 推荐落点

基于现有路由结构，建议新增：

- `/projects/:projectId/knowledge`

这是最贴当前产品心智的入口。

### 10.2 前端页面改动

需要新增：

- `pages/ProjectKnowledge/index.tsx`
- `api/projectKnowledge.ts`
- `types/projectKnowledge.ts`

### 10.3 页面功能

#### 列表页

- 概览卡片
- 条目列表
- 分类筛选
- 状态筛选
- 搜索框
- 新建按钮
- 检索测试按钮

#### 编辑抽屉

- 标题
- 分类
- target
- 标签
- 内容
- 启用状态

#### 检索测试弹窗

- query 输入
- 召回结果列表

### 10.4 与项目页的衔接

当前项目页是：

- `/projects/:projectId/workflows`

建议把项目页头部升级成二级导航：

- 工作流
- 项目知识

这样用户能自然切换。

### 10.5 与 Alkaid 的衔接

当前 `AlkaidAssistant` / `AlkaidPanel` 已支持：

- `workflowId`
- `getCurrentWorkflow`
- `context.currentWorkflow`

推荐补充：

- `projectId?: string | number`

并在这些地方传入：

- 项目页中的 Alkaid
- 工作流编辑器中的 Alkaid
- `/assistant?projectId=xxx&workflowId=yyy` 场景

### 10.6 回复引用展示

建议在消息卡片下方增加：

- `已引用知识 2 条`
- `项目知识：商品字段规则`
- `系统知识：AI 节点最佳实践`

MVP 可以只展示标题，不需要复杂展开。

---

## 11. 功能边界建议

### 11.1 当前推荐分类

推荐仅保留 4 类：

- `business_rule` 业务规则
- `best_practice` 最佳实践
- `error_repair` 排错经验
- `scene_template` 场景模板

说明：

- `node_usage` 更适合系统知识
- 项目知识更适合业务侧内容

### 11.2 target 建议

MVP 的 `target` 保持简单字符串即可：

- `crawler`
- `ai`
- `dataclean`
- `output`
- `workflow`

不需要一开始就做强约束枚举。

### 11.3 内容录入方式

MVP 只支持：

- 纯文本
- Markdown 文本

不做复杂文件解析。

---

## 12. 分阶段实施清单

## Phase 1：最小可用版

- [ ] 为 `alkaid_knowledge` 增加 `project_id`
- [ ] 为 `alkaid_knowledge` 增加 `workflow_id`
- [ ] 为 `alkaid_knowledge` 增加 `source_type`
- [ ] 新增项目知识 CRUD API
- [ ] 新增项目知识检索测试 API
- [ ] 前端新增 `/projects/:projectId/knowledge`
- [ ] 完成列表、创建、编辑、删除、启停
- [ ] Alkaid 在项目场景自动加载项目知识
- [ ] 对话中展示引用知识标题

## Phase 2：增强版

- [ ] 增加工作流级知识
- [ ] 项目页增加二级导航
- [ ] 检索测试显示命中来源层级
- [ ] Markdown 预览
- [ ] URL 导入
- [ ] txt / md 导入

## Phase 3：可选优化

- [ ] 标签建议
- [ ] 标题 / 内容质量提示
- [ ] 命中统计
- [ ] 最近使用知识
- [ ] 工作流知识快捷生成

---

## 13. 技术难度评估

### 13.1 整体判断

若收敛为“项目知识 / 助手上下文”，难度属于：

- **中等偏低到中等**

### 13.2 主要工作量分布

| 模块 | 难度 | 说明 |
|------|------|------|
| 数据表扩展 | 低 | 在现有知识模型上加项目维度 |
| CRUD API | 低 | 常规接口开发 |
| 项目前端页面 | 中 | 新页面、新列表、新抽屉 |
| 检索测试 | 中 | 需要打通现有检索链路 |
| Alkaid 集成 | 中 | 需要补上下文注入和引用展示 |
| 文件导入 | 中到高 | 若加入会显著增大范围 |

### 13.3 工期建议

按 1 人开发估算：

- Phase 1：3 到 5 天
- Phase 2：4 到 7 天

前提：

- 不做复杂文件解析
- 不做向量库
- 不做共享权限

---

## 14. 验收标准

### 14.1 功能验收

- 用户可以在项目内创建、编辑、删除知识
- 用户可以筛选和查看项目知识
- 用户可以启用 / 停用知识
- 用户可以测试某个 query 的召回结果
- 在项目或工作流场景使用 Alkaid 时，项目知识能参与生成
- 助手回复能展示引用过的知识标题

### 14.2 体验验收

- 用户不需要理解 RAG 概念
- 用户能知道知识是“这个项目的”
- 用户能知道“助手确实用了这些知识”

### 14.3 约束验收

- 不新增独立知识平台
- 不脱离项目主线
- 不引入复杂基础设施

---

## 15. 最终结论

建议方向不是“做用户知识库平台”，而是：

> 在现有 Alkaid 与低代码工作流体系上，增加一个轻量的“项目知识 / 助手上下文”模块。

这是一个：

- 足够轻
- 足够有价值
- 与产品主线一致
- 可在当前代码结构上快速落地

的方案。

