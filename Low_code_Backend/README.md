# 瑶光工坊 (YaoLight Workshop) - 后端服务

瑶光工坊后端是一个面向智能工作流平台的 Go 服务端，负责承载工作流编排与执行、任务调度、AI 模型接入、Agent 能力、爬虫与数据处理、开放 API、通知、计费、权限治理等核心能力。

它不是单一的 CRUD 后台，而是一个偏平台型、产品型的后端系统。

## 项目定位

本项目服务于“低代码智能工作流平台”这一整体目标，核心问题不是只把接口写出来，而是让用户能够完成下面这条闭环链路：

`自然语言提出需求 -> AI 生成工作流 -> 可视化编辑与修正 -> 执行任务 -> 产出结果工件 -> 对外发布或再次复用`

围绕这条链路，后端承担了以下职责：

- 工作流定义、版本化与节点保存
- DAG 执行引擎与流式运行反馈
- 任务调度、重试、日志、节点执行记录
- 多模型统一接入与模型能力治理
- Alkaid Agent 对话、能力检索、工作流生成与补丁应用
- 网页源管理、知识管理、爬虫规则与数据清洗
- 结果导出、文件管理、工件分发
- Open API 发布与调用追踪
- 用户、RBAC、通知、账务、订单、配额、运维审计

## 核心能力

### 1. 工作流平台能力

- 支持工作流创建、编辑、删除、版本化与模板化
- 支持节点画布数据保存、单节点更新、模板发布与同步
- 支持工作流直接执行与流式执行
- 支持工作流对外发布为 Open API 接口

### 2. 执行与调度能力

- 基于 DAG 的工作流执行模型
- 支持节点级执行记录、任务日志、运行状态追踪
- 支持定时调度、手动触发、Webhook 触发
- 支持失败任务排查、重试、取消与运行态监控

### 3. AI 与 Agent 能力

- 支持用户自定义模型与平台托管模型
- 支持模型能力、价格、使用量、提供商模板管理
- 支持 Alkaid 对话会话、消息流、流式规划与工作流生成
- 支持应用工作流、应用补丁、丢弃待确认变更等人机协同机制

### 4. 数据采集与知识增强能力

- 支持项目级知识条目管理
- 支持网站源管理与可用性检查
- 支持后台爬虫规则管理、测试、克隆和使用情况分析
- 支持与 Agent 检索、工作流生成协同

### 5. 平台治理能力

- 支持认证、OAuth、邀请、头像历史、账户安全
- 支持 RBAC 角色权限与后台管理员体系
- 支持站内通知、模板、投递作业、分析统计
- 支持订单、配额恢复、管理员赠送、Token 流水与账单导出
- 支持后台操作日志审计

## 架构说明

后端采用 **模块化领域驱动设计（Modular DDD）** 思路，将业务按领域拆分为高内聚模块，并以共享基础设施与中间件完成横向支撑。

设计目标包括：

- 高内聚：每个模块具备相对完整的模型、仓储、服务、控制器层次
- 低耦合：模块边界清晰，通过服务和仓储抽象协作
- 可扩展：新业务能力可以通过新增模块接入平台
- 易维护：业务、基础设施与接口层分离，便于迭代与测试

## 主要模块

当前后端包含以下业务模块：

- `user`：用户、认证、OAuth、头像、邀请、账单与个人中心
- `project`：项目管理、项目网站源、项目上下文
- `workflow`：工作流定义、节点、版本、模板、执行入口
- `task`：任务、任务日志、节点执行记录、调度与触发
- `ai`：AI 模型、提供商模板、模型能力、模型定价
- `alkaid`：Agent 会话、消息、能力检索、工作流生成与补丁应用
- `crawler`：爬虫规则、测试、状态与使用分析
- `dataclean`：数据清洗与结构转换支撑
- `artifact`：结果工件、下载、邮件分发
- `file`：文件上传、资源代理、附件能力
- `workflowapi`：工作流开放接口、密钥、调用记录、文档
- `billing`：配额流水、运营补救、管理员赠送、账务统计
- `payment`：订单、支付套餐、支付回调
- `notification`：站内通知、模板、投递任务、统计分析
- `rbac`：后台角色、权限、管理员管理
- `node`：节点类型定义与后台节点治理
- `system`：操作日志与系统治理能力

## 目录结构

```text
Low_code_Backend/
├── cmd/                           # 应用入口
│   └── server/
│       └── main.go                # 路由注册与系统启动
├── modules/                       # 业务模块
│   ├── ai/
│   ├── alkaid/
│   ├── artifact/
│   ├── billing/
│   ├── crawler/
│   ├── dataclean/
│   ├── file/
│   ├── node/
│   ├── notification/
│   ├── payment/
│   ├── project/
│   ├── rbac/
│   ├── system/
│   ├── task/
│   ├── user/
│   ├── workflow/
│   └── workflowapi/
├── domain/                        # 共享领域抽象
│   ├── entity/
│   └── repository/
├── infrastructure/                # 基础设施层
│   ├── config/
│   ├── database/
│   └── shared/
└── interfaces/                    # 接口与中间件
    └── middleware/
```

## API 组织方式

系统接口大致分为三层：

### 1. 公共接口

- `/api/auth/*`
- `/api/payment/packages`
- `/api/payment/callback`
- `/api/payment/alipay/notify`
- `/api/ws/notifications`

### 2. 登录用户接口

- `/api/projects/*`
- `/api/workflows/*`
- `/api/tasks/*`
- `/api/task-schedules/*`
- `/api/ai/*`
- `/api/alkaid/*`
- `/api/artifacts/*`
- `/api/users/*`

### 3. 管理后台接口

- `/api/admin/tasks/*`
- `/api/admin/ai-models/*`
- `/api/admin/billing/*`
- `/api/admin/users/*`
- `/api/admin/rbac/*`
- `/api/admin/crawler-rules/*`
- `/api/admin/workflow-templates/*`
- `/api/admin/node-types/*`
- `/api/admin/notifications/*`
- `/api/admin/operation-logs/*`
- `/api/admin/alkaid/knowledge/*`

### 4. Open API 接口

- `/open-api/v1/workflows/:slug/docs`
- `/open-api/v1/workflows/:slug/invoke`
- `/open-api/v1/workflows/:slug/invocations/:requestId`
- `/open-api/v1/triggers/:token/invoke`

## 典型业务链路

### 1. 智能工作流生成链路

1. 用户在前端发起 Alkaid 对话
2. 后端检索能力说明、知识数据与节点规格
3. Agent 规划生成工作流或补丁
4. 用户确认后写回工作流画布
5. 用户执行工作流并查看流式结果

### 2. 工作流执行链路

1. 用户提交工作流执行请求
2. 后端解析节点与边关系
3. 执行引擎按 DAG 顺序调度节点
4. 产生任务日志、节点执行记录与输出工件
5. 用户下载结果、邮件发送或通过 Open API 查询

### 3. 调度与开放能力链路

1. 用户为工作流创建调度计划或 Webhook
2. 触发器调用执行入口
3. 系统记录任务运行与产物信息
4. 外部系统通过开放接口调用或查询结果

## 技术栈

- 语言：`Go`
- Web 框架：`Gin`
- ORM：`GORM`
- 数据库：`PostgreSQL`
- 缓存 / 状态：`Redis`
- 认证：`JWT`
- 实时通信：`SSE`、`WebSocket`
- AI 集成：多 Provider 统一接入
- 工程组织：模块化 DDD

## 数据与持久化

后端使用 PostgreSQL 管理平台主数据，数据模型覆盖以下核心域：

- 用户与认证
- 角色与权限
- 项目与工作流
- 节点与版本
- 任务与调度
- AI 模型与价格能力
- Alkaid 会话、消息、知识与节点规格
- 网站源、爬虫规则与数据工件
- 文件、通知、订单、配额与操作日志

项目实际数据库表数量较多，体现的是平台化治理能力，而不是简单业务系统。

## 适用场景

瑶光工坊适用于以下类型的产品或研究场景：

- 基于自然语言生成工作流的智能自动化平台
- 面向内容采集、分析、整理的流程化系统
- 结合大模型、爬虫与导出的研究辅助工具
- 需要可视化编排、开放调用与平台治理的一体化系统

## 快速开始

### 1. 安装依赖

```bash
cd Low_code_Backend
go mod download
go mod tidy
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并按本地环境修改数据库、Redis、JWT、文件存储、支付、邮件与 AI 提供商配置。

### 3. 创建数据库

```bash
psql -U postgres
CREATE DATABASE yaolight_workshop_db;
\q
```

### 4. 启动服务

```bash
go run cmd/server/main.go
```

默认情况下，服务启动后会完成基础依赖初始化、数据库连接、路由注册与部分初始化数据准备。

## 开发建议

- 新增业务优先以独立模块方式接入
- 保持 `models / repositories / services / controllers` 的层次清晰
- 管理后台接口统一走权限与操作日志中间件
- 平台级能力优先考虑复用，不要把逻辑散落到控制器层

## 说明

这个 README 重点展示的是后端平台能力与架构边界，详细论文级设计说明、数据库全量覆盖清单与系统实现分析，请参考仓库中的 thesis 文档与其他设计文档。
