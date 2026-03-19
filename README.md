# 瑶光工坊 (YaoLight Workshop)

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Go](https://img.shields.io/badge/Go-1.24+-00ADD8.svg)
![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**基于 Go + React 的低代码智能工作流平台**

面向工作流编排、Agent 生成、爬虫采集、AI 处理、结果导出与平台治理的一体化系统

[项目概览](#项目概览) • [核心能力](#核心能力) • [快速开始](#快速开始) • [仓库结构](#仓库结构) • [文档索引](#文档索引)

</div>

---

## 项目概览

瑶光工坊不是单一功能页面，而是一套完整的平台型系统，核心目标是把下面这条链路打通：

`自然语言提出需求 -> AI 生成工作流 -> 画布编排与修正 -> 执行任务 -> 产出工件 -> 对外调用或沉淀复用`

整个仓库由三部分组成：

- `Low_code_Backend`：Go 后端，承载工作流执行、调度、AI 接入、Open API、RBAC、通知、账务等平台能力
- `Low_code_Frontend`：用户前台，负责项目管理、工作流编辑、任务执行、结果查看、Alkaid 助手交互
- `Admin_Frontend`：管理后台，负责模板、节点类型、AI 模型治理、任务监控、RBAC、通知与运营能力

## 核心能力

### 1. 工作流编排与执行

- 可视化节点编排，覆盖开始、爬虫、AI、数据清洗、条件、转换、循环、合并、延迟、输出、结束等 11 类核心节点
- 基于 DAG 的执行模型，支持节点依赖解析、上下文变量流转、分支与循环处理
- 支持工作流版本化、模板化、项目化管理
- 支持直接执行、流式执行、调度执行与 Webhook 触发

### 2. Alkaid 智能助手

- 支持自然语言描述需求并生成结构化工作流
- 支持会话、消息、流式事件、工作流应用与补丁应用
- 支持能力检索、知识检索、节点规格注入与人机协同确认
- 形成“生成 -> 校验 -> 修正 -> 应用”的闭环式 Agent 体验

### 3. AI 模型与治理能力

- 支持 DeepSeek、豆包、通义千问、讯飞星火、腾讯混元、智谱、OpenAI、Claude、Gemini、Grok 等多模型接入
- 支持系统预设模型、用户自定义模型、后台托管模型三层能力
- 支持模型能力配置、价格配置、使用统计与配额流水

### 4. 数据采集、知识与工件

- 支持网站源管理、爬虫规则管理、动态网页抓取与可用性校验
- 支持项目知识管理与检索测试
- 支持任务结果沉淀为工件，支持下载、邮件发送与开放接口查询
- 输出能力覆盖 JSON、Markdown、Text、PDF、DOCX、Mermaid、Timeline、Sankey、Network、Chart 等格式

### 5. 平台治理

- 用户注册登录、OAuth、邀请码、头像历史、账单与 Token 流水
- RBAC 权限模型、角色管理、管理员体系
- 站内通知、模板、投递任务与分析统计
- 订单、支付、配额恢复、管理员赠送、操作日志

## 典型使用方式

### 用户前台

- 创建项目与工作流
- 在画布中编排节点
- 使用 Alkaid 生成或修补工作流
- 执行任务并查看日志、节点执行记录和产出结果
- 管理模型、订单、账单、通知与个人设置

### 管理后台

- 管理用户、管理员、角色和权限
- 管理工作流模板、节点类型、AI 模型与价格能力
- 监控任务执行情况、失败任务、工件与日志
- 管理爬虫规则、知识库、通知模板与运营数据

## 架构概览

```text
┌──────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  Low_code_Frontend (用户前台)   Admin_Frontend (管理后台)     │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP / SSE / WebSocket
┌──────────────────────────────▼───────────────────────────────┐
│                       Backend API Layer                      │
│   Auth / Project / Workflow / Task / AI / Alkaid / Billing  │
│   Notification / RBAC / Workflow API / Artifact / Payment   │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                      Execution & Service Layer               │
│   DAG Executor / Variable Context / Scheduler / Providers   │
│   Crawler / Knowledge Retrieval / Export / Audit / Quota    │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                        Persistence Layer                     │
│        PostgreSQL                  Redis                     │
└──────────────────────────────────────────────────────────────┘
```

## 技术栈

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| Go | 1.24+ | 核心开发语言 |
| Gin | 1.9+ | Web 框架 |
| GORM | 1.25+ | ORM |
| PostgreSQL | 14+ / 16 容器 | 主数据存储 |
| Redis | 6+ / 7 容器 | 缓存与运行态支撑 |
| JWT | v5 | 认证授权 |
| ChromeDP | 0.14+ | 动态网页抓取 |

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.0 | 用户端与管理端 UI |
| TypeScript | 5.2+ | 类型系统 |
| Ant Design | 6.2 | 组件库 |
| React Flow | 11.10+ | 工作流画布 |
| Zustand | 4.4 | 状态管理 |
| Vite | 5.0 | 构建与开发服务器 |
| Axios | 1.6 | HTTP 客户端 |
| i18next | 25.7 | 国际化 |
| LobeHub UI | 4.21.2 | AI 与现代化 UI 能力补充 |

## 快速开始

### 环境要求

- Go 1.24 或更高版本
- Node.js 18 或更高版本
- PostgreSQL
- Redis

### 1. 克隆项目

```bash
git clone <repository-url>
cd YaoLight_Workshop
```

### 2. 安装依赖

```bash
cd Low_code_Frontend
npm install

cd ../Admin_Frontend
npm install

cd ../Low_code_Backend
go mod download
```

### 3. 配置数据库

```bash
psql -U postgres
CREATE DATABASE workflow_db;
\q
```

### 4. 配置环境变量

后端环境变量示例位于：

- `Low_code_Backend/.env.example`
- `Low_code_Backend/env.example`

建议复制 `.env.example` 为 `.env`：

```bash
cd Low_code_Backend
cp .env.example .env
```

关键配置项包括：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=workflow_db
DB_SSLMODE=disable

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

SERVER_PORT=8080
SERVER_MODE=release
JWT_SECRET=your-secret-key-change-in-production
FRONTEND_URL=http://localhost
UPLOAD_PATH=./uploads

ADMIN_BOOTSTRAP_USERNAME=
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
```

说明：

- `debug` 环境下，若未显式配置管理员引导信息，系统会自动创建默认管理员 `admin / admin123456`
- `release` 环境建议显式配置 `ADMIN_BOOTSTRAP_*`

### 5. 启动服务

#### 方式一：Windows 一键启动

```bash
start-services.bat
```

该脚本会启动：

- 后端：`http://localhost:8080`
- 用户前台：`http://localhost:3000`
- 管理后台：`http://localhost:3200/admin/`

停止可使用：

```bash
stop-services.bat
```

#### 方式二：手动启动

```bash
cd Low_code_Backend
go run cmd/server/main.go
```

```bash
cd Low_code_Frontend
npm run dev
```

```bash
cd Admin_Frontend
npm run dev
```

### 6. Docker 启动

仓库根目录提供：

- `docker-compose.yml`：本地构建启动
- `docker-compose.prod.yml`：生产推荐，配合 CI 镜像部署

快速启动：

```bash
docker compose up -d --build
```

说明：

- 当前 `docker-compose.yml` 默认覆盖数据库、Redis、后端与用户前台
- 生产部署细节请参考 [DEPLOY.md](./DEPLOY.md)

## 访问地址

- 用户前台：`http://localhost:3000`
- 管理后台：`http://localhost:3200/admin/`
- 后端 API：`http://localhost:8080`
- Open API 文档示例：`/open-api/v1/workflows/:slug/docs`

## 仓库结构

```text
YaoLight_Workshop/
├── Low_code_Backend/        # Go 后端
├── Low_code_Frontend/       # 用户前台
├── Admin_Frontend/          # 管理后台
├── docs/                    # 产品、架构、前端、论文等文档
├── deploy/                  # 部署相关资源
├── docker-compose.yml
├── docker-compose.prod.yml
├── DEPLOY.md
├── DEVELOPER_OPS_GUIDE.md
├── start-services.bat
└── stop-services.bat
```

## 文档索引

你可以从下面这些文档继续深入：

- [docs/00-index/01-Docs-Classification-Index.md](./docs/00-index/01-Docs-Classification-Index.md) - 文档总索引
- [Low_code_Backend/README.md](./Low_code_Backend/README.md) - 后端模块与能力说明
- [Low_code_Frontend/README.md](./Low_code_Frontend/README.md) - 用户前台说明
- [DEPLOY.md](./DEPLOY.md) - Docker 与服务器部署说明
- [docs/08-thesis/90-论文写作_全量覆盖清单.md](./docs/08-thesis/90-%E8%AE%BA%E6%96%87%E5%86%99%E4%BD%9C_%E5%85%A8%E9%87%8F%E8%A6%86%E7%9B%96%E6%B8%85%E5%8D%95.md) - 论文覆盖清单
- [docs/08-thesis/91-毕业论文_完整写作底稿.md](./docs/08-thesis/91-%E6%AF%95%E4%B8%9A%E8%AE%BA%E6%96%87_%E5%AE%8C%E6%95%B4%E5%86%99%E4%BD%9C%E5%BA%95%E7%A8%BF.md) - 论文底稿

## 开发说明

### 新增节点类型

后端通常需要：

- 在 `Low_code_Backend/modules/workflow/services/` 增加节点执行逻辑
- 补充节点规格、输入输出与上下文处理
- 在执行器注册流程中接入

前端通常需要：

- 在工作流编辑器中新增节点 UI
- 提供配置面板与校验逻辑
- 补充类型、注册信息与图标样式

### 新增 AI 提供商

- 在后端 Provider 层实现新模型适配
- 注册到工厂或提供商路由中
- 在前端补充对应配置项与管理界面

### 工程习惯

- 后端遵循模块化 DDD 风格组织代码
- 管理类接口统一经过权限与操作日志中间件
- 修改平台能力时优先考虑复用，不把核心逻辑堆在控制器层

## 许可证

本项目采用 [MIT License](./LICENSE)。

## 致谢

> *For her—who on a winter afternoon, the twenty-sixth of December, 2025, at 14:34:24, by the water at Dongjiang Seaside Park in Tianjin, corrected me: they were seagulls, not pigeons—and in that instant I felt the ice I had carried within me begin to thaw.*

感谢这些优秀开源项目提供的灵感与基础能力：

- [React Flow](https://reactflow.dev/)
- [Ant Design](https://ant.design/)
- [Gin](https://gin-gonic.com/)
- [GORM](https://gorm.io/)

---

<div align="center">

**瑶光工坊** - 让工作流设计、执行与进化变得更自然

</div>
