# 瑶光工坊 (YaoLight Workshop)

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Go](https://img.shields.io/badge/Go-1.24+-00ADD8.svg)
![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**基于 Go + React 的前后端分离智能工作流平台**

支持可视化编辑、爬虫采集、AI处理、智能工作流生成等功能

[功能特性](#功能特性) • [快速开始](#快速开始) • [技术文档](#技术文档) • [开发指南](#开发指南)

</div>

---

## 📖 项目简介

瑶光工坊（YaoLight Workshop）是一个**低代码智能工作流平台**，旨在让用户通过直观的可视化拖拽方式，轻松构建复杂的数据采集、处理和AI分析流程。

### 核心价值

- 🎨 **零代码可视化**：通过拖拽节点即可构建完整工作流，无需编写代码
- 🤖 **AI智能生成**：内置瑶光星（Alkaid）AI助手，可通过自然语言对话生成工作流
- 🔄 **强大执行引擎**：支持拓扑排序、并发执行、条件分支、循环处理等复杂流程
- 🌐 **多模型支持**：集成10+主流AI模型提供商，灵活选择最适合的模型
- 📊 **实时监控**：任务执行状态实时追踪，支持日志查看和结果下载
- 🏗️ **项目化管理**：支持多项目、版本管理、模板复用等企业级功能

### 应用场景

- **内容采集与分析**：爬取网页数据，使用AI进行内容分析和摘要
- **数据处理流水线**：数据清洗、转换、验证的自动化流程
- **智能内容生成**：结合多个AI模型进行内容创作和优化
- **业务流程自动化**：将重复性工作流程化，提高效率

## 🛠️ 技术栈

### 后端技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **Go** | 1.24+ | 高性能并发语言，适合工作流执行引擎 |
| **Gin** | 1.9+ | 轻量级Web框架，性能优秀 |
| **GORM** | 1.25+ | Go的ORM框架，简化数据库操作 |
| **PostgreSQL** | 14+ | 关系型数据库，支持JSONB类型 |
| **Redis** | 6.0+ | 缓存和会话存储 |
| **JWT** | v5 | 用户认证与授权 |
| **ChromeDP** | - | 无头浏览器，支持动态网页爬取 |

### 前端技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **React** | 19.0 | UI框架 |
| **TypeScript** | 5.2+ | 类型安全 |
| **Ant Design** | 6.2 | 企业级UI组件库 |
| **React Flow** | 11.10 | 可视化工作流编辑器 |
| **Zustand** | 4.4 | 轻量级状态管理 |
| **Vite** | 5.0 | 现代化构建工具 |
| **Axios** | 1.6 | HTTP请求库 |
| **React Router** | 6.20 | 路由管理 |
| **i18next** | 25.7 | 国际化支持 |

## ✨ 功能特性

### 🎯 核心功能

#### 1. 可视化工作流编辑器
- **拖拽式设计**：通过React Flow实现直观的节点拖拽和连接
- **11种节点类型**：开始、爬虫、AI处理、数据清洗、条件分支、数据转换、循环、合并、延迟、输出、结束
- **实时预览**：配置节点时实时查看效果
- **变量引用系统**：支持 `{{nodeId.variableName}}` 语法，灵活引用上游节点数据
- **工作流导入导出**：支持JSON格式的导入导出，便于分享和备份

#### 2. 工作流执行引擎
- **拓扑排序执行**：自动解析节点依赖关系，按正确顺序执行
- **并发控制**：支持无依赖节点的并行执行，提高效率
- **条件分支**：支持if-else逻辑，根据条件执行不同分支
- **循环处理**：支持对数组数据进行循环处理
- **数据流管理**：节点间数据自动传递，支持复杂数据结构
- **错误处理**：完善的错误捕获和日志记录机制

#### 3. 瑶光星AI助手（Alkaid）
- **对话式交互**：通过自然语言对话生成工作流
- **智能知识检索**：内置29条知识库，自动检索相关使用说明和最佳实践
- **工作流理解**：AI理解所有节点规格、I/O定义、配置规则
- **JSON自动提取**：从AI回复中自动提取工作流JSON并导入编辑器
- **多会话管理**：支持多个对话会话，保留历史上下文

#### 4. 多AI模型支持
支持10+主流AI模型提供商：
- **国产模型**：DeepSeek、豆包、通义千问、讯飞星火、腾讯混元、智谱AI
- **国际模型**：OpenAI GPT、Claude、Gemini、Grok（通过OpenRouter）
- **灵活配置**：支持系统预设、用户保存、自定义三种配置模式
- **成本管理**：支持Stardust计费系统，实时追踪token消耗

#### 5. 爬虫功能
- **智能提取**：支持智能提取、CSS选择器、XPath等多种提取模式
- **动态网页**：基于ChromeDP支持JavaScript渲染的动态网页
- **反爬虫应对**：支持请求头、Cookie、代理等配置
- **数据格式**：支持文本、HTML、JSON等多种数据格式输出

#### 6. 项目管理
- **多项目支持**：用户可以创建多个项目，分类管理工作流
- **版本管理**：工作流支持版本控制，可回退到历史版本
- **模板系统**：支持将工作流保存为模板，快速复用
- **协作功能**：支持工作流分享和公开

#### 7. 任务管理
- **任务历史**：完整记录所有任务执行历史
- **实时监控**：任务执行状态实时更新，支持WebSocket推送
- **日志查看**：详细的节点执行日志，便于问题排查
- **结果下载**：支持任务结果导出和下载
- **任务控制**：支持任务启动、暂停、取消等操作

### 👨‍💼 管理员端功能

- ✅ **用户管理**：用户列表、信息编辑、状态管理、权限分配
- ✅ **工作流模板管理**：模板创建、编辑、发布、分类管理
- ✅ **节点类型管理**：节点类型定义、配置规则、图标样式
- ✅ **爬虫规则管理**：规则模板库、规则测试、版本管理
- ✅ **AI模型配置管理**：模型接入配置、参数设置、调用统计
- ✅ **任务执行监控**：实时任务列表、执行状态、性能分析
- ✅ **运行日志管理**：系统日志查询、操作审计、错误分析
- ✅ **数据统计分析**：用户活跃度、工作流执行统计、资源使用
- ✅ **系统配置管理**：系统参数、邮件/短信配置、存储配置

### 👤 用户端功能

- ✅ **用户认证**：注册、登录、密码找回、个人信息管理
- ✅ **可视化编辑器**：拖拽式工作流设计、节点配置、实时预览
- ✅ **工作流管理**：创建、编辑、删除、版本管理、模板应用
- ✅ **任务执行**：任务创建、实时状态查看、日志查看、结果下载
- ✅ **个人中心**：个人信息、历史记录、使用统计、账单管理
- ✅ **AI助手**：瑶光星对话、工作流生成、问题解答

## 🚀 快速开始

### 环境要求

- **Go**: 1.24 或更高版本
- **Node.js**: 18.0 或更高版本
- **PostgreSQL**: 14.0 或更高版本
- **Redis**: 6.0 或更高版本

### 安装步骤

#### 1. 克隆项目

```bash
git clone <repository-url>
cd "Graduation project"
```

#### 2. 安装依赖

```bash
# 安装前端依赖
cd Low_code_Frontend
npm install

# 安装后端依赖（Go会自动下载）
cd ../Low_code_Backend
go mod download
```

#### 3. 配置数据库

```bash
# 使用PostgreSQL创建数据库
psql -U postgres
CREATE DATABASE workflow_db;
\q
```

#### 4. 配置环境变量

复制后端环境变量示例文件：

```bash
cd Low_code_Backend
cp env.example .env
```

编辑 `.env` 文件，配置以下内容：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=workflow_db
DB_SSLMODE=disable

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your_jwt_secret_key_here

# 服务器配置
SERVER_PORT=8080
SERVER_HOST=localhost

# AI模型API密钥（可选，根据需要配置）
DEEPSEEK_API_KEY=your_deepseek_api_key
DOUBAO_API_KEY=your_doubao_api_key
QWEN_API_KEY=your_qwen_api_key
SPARK_API_PASSWORD=your_spark_api_password
HUNYUAN_API_KEY=your_hunyuan_api_key
ZHIPUAI_API_KEY=your_zhipuai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# 邮件配置（可选）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASSWORD=your_email_password
```

#### 5. 启动服务

**方式一：使用批处理脚本（Windows）**

```bash
# 启动所有服务
start-services.bat

# 停止所有服务
stop-services.bat
```

**方式二：手动启动**

```bash
# 启动后端服务（在 Low_code_Backend 目录）
cd Low_code_Backend
go run cmd/server/main.go

# 启动前端服务（在 Low_code_Frontend 目录，新终端）
cd Low_code_Frontend
npm run dev
```

#### 6. 访问应用

- **前端地址**: http://localhost:5173 (Vite默认端口)
- **后端API**: http://localhost:8080
- **API文档**: http://localhost:8080/api/docs (开发完成后)

### 默认账号

首次启动后，系统会自动创建默认管理员账号（如果数据库为空）：
- **用户名**: admin
- **密码**: admin123（请首次登录后修改）

> ⚠️ **注意**: 生产环境请务必修改默认密码！

## 📁 项目结构

```
Graduation project/
├── Low_code_Backend/              # 后端服务
│   ├── cmd/
│   │   └── server/                # 服务入口
│   │       └── main.go
│   ├── modules/                   # 业务模块
│   │   ├── ai/                    # AI模型管理
│   │   │   ├── controllers/       # 控制器
│   │   │   ├── services/          # 业务逻辑
│   │   │   │   ├── providers/     # AI提供商实现
│   │   │   │   │   ├── deepseek/
│   │   │   │   │   ├── doubao/
│   │   │   │   │   ├── qwen/
│   │   │   │   │   └── ...        # 其他提供商
│   │   │   │   ├── ai_service.go
│   │   │   │   └── model_config.go
│   │   │   ├── models/            # 数据模型
│   │   │   └── repositories/      # 数据访问层
│   │   ├── alkaid/                # 瑶光星AI助手
│   │   │   ├── services/
│   │   │   │   ├── alkaid_service.go
│   │   │   │   ├── capabilities_service.go
│   │   │   │   ├── knowledge_service.go
│   │   │   │   └── prompt_builder.go
│   │   │   └── models/
│   │   ├── workflow/              # 工作流核心模块
│   │   │   ├── services/
│   │   │   │   ├── workflow_executor.go    # 执行引擎
│   │   │   │   ├── data_flow.go            # 数据流管理
│   │   │   │   ├── variable_context.go      # 变量上下文
│   │   │   │   ├── start_node.go           # 节点执行器
│   │   │   │   ├── crawler_node.go
│   │   │   │   ├── ai_node.go
│   │   │   │   └── ...
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   └── repositories/
│   │   ├── crawler/               # 爬虫模块
│   │   ├── dataclean/             # 数据清洗模块
│   │   ├── task/                   # 任务管理
│   │   ├── user/                   # 用户管理
│   │   ├── project/                # 项目管理
│   │   └── ...
│   ├── domain/                    # 领域层
│   │   ├── entity/                # 实体定义
│   │   └── repository/            # 仓储接口
│   ├── infrastructure/            # 基础设施层
│   │   ├── database/              # 数据库连接
│   │   ├── redis/                 # Redis连接
│   │   ├── jwt/                   # JWT认证
│   │   ├── middleware/            # 中间件
│   │   ├── config/                # 配置管理
│   │   └── email/                 # 邮件服务
│   ├── migrations/                # 数据库迁移
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_workflow_comment_cards.sql
│   │   └── ...
│   ├── go.mod
│   └── go.sum
│
├── Low_code_Frontend/             # 前端应用
│   ├── src/
│   │   ├── pages/                 # 页面组件
│   │   │   ├── Login/             # 登录页
│   │   │   ├── Dashboard/         # 仪表盘
│   │   │   ├── ProjectDetail/     # 项目详情
│   │   │   ├── Settings/          # 设置页面
│   │   │   │   ├── Profile/       # 个人资料
│   │   │   │   ├── Models/        # AI模型管理
│   │   │   │   └── Billing/       # 账单管理
│   │   │   └── Payment/           # 支付页面
│   │   ├── components/            # 通用组件
│   │   │   ├── WorkflowEditor/   # 工作流编辑器（核心）
│   │   │   │   ├── nodes/         # 节点组件
│   │   │   │   │   ├── StartNode/
│   │   │   │   │   ├── CrawlerNode/
│   │   │   │   │   ├── AINode/
│   │   │   │   │   └── ...
│   │   │   │   ├── configs/       # 节点配置面板
│   │   │   │   ├── panels/        # 侧边栏面板
│   │   │   │   ├── providers/     # AI提供商UI
│   │   │   │   └── hooks/         # 自定义Hooks
│   │   │   ├── Alkaid/            # 瑶光星AI助手组件
│   │   │   ├── Layout/            # 布局组件
│   │   │   └── ...
│   │   ├── api/                   # API服务
│   │   │   ├── workflow.ts
│   │   │   ├── task.ts
│   │   │   ├── ai.ts
│   │   │   ├── alkaid.ts
│   │   │   └── ...
│   │   ├── store/                 # 状态管理
│   │   │   ├── auth.ts            # 认证状态
│   │   │   └── theme.ts           # 主题状态
│   │   ├── types/                 # TypeScript类型定义
│   │   ├── utils/                 # 工具函数
│   │   ├── hooks/                 # 自定义Hooks
│   │   ├── http/                  # HTTP客户端
│   │   ├── i18n/                  # 国际化
│   │   └── routes/                # 路由配置
│   ├── public/                    # 静态资源
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                          # 项目文档
│   ├── 技术方案.md
│   ├── 工作流执行引擎详解.md
│   ├── 数据库设计.md
│   └── ...
│
├── README.md                      # 项目说明
├── 技术方案.md                    # 技术方案文档
└── start-services.bat             # Windows启动脚本
```

## 🎯 核心节点类型

系统支持以下11种节点类型，覆盖从数据采集到结果输出的完整流程：

| 节点类型 | 图标 | 功能说明 | 主要配置 |
|---------|------|---------|---------|
| **开始节点** | 🟢 | 工作流入口，定义初始数据 | 初始数据（JSON格式） |
| **爬虫节点** | 🔵 | 网页数据采集 | URL、提取模式、选择器 |
| **AI处理节点** | 🟣 | AI模型调用处理 | 模型选择、提示词、参数 |
| **数据清洗节点** | 🟢 | 数据清理和格式化 | 清洗规则、过滤条件 |
| **条件分支节点** | 🟡 | 条件判断和分支 | 判断表达式、条件逻辑 |
| **数据转换节点** | 🔷 | 数据格式转换 | 转换规则、映射关系 |
| **循环处理节点** | 🟣 | 数组循环处理 | 循环变量、迭代逻辑 |
| **合并分支节点** | 🔵 | 合并多个分支数据 | 合并策略 |
| **延迟等待节点** | ⏱️ | 延迟执行 | 延迟时间（秒） |
| **结果输出节点** | 🟠 | 结果输出和保存 | 输出格式、存储位置 |
| **结束节点** | 🔴 | 工作流出口 | - |

### 变量引用系统

节点间通过变量引用实现数据传递，支持以下语法：

```javascript
// 完整路径引用
{{nodeId.variableName}}

// 嵌套属性访问
{{start-1.data.url}}

// 自动查找（在所有节点中查找同名变量）
{{variableName}}
```

**示例**：
- 爬虫节点引用开始节点的URL：`{{start-1.data.url}}`
- AI节点引用爬虫节点的文本：`{{crawler-1.text}}`
- 条件节点判断数据：`{{dataclean-1.cleaned.length > 0}}`

## 🏗️ 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────┐
│              前端层 (React + TypeScript)          │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ 用户界面     │  │ 工作流编辑器 │            │
│  │ 项目管理     │  │ 瑶光星AI助手 │            │
│  └──────────────┘  └──────────────┘            │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────────────────┐
│           后端API层 (Go + Gin)                    │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ 业务逻辑层   │  │ 工作流执行引擎│            │
│  │ 用户管理     │  │ 节点执行器   │            │
│  │ AI服务       │  │ 数据流管理   │            │
│  └──────────────┘  └──────────────┘            │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│           数据层                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ PostgreSQL   │  │ Redis        │            │
│  │ 业务数据     │  │ 缓存/会话    │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘
```

### 工作流执行流程

```
1. 用户创建工作流（可视化编辑器）
   ↓
2. 保存工作流配置（JSON格式）
   ↓
3. 创建执行任务
   ↓
4. 工作流执行引擎
   ├─ 解析工作流配置
   ├─ 拓扑排序（确定执行顺序）
   ├─ 初始化数据流和变量上下文
   └─ 按顺序执行节点
       ├─ 获取节点配置
       ├─ 解析变量引用
       ├─ 调用对应执行器
       ├─ 保存输出数据
       └─ 触发下游节点
   ↓
5. 返回执行结果
   ↓
6. 保存任务历史
```

## 📚 技术文档

项目包含详细的技术文档，帮助开发者深入理解系统：

- **[技术方案.md](./技术方案.md)** - 完整的技术方案设计
- **[工作流执行引擎详解.md](./工作流执行引擎详解.md)** - 执行引擎核心原理
- **[数据库设计.md](./数据库设计.md)** - 数据库表结构设计
- **[节点上下文传递设计方案.md](./节点上下文传递设计方案.md)** - 数据传递机制
- **[瑶光工坊开发全景规划.md](./瑶光工坊开发全景规划.md)** - 开发规划

## 🔧 开发指南

### 开发环境设置

1. **安装开发工具**
   - Go开发环境：https://golang.org/dl/
   - Node.js环境：https://nodejs.org/
   - PostgreSQL：https://www.postgresql.org/download/
   - Redis：https://redis.io/download/

2. **IDE推荐**
   - Go开发：GoLand 或 VS Code + Go插件
   - 前端开发：WebStorm 或 VS Code + React插件

3. **代码规范**
   - Go代码遵循 `gofmt` 和 `golint` 规范
   - TypeScript代码遵循 ESLint 规范
   - 提交前运行 `go fmt` 和 `npm run lint`

### 添加新节点类型

1. **后端实现**
   - 在 `modules/workflow/services/` 创建节点执行器
   - 在 `variable_context.go` 中添加I/O定义
   - 在 `workflow_executor.go` 中注册执行器

2. **前端实现**
   - 在 `components/WorkflowEditor/nodes/` 创建节点组件
   - 在 `components/WorkflowEditor/configs/` 创建配置面板
   - 在 `index.tsx` 中注册节点类型

### 添加新AI模型提供商

1. 在 `modules/ai/services/providers/` 创建提供商目录
2. 实现 `AIModelProvider` 接口
3. 在 `provider_factory.go` 中注册提供商
4. 在前端 `components/WorkflowEditor/providers/` 添加UI组件

详细开发指南请参考 [技术方案.md](./技术方案.md)

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 更新日志

### v1.0.0 (当前版本)

- ✅ 完整的可视化工作流编辑器
- ✅ 11种核心节点类型
- ✅ 工作流执行引擎
- ✅ 瑶光星AI助手
- ✅ 10+ AI模型支持
- ✅ 任务管理和监控
- ✅ 项目管理系统
- ✅ 用户认证和权限管理

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 许可证。

## 🙏 致谢

感谢以下开源项目的支持：

- [React Flow](https://reactflow.dev/) - 工作流可视化
- [Ant Design](https://ant.design/) - UI组件库
- [Gin](https://gin-gonic.com/) - Web框架
- [GORM](https://gorm.io/) - ORM框架

---

<div align="center">

**瑶光工坊** - 让工作流设计变得简单

Made with ❤️ by 孤芳不自赏

</div>