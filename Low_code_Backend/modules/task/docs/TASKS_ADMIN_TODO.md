# 管理端任务监控模块待办清单

## 1. 目标

将当前“工作流内任务查看能力”扩展为“管理端全局任务监控中心”，支持：

- 全平台任务列表
- 运行中任务监控
- 失败任务分析
- 任务详情下钻
- 节点执行明细查看
- 日志检索与排障
- 后续管理员处置动作

## 2. 当前现状

### 2.1 后端已具备

- [x] 已有 `Task`、`TaskNodeExecution`、`TaskLog` 持久化模型
- [x] 已有工作流维度任务历史接口：`GET /api/workflows/:id/tasks`
- [x] 已有工作流维度运行中任务接口：`GET /api/workflows/:id/running-tasks`
- [x] 已有任务详情接口：`GET /api/tasks/:id`
- [x] 已有节点执行明细接口：`GET /api/tasks/:id/node-executions`
- [x] 已有任务日志接口：`GET /api/tasks/:id/logs`
- [x] 已有按任务查询制品接口：`GET /api/tasks/:id/artifacts`

### 2.2 前端已具备

- [x] 管理端已有 `Tasks` 菜单入口
- [x] 管理端已有 `Tasks` 占位页面

### 2.3 当前缺口

- [x] 已新增管理端全局任务查询接口
- [x] 已新增任务统计概览接口
- [ ] 没有管理端运行中任务专用接口
- [x] 已新增管理端失败任务聚合/筛选接口
- [ ] 没有管理员任务处置接口（取消/重试）
- [x] 已新增 `Tasks` 多路由页面结构
- [x] 已新增管理端任务详情页、日志页、节点页

## 3. 一期建议范围

一期目标是先做“可观测、可下钻、可排障”的最小闭环，不先做复杂运维动作。

### 3.1 一期必做

- [x] 新增管理端全局任务列表接口：`GET /api/admin/tasks`
- [x] 新增管理端任务概览接口：`GET /api/admin/tasks/summary`
- [x] 新增管理端任务详情接口：`GET /api/admin/tasks/:id`
- [x] 新增管理端任务日志接口：`GET /api/admin/tasks/:id/logs`
- [x] 新增管理端节点执行明细接口：`GET /api/admin/tasks/:id/node-executions`
- [x] 接入管理端路由：`/api/admin/tasks`
- [x] 管理端前端补齐 `Tasks` 多路由结构
- [x] 实现全局任务列表页
- [x] 实现任务详情页
- [x] 实现任务日志页
- [x] 实现节点执行明细页

### 3.2 一期建议做

- [x] 新增运行中任务页：`GET /api/admin/tasks/running`
- [x] 新增失败任务页：`GET /api/admin/tasks/failures`
- [ ] 支持任务列表按用户、工作流、状态、时间范围筛选
- [ ] 支持任务日志按级别、节点筛选
- [x] 在任务详情页展示关联制品

### 3.3 一期可以不做

- [ ] 管理员取消任务
- [ ] 管理员重试任务
- [x] 失败原因聚合报表
- [ ] 任务导出
- [ ] 告警与订阅

## 4. 推荐前端路由结构

```text
/tasks
/tasks/running
/tasks/failures
/tasks/:id
/tasks/:id/nodes
/tasks/:id/logs
```

当前建议先至少落地：

- [x] `/tasks`
- [x] `/tasks/running`
- [x] `/tasks/failures`
- [x] `/tasks/:id`
- [x] `/tasks/:id/logs`
- [x] `/tasks/:id/nodes`

## 5. 推荐后端目录补齐

建议新增：

```text
modules/task/
  controllers/
    admin_task_controller.go
  repositories/
    admin_task_query_repository.go
  services/
    admin_task_service.go
  docs/
    TASKS_ADMIN_TODO.md
```

## 6. 管理端接口清单

### 6.1 全局任务列表

- [x] `GET /api/admin/tasks`

建议查询参数：

- `keyword`
- `user_id`
- `workflow_id`
- `status`
- `started_from`
- `started_to`
- `page`
- `page_size`
- `sort_by`
- `sort_order`

### 6.2 概览统计

- [x] `GET /api/admin/tasks/summary`

建议返回：

- `total`
- `running`
- `failed`
- `completed_today`
- `avg_duration_ms`
- `failure_rate_24h`

### 6.3 运行中任务

- [x] `GET /api/admin/tasks/running`

### 6.4 失败任务

- [x] `GET /api/admin/tasks/failures`

建议支持：

- `node_type`
- `error_keyword`
- `started_from`
- `started_to`

### 6.5 任务详情

- [x] `GET /api/admin/tasks/:id`

建议补充返回：

- 任务基础信息
- 工作流基础信息
- 用户基础信息
- 关联制品数量
- 节点执行统计摘要

### 6.6 节点执行明细

- [x] `GET /api/admin/tasks/:id/node-executions`

### 6.7 任务日志

- [x] `GET /api/admin/tasks/:id/logs`

建议支持：

- `level`
- `node_id`
- `page`
- `page_size`

### 6.8 后续处置动作

- [x] `POST /api/admin/tasks/:id/cancel`
- [x] `POST /api/admin/tasks/:id/retry`

## 7. 前端页面待办

### Phase 1

- [x] 新建 `pages/Tasks/routes.tsx`
- [x] 新建 `pages/Tasks/TasksLayout.tsx`
- [x] 新建 `pages/Tasks/OverviewPage.tsx`
- [x] 新建 `pages/Tasks/TaskDetailLayout.tsx`
- [x] 新建 `pages/Tasks/TaskOverviewPage.tsx`
- [x] 新建 `pages/Tasks/TaskNodesPage.tsx`
- [x] 新建 `pages/Tasks/TaskLogsPage.tsx`
- [x] 新建 `api/tasks.ts`
- [x] 新建 `types/tasks.ts`

### Phase 2

- [x] 新建 `pages/Tasks/RunningTasksPage.tsx`
- [x] 新建 `pages/Tasks/FailedTasksPage.tsx`
- [ ] 支持更丰富的筛选器与统计卡片

### Phase 3

- [ ] 接入取消任务动作
- [ ] 接入重试任务动作
- [x] 增加失败聚合分析视图

## 8. 实现顺序建议

### 第一步：后端最小闭环

- [x] 管理端全局任务查询 repository
- [x] 管理端 service
- [x] 管理端 controller
- [x] `main.go` 接入 `/api/admin/tasks`
- [x] 完成 `summary + list + detail + logs + node-executions`

### 第二步：前端最小闭环

- [x] 补 `Tasks` 路由域
- [x] 完成全局任务列表页
- [x] 完成任务详情页
- [x] 完成日志页
- [x] 完成节点页

### 第三步：增强能力

- [ ] 运行中任务页
- [ ] 失败任务页
- [ ] 管理员取消/重试

## 9. 验收标准

满足以下条件可认为一期完成：

- [x] 管理端可查看全平台任务列表
- [x] 管理端可按状态、用户、工作流筛选任务
- [x] 管理端可打开任务详情
- [x] 管理端可查看节点执行明细
- [x] 管理端可查看任务日志
- [x] 管理端可查看任务概览统计
- [ ] 现有工作流内任务接口行为不受影响

## 10. 备注

这份清单约定：

- `[x]` 表示当前已经具备或已完成
- `[ ]` 表示待开发

后续实现 `Tasks` 管理域时，应直接基于本文件持续更新状态，而不是另起一份重复待办。
