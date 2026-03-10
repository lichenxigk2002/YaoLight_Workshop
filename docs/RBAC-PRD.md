# 管理员 RBAC 权限系统 — 产品需求文档（PRD）

| 项目 | 说明 |
|------|------|
| 产品名称 | 瑶光管理后台 · 基于角色的访问控制（RBAC） |
| 文档版本 | 1.1 |
| 适用系统 | Admin_Frontend（管理后台前端）、Low_code_Backend（Go 后端） |

---

## 1. 项目背景与目标

### 1.1 背景

当前管理后台仅区分「是否管理员」（`users.role = 'admin'`），所有管理员权限一致，无法按模块或操作做细粒度控制。需要引入 RBAC，实现管理员分等级、按模块/子模块分配「可查看」与「可编辑」权限。

### 1.2 目标

- **管理员分等级**：通过「角色」区分等级（如超级管理员、计费运营、只读审计等），不同等级拥有不同权限集合。
- **可分配权限**：为角色配置「模块 + 操作」权限；管理员通过绑定角色获得权限。
- **模块/子模块粒度**：可控制到具体子页面（如「计费运营 → 管理员赠送」）。
- **未分配权限**：无某资源「查看」权限时，不展示对应菜单与路由；无「编辑」权限时，对应页面仅只读（无新建/编辑/删除等操作）。
- **权限类型**：仅两种——**可查看（view）**、**可编辑（edit）**。无 view 则不可见；有 view 无 edit 则只读。

### 1.3 名词定义

| 名词 | 定义 |
|------|------|
| **管理员** | 使用管理后台的账号，即 `users` 表中 `role = 'admin'` 的用户；**不单独建管理员表**，与普通用户共用 `users` 表。 |
| **等级** | 管理员的权限级别，由其所绑定的 **RBAC 角色** 决定，即「等级 = 角色」。 |
| **角色（Role）** | 一组权限的集合，如「计费运营」「只读审计」。角色存储在 rbac 模块的 `roles` 表中。 |
| **权限（Permission）** | 对某个资源的某种操作，格式为 `资源key:操作`，如 `billing.admin_grant:view`、`billing.admin_grant:edit`。 |
| **资源（Resource）** | 管理后台的模块或子模块，与前端菜单/路由一一对应，用 `resource_key` 标识（见第 5 节）。 |

---

## 2. 约束与原则（已确定结论）

以下为前期讨论已确定的方案，开发需严格遵守。

| 约束项 | 结论 |
|--------|------|
| **管理员存储** | **不建管理员表**。管理员即 `users` 表中 `role = 'admin'` 的用户，共用同一张用户表。 |
| **等级如何表示** | 等级 = 该管理员绑定的 RBAC 角色。通过「用户 ↔ 角色」关联实现：单角色可在 `users` 表增加 `admin_role_id`；多角色则使用 `user_roles(user_id, role_id)` 表，权限取所有角色权限的并集。 |
| **后端模块划分** | **新建独立模块 `modules/rbac`**，与 `user`、`billing`、`ai` 等平级。角色、权限、角色-权限、用户-角色（若采用多角色）均归属 rbac 模块；**不**将 RBAC 表或逻辑放入 `user` 或 `infrastructure`。 |
| **鉴权顺序** | 先沿用现有「是否管理员」判断（如 `AdminOnlyMiddleware()`），再在需要细粒度的地方增加「是否具备某权限」的校验（如 `RequirePermission("billing.admin_grant:edit")`）。 |
| **本期范围** | **Phase 1 必做范围** 以当前已落地的管理后台能力为准：`ai_models.*` 与 `billing.*` 的后端接口鉴权、前端菜单/路由/编辑控制必须完成；`users`、`tasks`、`workflow_templates`、`node_types`、`crawler_rules`、`system_configs`、`notifications`、`operation_logs` 等资源本期先完成资源建模、菜单/路由权限预留，待对应后台接口实际接入后再补齐接口级权限校验。 |

---

## 3. 用户角色与使用场景

| 角色（示例） | 说明 | 典型能力 |
|--------------|------|----------|
| 超级管理员 | 拥有全部权限 | 所有模块 view + edit；可管理角色与权限分配（若实现管理页）。 |
| 计费运营 | 仅负责计费相关 | 计费运营下各子模块 view + edit（概览、补救配额、管理员赠送、订单、流水等）。 |
| 客服只读 | 仅查看用户与计费 | users、billing 相关 view，无 edit。 |
| 审计只读 | 仅查看操作日志等 | operation_logs 等 view，无 edit。 |

上述角色为示例，实际角色与权限以系统配置为准；超级管理员至少需预置且拥有全部权限。

---

## 4. 功能需求

### 4.1 管理员身份与等级

- **FR-1.1** 管理员登录方式与现有一致（使用 `users` 表账号，`role = 'admin'`），无需单独「管理员登录」表或接口。
- **FR-1.2** 系统支持为管理员绑定一个或多个 RBAC 角色（由采用的「单角色/多角色」方案决定）；未绑定任何角色时，视为无任何后台权限（仅能通过「是否 admin」进门，但无具体资源权限时可被前端/后端按无权限处理）。
- **FR-1.3** 管理员「等级」对外可理解为角色名称或角色描述（如「计费运营」），不要求单独「等级」字段。

### 4.2 权限模型

- **FR-2.1** 权限标识格式为：`资源key:操作`。操作仅两种：`view`（可查看）、`edit`（可编辑）。
- **FR-2.2** 资源与前端菜单/路由一一对应，资源 key 清单见 **第 5 节「资源与路由映射」**；前后端须统一使用同一套 resource_key。
- **FR-2.3** 角色通过「角色-权限」关联绑定若干权限；用户通过「用户-角色」关联获得角色，从而得到权限集合（多角色时取并集）。

### 4.3 前端行为（Admin_Frontend）

- **FR-3.1** 登录成功后，前端能拿到当前管理员的权限列表（如 `user.permissions: string[]`），并持久化到会话（与现有 session 一起）。
- **FR-3.1.a** 前端刷新页面或重新进入后台时，不仅依赖本地缓存；应通过「当前用户/管理员会话接口」重新拉取一次最新 `permissions`，用于修正本地陈旧权限。建议复用现有 `/api/users/current`，由后端在管理员场景下补充返回 `permissions`。
- **FR-3.2** **菜单**：仅当用户拥有某菜单对应资源的 `view` 权限时，该菜单项展示；无权限的菜单项不展示。若某父节点下所有子项均无权限，则父节点也不展示。
- **FR-3.3** **路由/页面**：用户直接访问某 URL 时，若其不具备该页面对应资源的 `view` 权限，则展示「无权限」页或重定向到指定页（如仪表盘或 403），且不渲染目标页面内容。
- **FR-3.3.a** 前端路由守卫不仅要覆盖静态路径，也要覆盖**动态详情路由与别名路由**，例如 `/ai-models/providers/:provider`、`/ai-models/models/new`、`/ai-models/models/:id`、`/ai-models/models/:id/capability`、`/ai-models/models/:id/pricing`；这些路径需归并到既有 resource_key 做权限判断，不得因路径未命中静态映射而绕过校验。
- **FR-3.4** **编辑类操作**：若用户仅有某资源的 `view` 权限而无 `edit` 权限，则该模块对应页面上不展示或禁用「新建」「编辑」「删除」「提交」等会修改数据的操作；表单以只读方式展示（仅查看不提交）。
- **FR-3.5** **无资源权限管理员的落点**：管理员登录成功但若不具备 `dashboard:view`，前端应按菜单顺序自动寻找其首个拥有 `view` 权限的页面并跳转；若一个可访问页面也没有，则展示独立「无任何后台权限」页，保留登录态，并提示联系超级管理员分配角色。
- **FR-3.6** **权限变更生效**：角色或权限被调整后，前端以下一次会话刷新结果为准；若当前页面请求返回 403，前端应重新拉取当前用户权限并更新菜单/路由状态，避免继续展示已失效操作入口。

### 4.4 后端行为（Low_code_Backend）

- **FR-4.1** 登录接口（或管理员会话接口）在返回用户信息时，增加当前用户的权限列表字段（如 `permissions: ["billing.admin_grant:view", "billing.admin_grant:edit", ...]`），供前端做菜单与按钮控制；权限列表由 rbac 模块根据「用户-角色-权限」计算得出。
- **FR-4.1.a** 除登录接口外，**当前用户/管理员会话接口** 也必须返回 `permissions`，作为前端刷新会话、处理权限变更、恢复页面后的权威来源；前端不得只信任首次登录返回值。
- **FR-4.2** 所有管理后台接口（`/admin/*`）在「已通过管理员身份校验」的前提下，按接口所需权限进行二次校验：若当前用户不拥有该接口要求的权限（如某 POST 要求 `billing.admin_grant:edit`），则返回 403，且不执行业务逻辑。
- **FR-4.3** 接口与所需权限的映射关系可集中维护（如配置表或中间件参数），便于扩展与维护；映射示例见 **第 7 节「接口与权限映射」**。
- **FR-4.4** 后端是权限判断的唯一权威；即使前端因缓存仍展示了某按钮，只要后端校验失败，接口仍必须稳定返回 403，且不允许依赖前端隐藏按钮代替后端鉴权。

### 4.5 可选扩展（非本期必做）

- **FR-5.1** 后台提供「角色与权限管理」功能（仅超级管理员可访问）：角色的增删改、为角色分配/收回权限、为管理员分配/收回角色。若无此功能，角色与权限的维护可通过数据迁移/种子数据或运维在库中完成。

---

## 5. 资源与路由映射（前后端统一）

以下 resource_key 为权限标识中的「资源」部分，与前端路径、菜单一一对应。**叶子资源** 配置 `view` 与 `edit` 两种权限；`ai_models`、`billing` 这类**父级分组资源** 仅用于菜单组织与首层定位，默认**不单独绑定后端接口权限**，其显示由子资源权限推导。

| 资源 key | 前端路径（相对 /admin） | 说明 |
|----------|-------------------------|------|
| `dashboard` | `/` | 仪表盘 |
| `users` | `/users` | 用户管理 |
| `workflow_templates` | `/workflow-templates` | 工作流模板 |
| `node_types` | `/node-types` | 节点类型 |
| `crawler_rules` | `/crawler-rules` | 爬虫规则 |
| `ai_models` | `/ai-models` | AI 模型（父级分组，不单独绑定接口权限） |
| `ai_models.overview` | `/ai-models` | AI 概览 |
| `ai_models.providers` | `/ai-models/providers`, `/ai-models/providers/:provider` | 服务商列表与详情 |
| `ai_models.models` | `/ai-models/models`, `/ai-models/models/new`, `/ai-models/models/:id`, `/ai-models/models/:id/capability`, `/ai-models/models/:id/pricing` | 模型列表、新建、详情、能力、计费 |
| `ai_models.pricing_rules` | `/ai-models/pricing-rules` | 计费规则 |
| `ai_models.usage` | `/ai-models/usage` | 使用统计 |
| `tasks` | `/tasks` | 任务监控 |
| `billing` | `/billing` | 计费运营（父级分组，不单独绑定接口权限） |
| `billing.overview` | `/billing` | 概览 |
| `billing.quota_recovery` | `/billing/quota-recovery` | 补救配额 |
| `billing.admin_grant` | `/billing/admin-grant` | 管理员赠送 |
| `billing.orders` | `/billing/orders` | 订单列表 |
| `billing.ledger` | `/billing/ledger` | 配额流水 |
| `billing.token_ledger` | `/billing/token-ledger` | Token 流水 |
| `system_configs` | `/system-configs` | 系统配置 |
| `notifications` | `/notifications` | 通知中心 |
| `operation_logs` | `/operation-logs` | 操作日志 |

---

## 6. 数据与模型

### 6.1 共用用户表（不新增管理员表）

- **users 表**：保持现有结构；`role = 'admin'` 表示该用户为管理员。
- **用户与 RBAC 角色的关联**（二选一）：
  - **单角色**：在 `users` 表增加字段 `admin_role_id`（外键至 `roles.id`，可为空）；仅当 `role = 'admin'` 时使用，表示该管理员的唯一角色/等级。
  - **多角色**：新增表 `user_roles(user_id, role_id)`，一个管理员可对应多条记录；权限 = 所有绑定角色的权限并集。

### 6.2 RBAC 模块表（modules/rbac）

- **roles**：id, code（如 super_admin）, name, description, created_at, updated_at。
- **permissions**：id, resource_key, action（view | edit）, description（可选）, created_at。数据预置：按第 5 节**叶子资源列表** × view/edit 生成；`ai_models`、`billing` 这类纯分组父资源默认不生成独立 permission 记录。
- **role_permissions**：role_id, permission_id。表示角色拥有哪些权限。
- **user_roles**（若采用多角色）：user_id, role_id。表示用户拥有哪些角色。

采用单角色方案时无需 `user_roles`，仅用 `users.admin_role_id` 即可。

### 6.3 Go 后端模块与目录（约束）

- 新建 **modules/rbac**，与 user、billing、ai 等平级。
- 建议子目录：models（role, permission, role_permission, 及可选的 user_role）、repositories、services（如 GetUserPermissions、HasPermission）、middleware（RequirePermission）。
- 在 **infrastructure/database** 的 AutoMigrate 中注册 rbac 相关 model，不把 rbac 表或逻辑放入 user 或 infrastructure。

---

## 7. 接口与权限映射（后端实现参考）

以下为管理后台主要接口与建议所需权限，便于后端在路由或中间件上挂载校验。

| 接口 | 建议所需权限 |
|------|----------------|
| GET /admin/ai-models | `ai_models.models:view`（或项目统一约定到 `ai_models.overview:view`，二选一后全局保持一致） |
| GET /admin/ai-models/providers | `ai_models.providers:view` |
| GET /admin/ai-models/providers/:provider | `ai_models.providers:view` |
| GET /admin/ai-models/models | `ai_models.models:view` |
| POST /admin/ai-models/models | `ai_models.models:edit` |
| GET /admin/ai-models/models/:id | `ai_models.models:view` |
| PUT /admin/ai-models/models/:id | `ai_models.models:edit` |
| GET /admin/ai-models/models/:id/capability | `ai_models.models:view` |
| PUT /admin/ai-models/models/:id/capability | `ai_models.models:edit` |
| GET /admin/ai-models/models/:id/pricing | `ai_models.models:view` |
| PUT /admin/ai-models/models/:id/pricing | `ai_models.models:edit` |
| GET /admin/ai-models/pricing-rules | `ai_models.pricing_rules:view` |
| GET /admin/ai-models/usage | `ai_models.usage:view` |
| GET /admin/billing/quotas/summary | `billing.overview:view` |
| GET /admin/billing/quotas/ledger | `billing.ledger:view` |
| GET /admin/billing/orders | `billing.orders:view` |
| GET /admin/billing/token-transactions | `billing.token_ledger:view` |
| POST /admin/billing/quotas/recover | billing.quota_recovery:edit |
| POST /admin/billing/quotas/grant | billing.admin_grant:edit |
| GET /admin/users（若存在） | users:view |
| PUT /admin/users/:id/status（若存在） | users:edit |

未列出的 `/admin/*` 接口按所属业务模块对应到第 5 节资源，并约定 view（读）与 edit（写）的划分，统一做权限校验。**Phase 1 至少覆盖当前已存在的 `/admin/ai-models/*` 与 `/admin/billing/*` 全部接口**；其余模块待后台接口接入后按同一规则补齐。

---

## 8. 实施阶段与验收标准

| 阶段 | 内容 | 验收标准 |
|------|------|----------|
| 1. 后端基础 | rbac 模块建表、预置权限与角色、用户-角色关联、登录/会话返回 permissions | 管理员登录后接口返回 permissions；HasPermission 可正确判断。 |
| 2. 后端接口校验 | 为 /admin/* 接口挂载权限校验（按第 7 节映射）；**Phase 1 必须覆盖现有 `/admin/ai-models/*` 与 `/admin/billing/*`** | 无权限访问时返回 403。 |
| 3. 前端会话与菜单 | 前端存 permissions、菜单按 view 权限过滤 | 无权限的菜单不展示。 |
| 4. 前端路由与页面 | 按 path 校验 view 权限，无权限时 403 或重定向；**包含动态详情路由与别名路由** | 直接访问无权限 URL 无法看到页面。 |
| 5. 前端编辑控制 | 按 edit 权限控制按钮/表单可编辑性 | 仅 view 无 edit 时页面只读。 |
| 6. 会话刷新与无权限落点 | 刷新页面后重新获取 permissions；无 `dashboard:view` 时跳转首个可访问页面，若无任何页面可访问则展示专用无权限页 | 权限变更后前端状态可被修正；无权限管理员不会陷入死循环跳转。 |
| 7. 可选 | 角色与权限管理页面（仅 super_admin） | 可配置角色及其权限、管理员所属角色。 |

---

## 9. 附录

### 附录 A：前端 pathname → 所需 view 权限映射

用于前端路由守卫：根据当前 pathname 解析出所需 `resource_key`，再检查 `userPermissions` 是否包含 `resource_key:view`。除静态路径外，还必须处理动态详情路由与别名路由。

```ts
const PATH_TO_PERMISSION: Record<string, string> = {
  '/': 'dashboard',
  '/users': 'users',
  '/workflow-templates': 'workflow_templates',
  '/node-types': 'node_types',
  '/crawler-rules': 'crawler_rules',
  '/ai-models': 'ai_models.overview',
  '/ai-models/providers': 'ai_models.providers',
  '/ai-models/models': 'ai_models.models',
  '/ai-models/pricing-rules': 'ai_models.pricing_rules',
  '/ai-models/usage': 'ai_models.usage',
  '/tasks': 'tasks',
  '/billing': 'billing.overview',
  '/billing/quota-recovery': 'billing.quota_recovery',
  '/billing/admin-grant': 'billing.admin_grant',
  '/billing/orders': 'billing.orders',
  '/billing/ledger': 'billing.ledger',
  '/billing/token-ledger': 'billing.token_ledger',
  '/system-configs': 'system_configs',
  '/notifications': 'notifications',
  '/operation-logs': 'operation_logs',
};

function resolveResourceKey(pathname: string): string | null {
  if (PATH_TO_PERMISSION[pathname]) {
    return PATH_TO_PERMISSION[pathname];
  }

  if (pathname.startsWith('/ai-models/providers/')) {
    return 'ai_models.providers';
  }

  if (
    pathname === '/ai-models/models/new' ||
    pathname.startsWith('/ai-models/models/')
  ) {
    return 'ai_models.models';
  }

  return null;
}
```

### 附录 B：菜单项权限元数据与过滤

- 在 `adminMenuItems` 中为每项增加 `permission`（与第 5 节 resource_key 一致）。
- 在 AdminLayout 中根据 `userPermissions` 过滤：仅保留用户拥有 `permission:view` 的项；有子节点时递归过滤，子节点全无则父节点不展示。
- 父级分组菜单（如 `ai_models`、`billing`）不依赖独立 permission；其可见性由子节点过滤结果决定。

### 附录 C：实现细节文档

更细的实现步骤、代码示例（如菜单过滤函数、RequirePermission 中间件用法等）见同目录下 **《RBAC-Implementation-Guide.md》**，与本 PRD 配套使用。
