# 瑶光工坊 (YaoLight Workshop) - 后端服务

## 架构说明

瑶光工坊后端采用**模块化领域驱动设计（Modular DDD）**架构，结合微服务风格的模块组织。

### 目录结构

```
Low_code_Backend/
├── cmd/                          # 应用入口
│   └── server/
│       └── main.go
│
├── modules/                      # 业务模块（类似微服务）
│   ├── user/                     # 用户模块
│   │   ├── models/              # 持久化实体（GORM）
│   │   ├── repositories/         # 仓储实现（实现 domain/repository 接口）
│   │   ├── services/             # 应用服务（使用 Repository）
│   │   └── controllers/          # HTTP控制器
│   │
│   ├── workflow/                 # 工作流模块
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── controllers/
│   │
│   ├── task/                     # 任务模块
│   ├── crawler/                  # 爬虫模块
│   ├── ai/                       # AI模块
│   ├── file/                     # 文件模块
│   └── notification/             # 通知模块
│
├── domain/                       # 领域层（共享）
│   ├── entity/                   # 领域实体（纯业务对象，不依赖 GORM）
│   │   └── user.go               # 用户领域实体
│   └── repository/               # 仓储接口定义
│       └── user_repository.go   # 用户仓储接口
│
├── infrastructure/               # 基础设施层（共享）
│   ├── config/                   # 配置管理
│   ├── database/                 # 数据库连接
│   └── shared/                   # 共享工具（JSONB等）
│
└── interfaces/                   # 接口层（共享）
    └── middleware/               # 中间件
```

## 模块化设计原则

1. **高内聚**：每个模块包含完整的业务逻辑（models, repositories, services, controllers）
2. **低耦合**：模块间通过接口通信，不直接依赖
3. **可扩展**：新增功能只需添加新模块
4. **易维护**：每个模块独立，便于维护和测试

## 快速开始

### 1. 安装依赖
```bash
cd Low_code_Backend
go mod download
go mod tidy
```

### 2. 配置环境变量
复制 `.env.example` 为 `.env` 并修改配置

### 3. 创建数据库
```bash
psql -U postgres
CREATE DATABASE yaolight_workshop_db;
\q
```

### 4. 运行服务
```bash
go run cmd/server/main.go
```
