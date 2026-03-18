# RBAC 待完成清单

> 范围按当前管理后台 RBAC MVP 实现推进。每完成一项就打勾。

- [x] 梳理现有认证、菜单、路由、后台接口与 RBAC 接入点
- [x] 新增 `modules/rbac` 数据模型、仓储、服务
- [x] 数据库迁移接入 RBAC 表
- [x] 预置资源权限与默认角色种子数据
- [x] 登录接口返回管理员 `permissions`
- [x] `/api/users/current` 返回管理员 `permissions`
- [x] 新增后端 `RequirePermission` 中间件
- [x] 给核心 `/api/admin/*` 路由挂载权限中间件
- [x] 前端 `AdminSession` 扩展 `permissions`
- [x] 前端登录后保存 `permissions`
- [x] 前端菜单按 `view` 权限过滤
- [x] 前端路由按真实 pathname 做权限守卫
- [x] 无任何后台可访问资源时给出明确落点
- [x] 关键页面按 `edit` 权限切换为只读
- [x] 构建验证：后端 `go build ./...`
- [x] 构建验证：管理端 `npm run build`
- [x] 回写文档与清单状态

## MVP 之后仍可继续补的项

- 权限管理页接真实角色、权限、管理员分配接口
- 超级管理员之外的业务角色配置与维护流程
- 权限变更后的实时刷新 / 强制重新拉取策略
- 更细粒度的页面内按钮、字段级只读控制
