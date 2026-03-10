# 管理员 RBAC 权限模型 — 可执行方案

> 针对当前「瑶光管理后台」Admin_Frontend 与后端，实现基于角色的访问控制：管理员分等级、可分配权限、按模块/子模块控制可见与可编辑。

---

## 一、目标与可行性

### 1.1 目标

- **管理员分等级**：如超级管理员、运营管理员、只读审计员等。
- **可分配权限**：为角色或账号分配「模块 + 操作」权限。
- **模块/子模块粒度**：可控制到「计费运营 → 管理员赠送」等子页面。
- **未分配权限**：看不到对应菜单与路由，或进入后无数据/无操作。
- **权限类型**：至少区分 **可查看（view）** 与 **可编辑（edit）**；无 view 则不可见，无 edit 则仅只读。

### 1.2 可行性结论

**可以实现。** 当前项目已具备：

- Admin_Frontend：统一 `/admin` 路由、`AdminGuard`、静态菜单与子路由（用户、工作流模板、节点类型、爬虫规则、AI 模型、任务、计费、系统配置、通知、操作日志）。
- 后端：通过 `/auth/login` 鉴权，接口以 `/admin/*` 为主，便于按资源挂载权限中间件。

在现有结构上增加「角色 + 权限」数据与校验层，前端按权限过滤菜单/路由、按权限禁用编辑，后端按权限校验接口即可。

---

## 二、RBAC 模型设计

### 2.1 概念

- **用户（User）**：管理员账号，属于一个或多个 **角色**。
- **角色（Role）**：如 `super_admin`、`billing_operator`、`audit_readonly`，绑定一组 **权限**。
- **权限（Permission）**：对「某个资源」的「某种操作」，如 `billing.admin_grant:view`、`billing.admin_grant:edit`。

建议采用 **角色 → 权限** 的 RBAC 模型（用户 → 角色 → 权限），便于批量分配与维护。

### 2.2 资源（模块/子模块）与路由映射

与当前 `Admin_Frontend` 菜单和路由保持一致，便于前后端统一标识：

| 资源 key（权限标识用） | 前端路径 | 说明 |
|------------------------|----------|------|
| `dashboard` | `/` | 仪表盘 |
| `users` | `/users` | 用户管理 |
| `workflow_templates` | `/workflow-templates` | 工作流模板 |
| `node_types` | `/node-types` | 节点类型 |
| `crawler_rules` | `/crawler-rules` | 爬虫规则 |
| `ai_models` | `/ai-models` | AI 模型（父） |
| `ai_models.overview` | `/ai-models` | AI 概览 |
| `ai_models.providers` | `/ai-models/providers` | 服务商 |
| `ai_models.models` | `/ai-models/models` | 模型 |
| `ai_models.pricing_rules` | `/ai-models/pricing-rules` | 计费规则 |
| `ai_models.usage` | `/ai-models/usage` | 使用统计 |
| `tasks` | `/tasks` | 任务监控 |
| `billing` | `/billing` | 计费运营（父） |
| `billing.overview` | `/billing` | 概览 |
| `billing.quota_recovery` | `/billing/quota-recovery` | 补救配额 |
| `billing.admin_grant` | `/billing/admin-grant` | 管理员赠送 |
| `billing.orders` | `/billing/orders` | 订单列表 |
| `billing.ledger` | `/billing/ledger` | 配额流水 |
| `billing.token_ledger` | `/billing/token-ledger` | Token 流水 |
| `system_configs` | `/system-configs` | 系统配置 |
| `notifications` | `/notifications` | 通知中心 |
| `operation_logs` | `/operation-logs` | 操作日志 |

### 2.3 操作类型

- **view**：可查看（列表、详情、统计等）。无 view 则菜单不展示、路由不可访问。
- **edit**：可编辑（增删改、审批、赠送等）。仅有 view 无 edit 时，页面只读（按钮隐藏或禁用）。

权限标识格式：`资源key:操作`，例如 `billing.admin_grant:view`、`billing.admin_grant:edit`。

### 2.4 角色示例

| 角色标识 | 说明 | 典型权限 |
|----------|------|----------|
| `super_admin` | 超级管理员 | 所有资源 view + edit |
| `billing_operator` | 计费运营 | billing.* view + edit |
| `support_readonly` | 客服只读 | users view；billing.* view |
| `audit_readonly` | 审计只读 | operation_logs view；部分 view |

---

## 三、后端实现要点（可执行步骤）

> 若后端为独立仓库或不同技术栈，可按同一模型在对应语言中实现等价逻辑。

### 3.1 数据模型（建议）

- **roles**：id, code, name, description, created_at
- **permissions**：id, resource_key, action（view | edit）, description（可选）
- **role_permissions**：role_id, permission_id
- **user_roles**：user_id, role_id（若支持多角色）
- 或在 **users** 表增加 role_id（单角色时）

预置数据：插入上述 permissions（按 2.2 资源列表 + view/edit），插入角色并绑定权限，超级管理员绑定所有 permission。

### 3.2 登录接口改造

- 登录成功后除返回 token、user 基本信息外，增加：
  - `user.role` 或 `user.roles`（多角色时为数组）
  - `user.permissions`：当前用户拥有的权限列表，如 `["billing.admin_grant:view", "billing.admin_grant:edit", ...]`
- 便于前端无需再请求「我的权限」接口即可做菜单与按钮控制。

### 3.3 权限校验中间件

- 为每个 `/admin/*` 接口定义所需权限，例如：
  - `GET /admin/billing/quotas/summary` → 需要 `billing.overview:view` 或 `billing:view`
  - `POST /admin/billing/quotas/grant` → 需要 `billing.admin_grant:edit`
- 请求到达时从 token 解析用户，查其权限集合，若不包含所需权限则返回 403。
- 建议：用「资源 + 操作」与路由/控制器映射表或注解（Decorator）统一维护，避免硬编码。

### 3.4 可选：权限管理接口（给超级管理员用）

- `GET /admin/roles`、`GET /admin/roles/:id`、`PUT /admin/roles/:id`（绑定权限）
- `GET /admin/permissions`：树形或平铺的权限列表
- 若支持「直接给用户加权限」：`GET/PUT /admin/users/:id/permissions` 或通过角色间接分配。

---

## 3.5 Go 后端：是否需要新建模块（结论：需要）

当前后端（Low_code_Backend）结构是**按业务拆成多个模块**（如 `user`、`billing`、`ai`、`workflow` 等），管理员鉴权只在 `infrastructure/middleware/admin_middleware.go` 里用 `role == "admin"` 判断。要做 RBAC，**建议单独建一个 RBAC 模块**，而不是把角色/权限塞进 `user` 或 `infrastructure`。

### 为什么需要新建模块

- **角色、权限、角色-权限、用户-角色** 是一套独立领域，和「用户登录、资料、OAuth」不是同一件事；塞进 `user` 会让 user 模块职责过重。
- **权限校验** 需要查库、缓存、提供 `RequirePermission(perm)` 的中间件，若放在 `infrastructure`，会混入业务概念（资源 key、action），不利于维护。
- 和现有 **billing、ai、workflow** 等模块平级，一个 **rbac** 模块职责清晰，后续扩展「角色管理、权限分配」接口也自然放在这里。

### 推荐目录结构（新建 `modules/rbac`）

```
Low_code_Backend/modules/rbac/
├── models/
│   ├── role.go           # 角色表
│   ├── permission.go     # 权限表（或资源+action 配置）
│   └── role_permission.go # 角色-权限关联
├── repositories/
│   ├── role_repository.go
│   ├── permission_repository.go
│   └── user_permission_repository.go  # 查某用户拥有的权限列表
├── services/
│   └── rbac_service.go   # GetUserPermissions(userID), HasPermission(userID, "xxx:view") 等
├── middleware/
│   └── require_permission.go  # 替代或包装 AdminOnly，按所需 permission 校验
└── controllers/          # 可选，超级管理员用
    └── role_controller.go    # 角色/权限的 CRUD、分配
```

### 管理员是否单独建表？（结论：不建，共用 users 表）

**可以共用一个用户表。** 管理员就是「普通用户表里 role='admin' 的那批账号」，不需要再建一张「管理员表」。分等级只通过 **RBAC 角色** 区分：

- 仍用现有 **users** 表，`users.role = 'admin'` 表示是管理员。
- 在 **rbac** 模块里只有：**角色表（roles）**、**权限表（permissions）**、**角色-权限关联（role_permissions）**。
- 「等级」= 该管理员绑定的角色：例如给某用户绑定「计费运营」角色，他就只有计费相关权限；绑定「超级管理员」角色则拥有全部权限。
- 用户与角色的关联二选一即可：
  - **单角色**：在 users 表加一列 `admin_role_id`（仅当 role='admin' 时有值），表示该管理员的等级/角色。
  - **多角色**：用一张 **user_roles** 表（user_id, role_id），一个管理员可挂多个角色，权限取并集。

这样仍然是「一个用户表」，只是管理员多了一个「属于哪个角色」的关联，等级和权限都通过角色算出来。

### 与现有代码的衔接

- **用户与角色的关系**：  
  - 保留 `users.role == "admin"` 作为「能否进管理后台」的判断；仅对管理员再按 `admin_role_id` 或 `user_roles` 查 rbac，得到该账号的权限列表。  
  - 不需要单独的管理员表，等级完全由「绑定的 RBAC 角色」体现。
- **中间件**：  
  - 现有 `AdminOnlyMiddleware()` 保留为「第一道门」：非 admin 直接 403。  
  - 在需要细粒度的地方再加一层：`AdminOnlyMiddleware()` + `RequirePermission("billing.admin_grant:edit")`；后者从 context 取 userID，调 `rbac_service.HasPermission(userID, perm)`，不通过则 403。
- **数据库迁移**：在 `infrastructure/database/database.go` 的 `AutoMigrate()` 中增加 rbac 的 model（如 `&rbacModels.Role{}`, `&rbacModels.Permission{}`, `&rbacModels.RolePermission{}` 等），与现有迁移方式一致。

### 小结

- **需要新建模块**：建议 `modules/rbac`，与 user、billing、ai 等平级。  
- **不推荐**：把 RBAC 表与逻辑全部放进 `user` 或 `infrastructure`。  
- 新建 rbac 模块后，登录接口在返回体里增加 `permissions` 列表时，可依赖 rbac 的 service/repository 查当前用户的权限并一并返回。

---

## 四、前端实现要点（可执行步骤）

### 4.1 权限数据来源

- 登录后从 `session.user.permissions`（或接口返回的 `permissions`）读取，存入前端状态（如 Zustand 或 Context），并持久化到 sessionStorage（与现有 session 一起）。
- 若登录接口暂不返回 permissions，可增加 `GET /admin/me` 或 `GET /admin/auth/permissions`，在 AdminGuard 或 Layout 内请求一次并写入状态。

### 4.2 菜单过滤（看不到无权限的菜单）

- 在 `Admin_Frontend/src/constants/menu.tsx` 中为每个 `adminMenuItems` 的项（及子项）增加 `permission` 或 `permissions: { view: 'xxx' }` 元数据。
- 在 `AdminLayout` 中根据当前用户 `permissions` 过滤：
  - 若用户拥有该菜单项对应资源的 `view` 权限，则保留；
  - 无则从列表中移除；若某父节点下所有子节点都被过滤掉，则父节点也不展示（或整组隐藏）。
- 使用过滤后的菜单调用 `buildMenuItems` 生成 Ant Design Menu 的 items，这样未分配权限的管理员就看不到对应菜单项。

### 4.3 路由与页面访问控制（无权限不可打开页面）

- **方案 A（推荐）**：在 `AdminLayout` 内、`Outlet` 外层包一层「权限路由守卫」：
  - 根据当前 pathname 解析出对应的「资源 key」（可用与 2.2 一致的 path → resource 映射表）。
  - 若当前用户没有该资源的 `view` 权限，则渲染「无权限」页或重定向到仪表盘/403。
- **方案 B**：为每个需要控制的路由配置 `requiredPermission`，在统一的路由渲染处（如包装 `Route` 的组件）根据 permission 决定渲染页面还是无权限页。

这样即使直接输入 URL，无权限也会被拦截。

### 4.4 编辑类操作（仅 view 无 edit 时只读）

- 在页面内根据权限控制：
  - 若没有对应资源的 `edit` 权限：隐藏「新建」「编辑」「删除」「提交」等按钮，或展示为禁用；
  - 表单只读（只展示不提交）。
- 实现方式：
  - 封装 `usePermission(resourceKey)` 返回 `{ canView, canEdit }`（由 `session.user.permissions` 推导）；
  - 各页面在按钮/表单处使用 `canEdit` 控制。

### 4.5 接口层（可选）

- 对调用 `/admin/*` 的 API 封装层，在 403 时统一提示「无权限」并可选跳转，避免控制台报错混乱。

---

## 五、前后端权限与 API 对应关系（供后端挂载权限）

以下为当前 Admin 前端主要接口与建议所需权限，便于后端实现 3.3 的映射：

| 接口示例 | 建议所需权限 |
|----------|----------------|
| GET /admin/ai-models/providers, models, usage 等 | ai_models.*:view |
| PUT/POST /admin/ai-models/models, capability, pricing | ai_models.models:edit 等 |
| GET /admin/billing/quotas/summary, orders, token-transactions, ledger | billing.*:view（按子资源细分更佳） |
| POST /admin/billing/quotas/recover | billing.quota_recovery:edit |
| POST /admin/billing/quotas/grant | billing.admin_grant:edit |
| GET /admin/users（若存在） | users:view |
| PUT /admin/users/:id/status（若存在） | users:edit |

---

## 六、实施顺序建议

1. **后端**：建表、预置 permissions 与角色、登录返回 permissions、为部分核心接口加权限校验。
2. **前端**：登录后存 permissions、菜单按 permission 过滤、Layout 内增加按 path 的 view 校验（无权限则 403 页或重定向）。
3. **前端**：各页面根据 `edit` 权限控制按钮与表单可编辑性。
4. **后端**：逐步为所有 `/admin/*` 接口挂载权限校验。
5. **可选**：后台「角色与权限管理」页面（仅 super_admin 可进），用于分配角色/权限。

---

## 七、与当前项目的直接对应

- **AdminGuard**：保持「已登录且为管理员」的校验；在进入 Layout 后，再按 permissions 做菜单与路由级的控制。
- **菜单**：`Admin_Frontend/src/constants/menu.tsx` 的 `adminMenuItems` 增加 permission 元数据；`AdminLayout.tsx` 的 `buildMenuItems` 改为先过滤再构建。
- **路由**：现有 `routes/index.tsx` 的 children 可不变，在 Layout 内用「pathname → 所需 view permission」做统一守卫即可，无需为每条路由写单独 Guard。
- **会话**：`Admin_Frontend/src/types/auth.ts` 的 `AdminUser` 增加 `permissions: string[]`；`utils/storage.ts` 的 session 存该字段；登录接口返回中写入。

按上述步骤即可在本项目中实现「管理员分等级、可分配权限、按模块/子模块控制查看与编辑」的 RBAC 能力；未分配权限的管理员将看不到部分路由与菜单，且无 edit 权限时只能查看不能编辑。

---

## 附录 A：菜单项权限元数据示例

在 `adminMenuItems` 中为每项增加 `permission`（或 `permissions.view`），与 2.2 资源 key 一致，便于过滤：

```ts
// 类型扩展（types/menu.ts）
export interface AdminMenuItem {
  key: string;
  path?: string;
  label: string;
  icon?: ReactNode;
  aliases?: string[];
  children?: AdminMenuItem[];
  /** 所需查看权限，无则表示不校验（如 dashboard 可所有人见） */
  permission?: string;  // 如 'billing.admin_grant'
}

// 过滤逻辑示例（Layout 或 utils 中）
function filterMenuByPermission(
  items: AdminMenuItem[],
  userPermissions: string[]  // 如 ['billing.admin_grant:view', 'billing.admin_grant:edit']
): AdminMenuItem[] {
  const hasView = (perm: string) => userPermissions.includes(`${perm}:view`);
  return items
    .map((item) => ({
      ...item,
      children: item.children?.length
        ? filterMenuByPermission(item.children, userPermissions)
        : undefined,
    }))
    .filter((item) => {
      if (!item.permission) return true;
      if (item.children?.length) return item.children.length > 0;
      return hasView(item.permission);
    });
}
```

---

## 附录 B：pathname → 所需 view 权限映射示例

用于路由守卫：根据当前 pathname 解析出所需 `resource_key`，再检查 `userPermissions` 是否包含 `resource_key:view`。

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

function getRequiredPermission(pathname: string): string | null {
  const normalized = pathname.replace(/^\/admin/, '') || '/';
  return PATH_TO_PERMISSION[normalized] ?? null;
}
```
