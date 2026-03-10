# YaoLight Admin Frontend

## 1. 项目定位

`Admin_Frontend` 是瑶光工坊的独立后台前端应用。

它与现有用户端 `Low_code_Frontend` 并列存在，职责分离：

- `Low_code_Frontend`：普通用户工作台、项目、工作流、个人中心
- `Admin_Frontend`：管理员后台、运营后台、配置后台

这样拆分的原因：

- 路由、布局、接口语义完全不同
- 后台页面会快速膨胀，不适合继续混在用户端工程内
- 后台需要单独维护自己的菜单、权限守卫、接口封装和页面组织

## 2. 技术栈

- React 19
- TypeScript
- Vite
- Ant Design
- React Router
- Axios
- Sass

## 3. 一期模块

后台前端一期只承接当前项目真实需要的功能：

1. 后台首页
2. 用户管理
3. 工作流模板管理
4. 节点类型管理
5. 爬虫规则库
6. AI 模型配置
7. 全局任务监控
8. 邀请与计费运营
9. 系统配置
10. 平台通知
11. 操作日志

明确不做：

- 完整 RBAC
- 组织架构
- 审批流
- 企业级运维监控

## 4. 路由边界

后台前端统一使用 `/admin/*` 路由：

- `/admin`
- `/admin/users`
- `/admin/workflow-templates`
- `/admin/node-types`
- `/admin/crawler-rules`
- `/admin/ai-models`
- `/admin/tasks`
- `/admin/billing`
- `/admin/system-configs`
- `/admin/notifications`
- `/admin/operation-logs`

登录页单独使用 `/login`。

## 5. 接口边界

后台接口不复用用户侧接口语义。

建议后端统一提供：

- `/api/admin/users`
- `/api/admin/workflow-templates`
- `/api/admin/node-types`
- `/api/admin/crawler-rules`
- `/api/admin/ai-models`
- `/api/admin/tasks`
- `/api/admin/billing`
- `/api/admin/system-configs`
- `/api/admin/notifications`
- `/api/admin/operation-logs`

原则：

- 用户接口以“我”为中心
- 管理接口以“平台全局”和“指定资源”为中心

## 6. 目录结构

```text
Admin_Frontend/
  src/
    api/
    components/
    constants/
    guards/
    layouts/
    pages/
    routes/
    styles/
    theme/
    types/
    utils/
```

## 7. 当前阶段输出

当前阶段先完成：

1. 独立后台前端工程骨架
2. 后台布局
3. 路由和占位页面
4. 登录页骨架

下一步再接：

1. 管理员认证
2. 后台真实接口
3. 用户管理首个真实页面
