# AI 模块文件结构设计（优化版）

## 设计理念

每个AI模型提供商（OpenAI、Claude、Google等）都有独立的文件夹，包含该提供商的所有配置、实现和特定逻辑。

## 目录结构

```
modules/ai/
├── controllers/
│   └── ai_controller.go              # AI模型管理控制器（CRUD）
│
├── models/
│   └── ai_model.go                   # AI模型配置持久化实体（已有）
│
├── repositories/
│   └── ai_model_repository.go        # AI模型仓储实现
│
├── services/
│   ├── ai_service.go                 # AI服务统一接口和工厂
│   ├── ai_executor.go                # AI执行器（用于工作流节点）
│   │
│   └── providers/                    # 各个AI服务提供商
│       ├── interface.go              # 提供商统一接口定义
│       │
│       ├── openai/                   # OpenAI提供商
│       │   ├── openai_provider.go   # OpenAI服务实现
│       │   ├── openai_config.go     # OpenAI配置结构
│       │   ├── openai_client.go     # OpenAI客户端封装
│       │   └── models.go             # OpenAI模型定义（gpt-3.5, gpt-4等）
│       │
│       ├── claude/                   # Claude (Anthropic) 提供商
│       │   ├── claude_provider.go   # Claude服务实现
│       │   ├── claude_config.go     # Claude配置结构
│       │   ├── claude_client.go     # Claude客户端封装
│       │   └── models.go             # Claude模型定义
│       │
│       ├── google/                   # Google Gemini 提供商
│       │   ├── google_provider.go   # Google服务实现
│       │   ├── google_config.go     # Google配置结构
│       │   ├── google_client.go     # Google客户端封装
│       │   └── models.go             # Google模型定义
│       │
│       ├── azure/                    # Azure OpenAI 提供商
│       │   ├── azure_provider.go    # Azure服务实现
│       │   ├── azure_config.go      # Azure配置结构
│       │   ├── azure_client.go      # Azure客户端封装
│       │   └── models.go             # Azure模型定义
│       │
│       └── custom/                   # 自定义提供商（本地模型等）
│           ├── custom_provider.go  # 自定义服务实现
│           ├── custom_config.go    # 自定义配置结构
│           ├── custom_client.go    # 自定义客户端封装
│           └── models.go            # 自定义模型定义
│
└── utils/                            # 共享工具（可选）
    ├── token_counter.go              # Token计数工具
    └── rate_limiter.go               # 限流工具
```

## 领域层（domain/）

```
domain/
├── entity/
│   └── ai_model.go                   # AI模型领域实体
│
└── repository/
    └── ai_model_repository.go        # AI模型仓储接口
```

## 详细说明

### 1. 领域层（domain/）

#### domain/entity/ai_model.go
- 定义AI模型的领域实体（纯业务对象）
- 不依赖GORM，只包含业务逻辑

#### domain/repository/ai_model_repository.go
- 定义AI模型仓储接口
- 包含CRUD操作和查询方法

### 2. 模块层（modules/ai/）

#### models/ai_model.go
- 已有，GORM持久化实体
- 存储模型配置到数据库

#### repositories/ai_model_repository.go
- 实现 domain/repository 接口
- 负责数据库操作

#### services/ai_service.go
- 定义统一的AI服务接口
- 实现工厂模式，根据provider创建对应的服务实例
- 管理服务注册和查找

#### services/providers/interface.go
- 定义所有提供商必须实现的统一接口
- 包含 Chat、Complete、Embed 等方法

#### services/providers/{provider}/
每个提供商文件夹包含：
- `{provider}_provider.go` - 实现 interface.go 中定义的接口
- `{provider}_config.go` - 该提供商特有的配置结构（可能很复杂）
- `{provider}_client.go` - 封装HTTP客户端、认证等
- `models.go` - 该提供商支持的模型列表和配置

#### services/ai_executor.go
- 用于工作流节点的AI执行器
- 调用 ai_service 执行AI任务

#### controllers/ai_controller.go
- HTTP接口层
- 提供模型管理的CRUD接口
- 提供AI调用接口

## 数据流转

```
HTTP请求
  ↓
controllers/ai_controller.go
  ↓
services/ai_service.go (工厂)
  ↓
services/providers/openai/openai_provider.go (具体实现)
  ↓
services/providers/openai/openai_client.go (HTTP客户端)
  ↓
外部API调用
```

## 优势

1. **高内聚**：每个提供商的所有代码和配置都在一个文件夹内
2. **低耦合**：不同提供商之间完全独立，互不影响
3. **易扩展**：新增提供商只需添加新文件夹，无需修改现有代码
4. **配置清晰**：每个提供商的复杂配置都有独立文件管理
5. **易于维护**：修改某个提供商的代码不会影响其他提供商
6. **符合DDD**：遵循项目的领域驱动设计架构

## 示例：OpenAI 文件夹结构

```
services/providers/openai/
├── openai_provider.go    # 实现 AIProvider 接口
├── openai_config.go      # OpenAIConfig 结构（包含所有配置项）
├── openai_client.go      # 封装 OpenAI API 调用
└── models.go             # 定义支持的模型：
                          # - gpt-4
                          # - gpt-4-turbo
                          # - gpt-3.5-turbo
                          # - text-embedding-ada-002
                          # 等
```

## 配置示例

每个提供商的配置可能不同：

- **OpenAI**: API Key, Organization ID, Base URL
- **Claude**: API Key, Version, Max Tokens
- **Google**: API Key, Project ID, Region
- **Azure**: Endpoint, API Key, Deployment Name, API Version
- **Custom**: Endpoint, Auth Type, Custom Headers, etc.

每个配置都在对应的 `{provider}_config.go` 中定义，便于管理和验证。

