# RBAC 实施指引

> 这份文档配套 [RBAC-PRD.md](e:\Lichenxi\YaoLight_Workshop\docs\RBAC-PRD.md) 使用，重点解决“现在代码里真实有哪些路由、哪些接口、RBAC 应该怎么接”。

---

## 1. 当前代码现状

### 1.1 前端真实路由

当前管理端真实路由入口在：

- [index.tsx](e:\Lichenxi\YaoLight_Workshop\Admin_Frontend\src\routes\index.tsx)
- [menu.tsx](e:\Lichenxi\YaoLight_Workshop\Admin_Frontend\src\constants\menu.tsx)

已经存在的后台页面包括：

- `/`
- `/users`
- `/permissions`
- `/workflow-templates`
- `/workflow-templates/:id/canvas`
- `/node-types`
- `/knowledge-base`
- `/crawler-rules`
- `/ai-models`
- `/ai-models/providers`
- `/ai-models/providers/:provider`
- `/ai-models/models`
- `/ai-models/models/new`
- `/ai-models/models/:id`
- `/ai-models/models/:id/capability`
- `/ai-models/models/:id/pricing`
- `/ai-models/pricing-rules`
- `/ai-models/usage`
- `/tasks`
- `/tasks/running`
- `/tasks/failures`
- `/tasks/:id`
- `/tasks/:id/nodes`
- `/tasks/:id/logs`
- `/billing`
- `/billing/quota-recovery`
- `/billing/admin-grant`
- `/billing/orders`
- `/billing/ledger`
- `/billing/token-ledger`
- `/system-configs`
- `/notifications/send`
- `/notifications/jobs`
- `/notifications/log`
- `/notifications/analytics`
- `/notifications/templates`
- `/operation-logs`

### 1.2 后端真实接口分组

当前后台真实接口入口在：

- [main.go](e:\Lichenxi\YaoLight_Workshop\Low_code_Backend\cmd\server\main.go)

已经存在的 `/api/admin/*` 业务分组包括：

- `/admin/users`
- `/admin/workflow-templates`
- `/admin/node-types`
- `/admin/alkaid/knowledge`
- `/admin/crawler-rules`
- `/admin/ai-models`
- `/admin/tasks`
- `/admin/billing`
- `/admin/notifications`
- `/admin/operation-logs`

当前没有真实后台接口，但前端已有页面：

- `dashboard`
- `permissions`
- `system_configs`

这意味着 RBAC 第一版应先把这些页面纳入菜单和路由权限控制，后端接口权限后补。

---

## 2. 资源建模建议

推荐资源表按“叶子页面优先”建模，父级菜单只做分组，不单独产生接口权限。

### 2.1 推荐 resource_key

```text
dashboard
permissions
users
workflow_templates
workflow_templates.canvas
node_types
knowledge_base
crawler_rules
ai_models.overview
ai_models.providers
ai_models.models
ai_models.pricing_rules
ai_models.usage
tasks.overview
tasks.running
tasks.failures
tasks.detail
billing.overview
billing.quota_recovery
billing.admin_grant
billing.orders
billing.ledger
billing.token_ledger
system_configs
notifications.send
notifications.jobs
notifications.log
notifications.analytics
notifications.templates
operation_logs
```

### 2.2 为什么不直接用旧文档那套

旧文档的问题主要有三类：

1. 漏了真实存在的资源
   例如 `knowledge_base`、`workflow_templates.canvas`、`tasks.detail`

2. 把父级分组当成了真正资源
   例如 `tasks`、`notifications`

3. 没覆盖动态路由
   例如 `/ai-models/models/:id/pricing`、`/tasks/:id/logs`

---

## 3. 后端实现步骤

### 3.1 新建 `modules/rbac`

建议目录：

```text
Low_code_Backend/modules/rbac/
├── models/
├── repositories/
├── services/
├── middleware/
└── controllers/
```

建议模型：

- `Role`
- `Permission`
- `RolePermission`
- `UserRole`

### 3.2 数据库接入

在数据库初始化处加入 RBAC model 的 `AutoMigrate`。

### 3.3 预置权限

按当前真实资源生成：

- `resource:view`
- `resource:edit`

例如：

- `users:view`
- `users:edit`
- `notifications.templates:view`
- `notifications.templates:edit`

### 3.4 用户权限计算

推荐服务层暴露：

- `GetUserPermissions(userID uint) ([]string, error)`
- `HasPermission(userID uint, permission string) (bool, error)`

### 3.5 权限中间件

保留现有管理员中间件作为第一层：

```go
AdminOnlyMiddleware()
```

新增第二层：

```go
RequirePermission("billing.orders:view")
```

组合方式：

```go
adminBilling.GET("/orders",
  middleware.AdminOnlyMiddleware(),
  rbacMiddleware.RequirePermission("billing.orders:view"),
  controller.ListOrders,
)
```

如果不想在每条路由上都重复写，可以在每个 admin group 内按读写接口集中挂载。

### 3.6 当前推荐优先接入的后端模块

建议顺序：

1. `users`
2. `billing`
3. `ai_models`
4. `workflow_templates`
5. `tasks`
6. `notifications`
7. `node_types`
8. `crawler_rules`
9. `knowledge_base`
10. `operation_logs`

`dashboard`、`permissions`、`system_configs` 暂时只有前端路由控制，无需接口权限中间件。

---

## 4. 前端实现步骤

### 4.1 扩展管理员会话数据

在管理员登录态里增加：

```ts
type AdminUser = {
  id: number;
  role: string;
  permissions: string[];
};
```

并确保以下两个接口都返回 `permissions`：

- 登录接口
- `/api/users/current`

### 4.2 菜单权限元数据

当前菜单定义在：

- [menu.tsx](e:\Lichenxi\YaoLight_Workshop\Admin_Frontend\src\constants\menu.tsx)

建议给每项加 `permissionKey`：

```ts
{
  key: 'users',
  path: '/users',
  label: 'menu.users',
  permissionKey: 'users',
}
```

父级分组可以不加，或只作为兜底：

- `ai-models`
- `tasks`
- `billing`
- `notifications`

它们最终是否显示，应由子项过滤结果决定。

### 4.3 菜单过滤

建议封装：

```ts
function hasView(userPermissions: string[], resource: string) {
  return userPermissions.includes(`${resource}:view`);
}
```

递归过滤菜单：

- 子项全无时，父级分组不展示
- 叶子节点无 `view` 时，不展示

### 4.4 路由守卫

建议在 `AdminLayout` 外层或 `Outlet` 前统一做 pathname 映射。

重点不是静态 map，而是**正则匹配动态路由**。

示例：

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

### 4.5 页面内 `edit` 控制

封装：

```ts
function usePermission(resource: string) {
  const permissions = useAdminPermissions();
  return {
    canView: permissions.includes(`${resource}:view`),
    canEdit: permissions.includes(`${resource}:edit`),
  };
}
```

页面中使用：

- 无 `edit` 时隐藏新建、保存、删除、启停、发送按钮
- 表单字段只读
- 任务详情页中的 `取消`、`重试` 也算 `edit`

---

## 5. 当前真实接口与权限绑定建议

### 5.1 用户管理

- `GET /api/admin/users/summary` -> `users:view`
- `GET /api/admin/users` -> `users:view`
- `GET /api/admin/users/:id` -> `users:view`
- `PUT /api/admin/users/:id/status` -> `users:edit`
- `POST /api/admin/users/:id/reset-password` -> `users:edit`

### 5.2 工作流模板

- `GET /api/admin/workflow-templates/summary` -> `workflow_templates:view`
- `GET /api/admin/workflow-templates` -> `workflow_templates:view`
- `GET /api/admin/workflow-templates/source-workflows` -> `workflow_templates:view`
- `GET /api/admin/workflow-templates/:id` -> `workflow_templates:view`
- `POST /api/admin/workflow-templates` -> `workflow_templates:edit`
- `PUT /api/admin/workflow-templates/:id` -> `workflow_templates:edit`
- `DELETE /api/admin/workflow-templates/:id` -> `workflow_templates:edit`
- `GET /api/admin/workflow-templates/:id/canvas` -> `workflow_templates.canvas:view`
- `PUT /api/admin/workflow-templates/:id/canvas` -> `workflow_templates.canvas:edit`
- `POST /api/admin/workflow-templates/:id/sync` -> `workflow_templates.canvas:edit`

### 5.3 节点类型

- `GET /api/admin/node-types/summary` -> `node_types:view`
- `GET /api/admin/node-types` -> `node_types:view`
- `GET /api/admin/node-types/:id` -> `node_types:view`
- `POST /api/admin/node-types` -> `node_types:edit`
- `PUT /api/admin/node-types/:id` -> `node_types:edit`
- `PATCH /api/admin/node-types/:id/status` -> `node_types:edit`
- `DELETE /api/admin/node-types/:id` -> `node_types:edit`

### 5.4 知识库

- `GET /api/admin/alkaid/knowledge/summary` -> `knowledge_base:view`
- `GET /api/admin/alkaid/knowledge` -> `knowledge_base:view`
- `GET /api/admin/alkaid/knowledge/:id` -> `knowledge_base:view`
- `POST /api/admin/alkaid/knowledge` -> `knowledge_base:edit`
- `PUT /api/admin/alkaid/knowledge/:id` -> `knowledge_base:edit`
- `DELETE /api/admin/alkaid/knowledge/:id` -> `knowledge_base:edit`
- `PATCH /api/admin/alkaid/knowledge/:id/status` -> `knowledge_base:edit`
- `POST /api/admin/alkaid/knowledge/search-test` -> `knowledge_base:edit`

### 5.5 爬虫规则

- `GET /api/admin/crawler-rules` -> `crawler_rules:view`
- `GET /api/admin/crawler-rules/:id` -> `crawler_rules:view`
- `GET /api/admin/crawler-rules/:id/usages` -> `crawler_rules:view`
- `POST /api/admin/crawler-rules` -> `crawler_rules:edit`
- `PUT /api/admin/crawler-rules/:id` -> `crawler_rules:edit`
- `DELETE /api/admin/crawler-rules/:id` -> `crawler_rules:edit`
- `PATCH /api/admin/crawler-rules/:id/status` -> `crawler_rules:edit`
- `POST /api/admin/crawler-rules/test` -> `crawler_rules:edit`
- `POST /api/admin/crawler-rules/:id/clone` -> `crawler_rules:edit`

### 5.6 AI 模型

- `GET /api/admin/ai-models` -> `ai_models.overview:view`
- `GET /api/admin/ai-models/providers` -> `ai_models.providers:view`
- `GET /api/admin/ai-models/providers/:provider` -> `ai_models.providers:view`
- `GET /api/admin/ai-models/models` -> `ai_models.models:view`
- `GET /api/admin/ai-models/models/:id` -> `ai_models.models:view`
- `POST /api/admin/ai-models/models` -> `ai_models.models:edit`
- `PUT /api/admin/ai-models/models/:id` -> `ai_models.models:edit`
- `DELETE /api/admin/ai-models/models/:id` -> `ai_models.models:edit`
- `GET /api/admin/ai-models/models/:id/capability` -> `ai_models.models:view`
- `PUT /api/admin/ai-models/models/:id/capability` -> `ai_models.models:edit`
- `GET /api/admin/ai-models/models/:id/pricing` -> `ai_models.models:view`
- `PUT /api/admin/ai-models/models/:id/pricing` -> `ai_models.models:edit`
- `GET /api/admin/ai-models/pricing-rules` -> `ai_models.pricing_rules:view`
- `GET /api/admin/ai-models/usage` -> `ai_models.usage:view`

### 5.7 任务监控

- `GET /api/admin/tasks/summary` -> `tasks.overview:view`
- `GET /api/admin/tasks` -> `tasks.overview:view`
- `GET /api/admin/tasks/running` -> `tasks.running:view`
- `GET /api/admin/tasks/failures` -> `tasks.failures:view`
- `GET /api/admin/tasks/failure-stats` -> `tasks.failures:view`
- `GET /api/admin/tasks/:id` -> `tasks.detail:view`
- `GET /api/admin/tasks/:id/artifacts` -> `tasks.detail:view`
- `GET /api/admin/tasks/:id/node-executions` -> `tasks.detail:view`
- `GET /api/admin/tasks/:id/logs` -> `tasks.detail:view`
- `GET /api/admin/tasks/artifacts/:artifactId/download` -> `tasks.detail:view`
- `POST /api/admin/tasks/:id/cancel` -> `tasks.detail:edit`
- `POST /api/admin/tasks/:id/retry` -> `tasks.detail:edit`

### 5.8 计费运营

- `GET /api/admin/billing/quotas/summary` -> `billing.overview:view`
- `POST /api/admin/billing/quotas/recover` -> `billing.quota_recovery:edit`
- `POST /api/admin/billing/quotas/grant` -> `billing.admin_grant:edit`
- `GET /api/admin/billing/quotas/ledger` -> `billing.ledger:view`
- `GET /api/admin/billing/orders` -> `billing.orders:view`
- `GET /api/admin/billing/token-transactions` -> `billing.token_ledger:view`

### 5.9 通知中心

- `GET /api/admin/notifications/summary` -> `notifications.send:view`
- `GET /api/admin/notifications` -> `notifications.log:view`
- `GET /api/admin/notifications/jobs` -> `notifications.jobs:view`
- `GET /api/admin/notifications/jobs/:id/deliveries` -> `notifications.jobs:view`
- `GET /api/admin/notifications/analytics` -> `notifications.analytics:view`
- `GET /api/admin/notifications/templates` -> `notifications.templates:view`
- `POST /api/admin/notifications/templates` -> `notifications.templates:edit`
- `PUT /api/admin/notifications/templates/:id` -> `notifications.templates:edit`
- `POST /api/admin/notifications/send` -> `notifications.send:edit`

### 5.10 操作日志

- `GET /api/admin/operation-logs` -> `operation_logs:view`
- `GET /api/admin/operation-logs/:id` -> `operation_logs:view`

---

## 6. 开发顺序建议

### Phase 1

- 建表与种子数据
- 登录 / 当前用户返回 permissions
- 菜单过滤
- 路由守卫
- 用户、计费、AI 模型权限

### Phase 2

- 工作流模板、任务、通知、节点类型、爬虫规则、知识库权限
- 细化动态路由守卫
- 页面只读态收口

### Phase 3

- 权限管理页本身接真实接口
- 超级管理员角色管理
- 权限变更后的实时刷新策略

---

## 7. 当前适合直接开工的结论

现在已经适合做 RBAC，不需要等仪表盘或系统配置模块先完善。

原因很直接：

- 大多数后台模块已经有真实页面和真实 `/api/admin/*` 接口
- 权限资源边界已经足够明确
- 旧文档里最大的问题不是“不能做”，而是“资源映射过时”

这版文档更新后，RBAC 已经可以按当前代码状态直接落地。

