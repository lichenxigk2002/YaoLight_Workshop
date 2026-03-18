# 管理后台 RBAC 权限系统 PRD

| 项目 | 说明 |
|------|------|
| 产品名称 | 瑶光管理后台 RBAC |
| 文档版本 | 2.0 |
| 适用范围 | `Admin_Frontend`、`Low_code_Backend` |
| 更新时间 | 2026-03-13 |

---

## 1. 背景与目标

当前后台仍以 `users.role = 'admin'` 作为唯一管理身份判断，所有管理员默认拥有相同权限。随着用户、任务、计费、通知、AI 模型、工作流模板等模块逐步落地，继续使用“是否管理员”这一层判断已经不够。

本期目标是建立一套可落地的 RBAC 方案，用于解决：

- 管理员分等级
- 菜单按权限展示
- 路由按权限拦截
- 页面按权限只读 / 可编辑
- `/api/admin/*` 接口按权限二次鉴权

## 2. 已确认原则

| 项目 | 结论 |
|------|------|
| 管理员存储 | 不单独建管理员表，仍然复用 `users` 表，`role = 'admin'` 表示可进入后台 |
| RBAC 模块位置 | 新建独立 `modules/rbac`，不要把角色权限逻辑塞进 `user` 模块 |
| 鉴权顺序 | 先 `AdminOnlyMiddleware()` 判定是否管理员，再判定是否拥有具体 permission |
| 权限动作 | 本期统一只保留 `view`、`edit` 两种动作 |
| 权限粒度 | 以“页面资源”为主，接口权限映射到页面资源 |
| 前端行为 | 无 `view` 不展示菜单且不可访问路由；有 `view` 无 `edit` 则页面只读 |
| 后端行为 | 前端隐藏按钮不是安全边界，后端仍必须返回 403 |

## 3. 名词定义

| 名词 | 定义 |
|------|------|
| 管理员 | `users.role = 'admin'` 的用户 |
| 角色 | 一组权限的集合，如 `super_admin`、`billing_operator` |
| 权限 | `resource_key:action`，如 `billing.orders:view` |
| 资源 | 后台菜单、页面或子页面，对应一个 `resource_key` |

## 4. 范围说明

### 4.1 本期必须覆盖

本期权限文档以**当前代码里真实存在的后台页面与 `/admin/*` 接口**为准。

已落地页面或模块：

- 仪表盘
- 用户管理
- 权限管理（当前为占位页）
- 工作流模板
- 节点类型
- 知识库
- 爬虫规则
- AI 模型
- 任务监控
- 计费运营
- 系统配置（当前为占位页）
- 通知中心
- 操作日志

### 4.2 当前没有真实后台接口的模块

以下页面已经有前端路由，但当前后端没有对应 `/api/admin/*` 业务接口：

- `dashboard`
- `permissions`
- `system_configs`

这三个资源本期仍要纳入 RBAC 建模，用于菜单和路由控制，但接口权限映射可以后补。

## 5. 权限模型

### 5.1 权限格式

统一采用：

```text
resource_key:action
```

示例：

- `users:view`
- `users:edit`
- `billing.orders:view`
- `notifications.templates:edit`

### 5.2 动作语义

- `view`：允许看到菜单、进入页面、调用只读接口
- `edit`：允许执行新增、编辑、删除、发布、启停、重试、发送、保存等写操作

## 6. 资源与真实路由映射

以下资源清单已按当前 `Admin_Frontend/src/routes/index.tsx`、各模块 `routes.tsx` 和 `Admin_Frontend/src/constants/menu.tsx` 对齐。

说明：

- 父级分组资源仅用于菜单组织，一般不单独绑定接口权限
- 叶子资源用于生成 `view/edit` 权限
- 动态详情路由必须归并到已有资源，不允许绕过前端路由守卫

| 资源 key | 前端路径（相对 `/admin`） | 说明 |
|----------|---------------------------|------|
| `dashboard` | `/` | 仪表盘 |
| `permissions` | `/permissions` | 权限管理页 |
| `users` | `/users` | 用户管理 |
| `workflow_templates` | `/workflow-templates` | 模板列表页 |
| `workflow_templates.canvas` | `/workflow-templates/:id/canvas` | 模板编排页 |
| `node_types` | `/node-types` | 节点类型 |
| `knowledge_base` | `/knowledge-base` | 知识库 |
| `crawler_rules` | `/crawler-rules` | 爬虫规则 |
| `ai_models` | `/ai-models` | AI 模型父级分组，仅菜单组织 |
| `ai_models.overview` | `/ai-models` | AI 模型概览 |
| `ai_models.providers` | `/ai-models/providers`、`/ai-models/providers/:provider` | 服务商列表与详情 |
| `ai_models.models` | `/ai-models/models`、`/ai-models/models/new`、`/ai-models/models/:id`、`/ai-models/models/:id/capability`、`/ai-models/models/:id/pricing` | 模型列表、创建、详情、能力、计费 |
| `ai_models.pricing_rules` | `/ai-models/pricing-rules` | 计费规则 |
| `ai_models.usage` | `/ai-models/usage` | 使用统计 |
| `tasks` | `/tasks` | 任务监控父级分组，仅菜单组织 |
| `tasks.overview` | `/tasks` | 任务概览 |
| `tasks.running` | `/tasks/running` | 运行中任务 |
| `tasks.failures` | `/tasks/failures` | 失败任务 |
| `tasks.detail` | `/tasks/:id`、`/tasks/:id/nodes`、`/tasks/:id/logs` | 任务详情、节点执行、日志 |
| `billing` | `/billing` | 计费运营父级分组，仅菜单组织 |
| `billing.overview` | `/billing` | 计费概览 |
| `billing.quota_recovery` | `/billing/quota-recovery` | 补救配额 |
| `billing.admin_grant` | `/billing/admin-grant` | 管理员赠送 |
| `billing.orders` | `/billing/orders` | 订单列表 |
| `billing.ledger` | `/billing/ledger` | 配额流水 |
| `billing.token_ledger` | `/billing/token-ledger` | Token 流水 |
| `system_configs` | `/system-configs` | 系统配置 |
| `notifications` | `/notifications` | 通知中心父级分组，仅菜单组织 |
| `notifications.send` | `/notifications/send` | 发送通知 |
| `notifications.jobs` | `/notifications/jobs` | 发送任务 |
| `notifications.log` | `/notifications/log` | 通知明细 |
| `notifications.analytics` | `/notifications/analytics` | 统计分析 |
| `notifications.templates` | `/notifications/templates` | 模板管理 |
| `operation_logs` | `/operation-logs` | 操作日志 |

## 7. 数据模型

### 7.1 用户与角色关系

两种方案都可行，推荐多角色：

- 单角色：`users.admin_role_id`
- 多角色：`user_roles(user_id, role_id)`

推荐原因：

- 便于后续叠加“基础后台权限 + 某个业务条线权限”
- 超级管理员之外的岗位更灵活

### 7.2 RBAC 模块表

- `roles`
- `permissions`
- `role_permissions`
- `user_roles`

建议字段：

- `roles`: `id`, `code`, `name`, `description`, `created_at`, `updated_at`
- `permissions`: `id`, `resource_key`, `action`, `description`, `created_at`
- `role_permissions`: `role_id`, `permission_id`
- `user_roles`: `user_id`, `role_id`

## 8. 前端需求

### 8.1 权限来源

- 登录成功后，返回当前管理员的 `permissions`
- `GET /api/users/current` 也必须返回最新 `permissions`
- 刷新页面时以前者为缓存，以后者为权威结果

### 8.2 菜单控制

- 无 `view` 权限时，菜单项不展示
- 父级分组菜单按子项过滤结果决定是否展示
- `ai_models`、`tasks`、`billing`、`notifications` 这类父级分组不需要单独 permission

### 8.3 路由控制

前端守卫必须覆盖：

- 静态路由
- 动态详情路由
- 别名路由
- 非菜单页但可直达页

重点包括：

- `/workflow-templates/:id/canvas`
- `/ai-models/providers/:provider`
- `/ai-models/models/new`
- `/ai-models/models/:id`
- `/ai-models/models/:id/capability`
- `/ai-models/models/:id/pricing`
- `/tasks/:id`
- `/tasks/:id/nodes`
- `/tasks/:id/logs`

### 8.4 页面只读控制

有 `view` 无 `edit` 时：

- 页面仍可进入
- 列表、详情、统计可看
- 新建、保存、删除、启停、发送、重试、取消等操作必须隐藏或禁用

## 9. 后端需求

### 9.1 权限返回

以下接口都应返回 `permissions`：

- 登录接口
- 当前用户接口 `GET /api/users/current`

### 9.2 后端接口鉴权

所有 `/api/admin/*` 接口在通过管理员身份校验后，必须再做 permission 校验。

### 9.3 当前真实接口与建议权限映射

以下映射按当前 `Low_code_Backend/cmd/server/main.go` 的真实路由整理。

#### 用户管理

| 接口 | 权限 |
|------|------|
| `GET /api/admin/users/summary` | `users:view` |
| `GET /api/admin/users` | `users:view` |
| `GET /api/admin/users/:id` | `users:view` |
| `PUT /api/admin/users/:id/status` | `users:edit` |
| `POST /api/admin/users/:id/reset-password` | `users:edit` |

#### 工作流模板

| 接口 | 权限 |
|------|------|
| `GET /api/admin/workflow-templates/summary` | `workflow_templates:view` |
| `GET /api/admin/workflow-templates` | `workflow_templates:view` |
| `GET /api/admin/workflow-templates/source-workflows` | `workflow_templates:view` |
| `GET /api/admin/workflow-templates/:id` | `workflow_templates:view` |
| `POST /api/admin/workflow-templates` | `workflow_templates:edit` |
| `PUT /api/admin/workflow-templates/:id` | `workflow_templates:edit` |
| `DELETE /api/admin/workflow-templates/:id` | `workflow_templates:edit` |
| `GET /api/admin/workflow-templates/:id/canvas` | `workflow_templates.canvas:view` |
| `PUT /api/admin/workflow-templates/:id/canvas` | `workflow_templates.canvas:edit` |
| `POST /api/admin/workflow-templates/:id/sync` | `workflow_templates.canvas:edit` |

#### 节点类型

| 接口 | 权限 |
|------|------|
| `GET /api/admin/node-types/summary` | `node_types:view` |
| `GET /api/admin/node-types` | `node_types:view` |
| `GET /api/admin/node-types/:id` | `node_types:view` |
| `POST /api/admin/node-types` | `node_types:edit` |
| `PUT /api/admin/node-types/:id` | `node_types:edit` |
| `PATCH /api/admin/node-types/:id/status` | `node_types:edit` |
| `DELETE /api/admin/node-types/:id` | `node_types:edit` |

#### 知识库

| 接口 | 权限 |
|------|------|
| `GET /api/admin/alkaid/knowledge/summary` | `knowledge_base:view` |
| `GET /api/admin/alkaid/knowledge` | `knowledge_base:view` |
| `GET /api/admin/alkaid/knowledge/:id` | `knowledge_base:view` |
| `POST /api/admin/alkaid/knowledge` | `knowledge_base:edit` |
| `PUT /api/admin/alkaid/knowledge/:id` | `knowledge_base:edit` |
| `DELETE /api/admin/alkaid/knowledge/:id` | `knowledge_base:edit` |
| `PATCH /api/admin/alkaid/knowledge/:id/status` | `knowledge_base:edit` |
| `POST /api/admin/alkaid/knowledge/search-test` | `knowledge_base:edit` |

#### 爬虫规则

| 接口 | 权限 |
|------|------|
| `GET /api/admin/crawler-rules` | `crawler_rules:view` |
| `GET /api/admin/crawler-rules/:id` | `crawler_rules:view` |
| `GET /api/admin/crawler-rules/:id/usages` | `crawler_rules:view` |
| `POST /api/admin/crawler-rules` | `crawler_rules:edit` |
| `PUT /api/admin/crawler-rules/:id` | `crawler_rules:edit` |
| `DELETE /api/admin/crawler-rules/:id` | `crawler_rules:edit` |
| `PATCH /api/admin/crawler-rules/:id/status` | `crawler_rules:edit` |
| `POST /api/admin/crawler-rules/test` | `crawler_rules:edit` |
| `POST /api/admin/crawler-rules/:id/clone` | `crawler_rules:edit` |

#### AI 模型

| 接口 | 权限 |
|------|------|
| `GET /api/admin/ai-models` | `ai_models.overview:view` |
| `GET /api/admin/ai-models/providers` | `ai_models.providers:view` |
| `GET /api/admin/ai-models/providers/:provider` | `ai_models.providers:view` |
| `GET /api/admin/ai-models/models` | `ai_models.models:view` |
| `GET /api/admin/ai-models/models/:id` | `ai_models.models:view` |
| `POST /api/admin/ai-models/models` | `ai_models.models:edit` |
| `PUT /api/admin/ai-models/models/:id` | `ai_models.models:edit` |
| `DELETE /api/admin/ai-models/models/:id` | `ai_models.models:edit` |
| `GET /api/admin/ai-models/models/:id/capability` | `ai_models.models:view` |
| `PUT /api/admin/ai-models/models/:id/capability` | `ai_models.models:edit` |
| `GET /api/admin/ai-models/models/:id/pricing` | `ai_models.models:view` |
| `PUT /api/admin/ai-models/models/:id/pricing` | `ai_models.models:edit` |
| `GET /api/admin/ai-models/pricing-rules` | `ai_models.pricing_rules:view` |
| `GET /api/admin/ai-models/usage` | `ai_models.usage:view` |

#### 任务监控

| 接口 | 权限 |
|------|------|
| `GET /api/admin/tasks/summary` | `tasks.overview:view` |
| `GET /api/admin/tasks` | `tasks.overview:view` |
| `GET /api/admin/tasks/running` | `tasks.running:view` |
| `GET /api/admin/tasks/failures` | `tasks.failures:view` |
| `GET /api/admin/tasks/failure-stats` | `tasks.failures:view` |
| `GET /api/admin/tasks/:id` | `tasks.detail:view` |
| `GET /api/admin/tasks/:id/artifacts` | `tasks.detail:view` |
| `GET /api/admin/tasks/:id/node-executions` | `tasks.detail:view` |
| `GET /api/admin/tasks/:id/logs` | `tasks.detail:view` |
| `GET /api/admin/tasks/artifacts/:artifactId/download` | `tasks.detail:view` |
| `POST /api/admin/tasks/:id/cancel` | `tasks.detail:edit` |
| `POST /api/admin/tasks/:id/retry` | `tasks.detail:edit` |

#### 计费运营

| 接口 | 权限 |
|------|------|
| `GET /api/admin/billing/quotas/summary` | `billing.overview:view` |
| `POST /api/admin/billing/quotas/recover` | `billing.quota_recovery:edit` |
| `POST /api/admin/billing/quotas/grant` | `billing.admin_grant:edit` |
| `GET /api/admin/billing/quotas/ledger` | `billing.ledger:view` |
| `GET /api/admin/billing/orders` | `billing.orders:view` |
| `GET /api/admin/billing/token-transactions` | `billing.token_ledger:view` |

#### 通知中心

| 接口 | 权限 |
|------|------|
| `GET /api/admin/notifications/summary` | `notifications.send:view` |
| `GET /api/admin/notifications` | `notifications.log:view` |
| `GET /api/admin/notifications/jobs` | `notifications.jobs:view` |
| `GET /api/admin/notifications/jobs/:id/deliveries` | `notifications.jobs:view` |
| `GET /api/admin/notifications/analytics` | `notifications.analytics:view` |
| `GET /api/admin/notifications/templates` | `notifications.templates:view` |
| `POST /api/admin/notifications/templates` | `notifications.templates:edit` |
| `PUT /api/admin/notifications/templates/:id` | `notifications.templates:edit` |
| `POST /api/admin/notifications/send` | `notifications.send:edit` |

#### 操作日志

| 接口 | 权限 |
|------|------|
| `GET /api/admin/operation-logs` | `operation_logs:view` |
| `GET /api/admin/operation-logs/:id` | `operation_logs:view` |

## 10. 前端 pathname 映射要求

建议的核心映射如下：

```ts
const PATH_TO_RESOURCE: Array<[RegExp, string]> = [
  [/^\/$/, 'dashboard'],
  [/^\/permissions$/, 'permissions'],
  [/^\/users$/, 'users'],
  [/^\/workflow-templates$/, 'workflow_templates'],
  [/^\/workflow-templates\/\d+\/canvas$/, 'workflow_templates.canvas'],
  [/^\/node-types$/, 'node_types'],
  [/^\/knowledge-base$/, 'knowledge_base'],
  [/^\/crawler-rules$/, 'crawler_rules'],
  [/^\/ai-models$/, 'ai_models.overview'],
  [/^\/ai-models\/providers(?:\/[^/]+)?$/, 'ai_models.providers'],
  [/^\/ai-models\/models(?:\/new)?$/, 'ai_models.models'],
  [/^\/ai-models\/models\/\d+(?:\/capability|\/pricing)?$/, 'ai_models.models'],
  [/^\/ai-models\/pricing-rules$/, 'ai_models.pricing_rules'],
  [/^\/ai-models\/usage$/, 'ai_models.usage'],
  [/^\/tasks$/, 'tasks.overview'],
  [/^\/tasks\/running$/, 'tasks.running'],
  [/^\/tasks\/failures$/, 'tasks.failures'],
  [/^\/tasks\/\d+(?:\/nodes|\/logs)?$/, 'tasks.detail'],
  [/^\/billing$/, 'billing.overview'],
  [/^\/billing\/quota-recovery$/, 'billing.quota_recovery'],
  [/^\/billing\/admin-grant$/, 'billing.admin_grant'],
  [/^\/billing\/orders$/, 'billing.orders'],
  [/^\/billing\/ledger$/, 'billing.ledger'],
  [/^\/billing\/token-ledger$/, 'billing.token_ledger'],
  [/^\/system-configs$/, 'system_configs'],
  [/^\/notifications\/send$/, 'notifications.send'],
  [/^\/notifications\/jobs$/, 'notifications.jobs'],
  [/^\/notifications\/log$/, 'notifications.log'],
  [/^\/notifications\/analytics$/, 'notifications.analytics'],
  [/^\/notifications\/templates$/, 'notifications.templates'],
  [/^\/operation-logs$/, 'operation_logs'],
];
```

## 11. 实施建议顺序

1. 建 `modules/rbac` 与数据表
2. 预置当前资源清单对应的 `permissions`
3. 登录接口与 `/api/users/current` 返回 `permissions`
4. 前端菜单按 `view` 过滤
5. 前端路由按真实 pathname 映射拦截
6. 页面按钮和表单按 `edit` 控制
7. 后端 `/api/admin/*` 逐组挂载 `RequirePermission`
8. 最后再做权限管理页面本身

## 12. 验收标准

- 无 `view` 权限看不到菜单，也无法直接访问路由
- 有 `view` 无 `edit` 时只能查看，不能修改
- `/api/admin/*` 无权限时稳定返回 403
- 动态路由不会绕过权限守卫
- 当前真实模块都已纳入统一的 resource_key 体系

