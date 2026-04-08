# 瑶光工坊 (YaoLight Workshop)

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Go](https://img.shields.io/badge/Go-1.24+-00ADD8.svg)
![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

把工作流编辑、执行、AI 协作和日常管理放在同一个工作台里。

[项目概览](#项目概览) · [快速开始](#快速开始) · [仓库结构](#仓库结构) · [文档入口](#文档入口)

</div>

---

## 项目概览

`YaoLight Workshop` 是这个仓库的名字。

这里主要放了三部分内容：

- `Low_code_Frontend`：用户前台，负责项目、工作流画布、任务执行、Alkaid 交互等功能
- `Admin_Frontend`：管理端，负责模板、模型、任务、用户与站点配置相关页面
- `Low_code_Backend`：Go 后端，负责认证、工作流执行、AI 接入、爬取、账单、通知等服务

如果只想快速理解它在做什么，可以先把它看成一个围绕“工作流”展开的工程：

- 在画布里编排节点
- 用 Alkaid 通过对话生成或修补工作流
- 提交任务并查看执行日志、结果和历史记录
- 管理模型配置、模板、项目、用户和一些站点侧能力

## 主要内容

- 可视化工作流编辑，基于 React Flow 组织节点与连线
- 工作流执行逻辑在后端完成，支持依赖解析、变量传递、分支和循环
- Alkaid 提供对话式生成、补丁应用和知识检索能力
- 已接入多家 AI 模型提供商，前后端都有对应配置与调用逻辑
- 提供爬虫、任务记录、结果导出、通知、支付与账单等配套模块
- 仓库中同时保留了用户前台、管理端和部署相关文件，方便联调与发布

## 技术栈

### 后端

- Go 1.24
- Gin
- GORM
- PostgreSQL
- Redis
- JWT
- ChromeDP

### 前端

- React 19
- TypeScript
- Vite
- Ant Design
- React Flow
- Zustand
- Axios
- i18next

## 快速开始

### 环境要求

- Go 1.24 或更高版本
- Node.js 18 或更高版本
- PostgreSQL
- Redis

### 1. 克隆仓库

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

### 3. 准备数据库

```bash
psql -U postgres
CREATE DATABASE workflow_db;
\q
```

### 4. 配置环境变量

后端示例文件在：

- `Low_code_Backend/.env.example`
- `Low_code_Backend/env.example`

通常复制一份为 `.env` 即可：

```bash
cd Low_code_Backend
cp .env.example .env
```

至少需要先确认这些字段：

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
FRONTEND_URL=http://localhost:3000
```

补充说明：

- `debug` 环境下，如果没有显式配置管理员引导信息，系统会自动创建默认管理员
- 生产环境建议显式设置 `ADMIN_BOOTSTRAP_USERNAME`、`ADMIN_BOOTSTRAP_EMAIL`、`ADMIN_BOOTSTRAP_PASSWORD`
- AI、OAuth、支付、对象存储等相关变量按需填写即可

### 5. 启动服务

Windows 下可以直接使用根目录脚本：

```bash
start-services.bat
```

停止服务：

```bash
stop-services.bat
```

也可以分别手动启动：

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

### 6. 默认访问地址

- 用户前台：`http://localhost:3000`
- 管理端：`http://localhost:3200/admin/`
- 后端 API：`http://localhost:8080`

### 7. Docker

仓库根目录提供了：

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `DEPLOY.md`

本地快速启动：

```bash
docker compose up -d --build
```

如果是部署场景，建议再看一眼 `DEPLOY.md`。

## 仓库结构

```text
YaoLight_Workshop/
├── Low_code_Backend/        # Go 后端
├── Low_code_Frontend/       # 用户前台
├── Admin_Frontend/          # 管理端
├── docs/                    # 设计、开发、论文与索引文档
├── deploy/                  # 部署相关资源
├── docker-compose.yml
├── docker-compose.prod.yml
├── DEPLOY.md
├── DEVELOPER_OPS_GUIDE.md
├── start-services.bat
└── stop-services.bat
```

## 文档入口

- [docs/00-index/01-Docs-Classification-Index.md](./docs/00-index/01-Docs-Classification-Index.md)
- [Low_code_Backend/README.md](./Low_code_Backend/README.md)
- [Low_code_Frontend/README.md](./Low_code_Frontend/README.md)
- [DEPLOY.md](./DEPLOY.md)
- [DEVELOPER_OPS_GUIDE.md](./DEVELOPER_OPS_GUIDE.md)

## 开发补充

如果你准备继续扩展这个仓库，通常会从下面这些位置开始：

- 新增工作流节点：`Low_code_Backend/modules/workflow/services/` 与前端画布相关目录
- 调整 Alkaid：`Low_code_Backend/modules/alkaid/`
- 调整模型接入：`Low_code_Backend/modules/ai/`
- 改用户前台：`Low_code_Frontend/src/`
- 改管理端：`Admin_Frontend/src/`

## 许可证

本项目使用 [MIT License](./LICENSE)。

## 致谢

> *For her, who on a winter afternoon, the twenty-sixth of December, 2025, at 14:34:24, by the water at Dongjiang Seaside Park in Tianjin, corrected me: they were seagulls, not pigeons, and in that instant I felt the ice I had carried within me begin to thaw.*

感谢这些项目提供的基础能力与灵感：

- [React Flow](https://reactflow.dev/)
- [Ant Design](https://ant.design/)
- [Gin](https://gin-gonic.com/)
- [GORM](https://gorm.io/)

---

<div align="center">

瑶光工坊 - 让工作流设计变得简单

Made with ❤️ by 孤芳不自赏

</div>
