# 工作流管理系统

基于 Go + React 的前后端分离工作流管理平台，支持可视化编辑、爬虫采集、AI处理等功能。

## 项目简介

本系统是一个低代码工作流管理平台，允许用户通过拖拽方式配置内容采集与处理流程。系统分为管理员端和用户端，支持工作流的创建、执行、监控和管理。

## 技术栈

### 后端
- **语言**: Go 1.21+
- **框架**: Gin
- **ORM**: GORM
- **数据库**: PostgreSQL 14+
- **缓存**: Redis
- **认证**: JWT

### 前端
- **框架**: React 18 + TypeScript
- **UI库**: Ant Design 5
- **工作流编辑器**: React Flow
- **状态管理**: Zustand
- **HTTP客户端**: Axios

## 功能特性

### 管理员端
- ✅ 用户管理
- ✅ 工作流模板管理
- ✅ 节点类型管理
- ✅ 爬虫规则管理
- ✅ AI模型配置管理
- ✅ 任务执行监控
- ✅ 运行日志管理
- ✅ 数据统计分析
- ✅ 系统配置管理

### 用户端
- ✅ 用户注册/登录
- ✅ 可视化工作流编辑器
- ✅ 工作流版本管理
- ✅ 任务执行控制
- ✅ 实时状态监控
- ✅ 结果查看与下载
- ✅ 个人中心

## 快速开始

### 环境要求
- Go 1.21+
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### 安装步骤

1. 克隆项目
```bash
git clone <repository-url>
cd workflow-management-system
```

2. 安装依赖
```bash
npm run install:all
```

3. 配置数据库
```bash
# 创建数据库
psql -U postgres
CREATE DATABASE workflow_db;
```

4. 配置环境变量
```bash
# 后端配置 server/.env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=workflow_db
DB_SSLMODE=disable
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret
```

5. 运行数据库迁移（启动时自动执行）
```bash
cd server
go run cmd/server/main.go
```

6. 启动服务
```bash
# 开发模式（同时启动前后端）
npm run dev

# 或分别启动
npm run dev:server  # 后端服务 http://localhost:8080
npm run dev:client  # 前端服务 http://localhost:3000
```

## 项目结构

```
workflow-management-system/
├── server/              # 后端服务
│   ├── cmd/            # 命令行工具
│   ├── internal/       # 内部代码
│   ├── config/         # 配置
│   └── migrations/     # 数据库迁移
├── client/             # 前端应用
│   ├── src/
│   │   ├── pages/      # 页面
│   │   ├── components/ # 组件
│   │   └── services/   # API服务
├── docs/               # 文档
└── docker/            # Docker配置
```

## API文档

API文档地址: `http://localhost:8080/api/docs` (开发完成后)

## 开发指南

详细开发指南请参考 [技术方案.md](./技术方案.md)

## 许可证

MIT License

