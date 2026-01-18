# AI节点功能设计文档

## 一、需求概述

AI节点需要支持两种使用模式：
1. **用户模型模式**：用户从自己配置的模型列表中选择一个已保存的模型（基于系统预设的供应商模板）
2. **自定义配置模式**：用户不想使用已保存的模型，直接在节点配置中输入模型参数（API Key、Endpoint等）

### 核心概念

- **供应商模板**：系统预设的AI供应商配置模板（如 OpenAI、Claude、Google 等），不包含 API Key，只包含默认配置
- **用户模型配置**：用户基于供应商模板创建的模型配置，包含 API Key 等敏感信息，与用户绑定
- **模型供应面板**：每个用户管理自己模型配置的界面

## 二、设计目标

1. **用户隔离**：每个用户只能看到和使用自己创建的模型配置
2. **模板化**：系统提供供应商模板，用户基于模板快速创建模型配置
3. **灵活性**：支持使用已保存模型和临时自定义配置两种方式
4. **安全性**：API Key等敏感信息加密存储，用户数据隔离
5. **可扩展性**：支持多种AI提供商（OpenAI、Claude、Google、Azure、Custom等）

## 三、数据结构设计

### 3.1 供应商模板表设计

新增 `ai_provider_templates` 表，存储系统预设的供应商模板：

```sql
CREATE TABLE ai_provider_templates (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL UNIQUE,  -- openai, azure, anthropic, google, custom
    name VARCHAR(100) NOT NULL,            -- 显示名称：OpenAI, Claude, Google等
    description TEXT,                       -- 供应商描述
    icon VARCHAR(100),                     -- 图标
    default_base_url VARCHAR(500),         -- 默认Base URL
    default_endpoint VARCHAR(500),          -- 默认Endpoint
    supported_models JSONB NOT NULL DEFAULT '[]',  -- 支持的模型列表
    config_schema JSONB NOT NULL DEFAULT '{}',     -- 配置表单结构
    default_config JSONB NOT NULL DEFAULT '{}',    -- 默认配置参数
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**示例数据**：
```json
{
  "provider": "openai",
  "name": "OpenAI",
  "description": "OpenAI GPT系列模型",
  "default_base_url": "https://api.openai.com/v1",
  "supported_models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
  "default_config": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

### 3.2 用户模型配置表（ai_models）

`ai_models` 表存储用户创建的模型配置：

```go
// AIModel 模型说明
type AIModel struct {
    ID               uint           `gorm:"primaryKey" json:"id"`
    Name             string         `gorm:"type:varchar(100);not null" json:"name"`
    Provider         string         `gorm:"type:varchar(50);not null;index" json:"provider"`
    ModelName        string         `gorm:"type:varchar(100);not null" json:"model_name"`
    APIKeyEncrypted  string         `gorm:"type:text;not null" json:"-"`  // 加密存储
    Endpoint         *string        `gorm:"type:varchar(500)" json:"endpoint"`
    BaseURL          *string        `gorm:"type:varchar(500)" json:"base_url"`
    // ... 其他字段 ...
    CreatedBy        *uint          `gorm:"index" json:"created_by"`  // 用户ID，用于绑定
    // ... 时间戳等 ...
}
```

**说明**：
- `CreatedBy` 字段用于绑定用户，每个用户只能看到自己创建的模型
- 查询时使用 `WHERE created_by = ?` 过滤

### 3.3 AI节点配置结构

AI节点的 `config` 字段支持两种配置模式：

#### 模式1：使用用户已保存的模型（推荐）

```json
{
  "modelMode": "saved",
  "modelId": 1,              // 用户自己创建的模型ID
  "prompt": "请分析以下内容：{{content}}",
  "contentVariable": "",     // 可选：输入内容变量路径
  "temperature": 0.7,        // 可选：覆盖模型的temperature
  "maxTokens": 2000          // 可选：覆盖模型的maxTokens
}
```

#### 模式2：自定义配置（临时使用，不保存）

```json
{
  "modelMode": "custom",
  "provider": "openai",      // 提供商：openai, azure, anthropic, google, custom
  "modelName": "gpt-3.5-turbo",
  "apiKey": "sk-xxx",        // API密钥（前端传输时明文，仅内存使用）
  "baseUrl": "https://api.openai.com/v1",  // 可选
  "endpoint": "",            // 可选：自定义端点
  "prompt": "请分析以下内容：{{content}}",
  "contentVariable": "",
  "temperature": 0.7,
  "maxTokens": 2000,
  "topP": 1.0,              // 可选
  "frequencyPenalty": 0.0,   // 可选
  "presencePenalty": 0.0,    // 可选
  "systemPrompt": "",        // 可选：系统提示词
  "stopSequences": []        // 可选：停止序列
}
```

### 3.4 数据初始化

系统启动时，初始化供应商模板：

```go
// 初始化供应商模板
providerTemplates := []ProviderTemplate{
    {
        Provider: "openai",
        Name: "OpenAI",
        Description: "OpenAI GPT系列模型",
        DefaultBaseURL: "https://api.openai.com/v1",
        SupportedModels: []string{"gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"},
        DefaultConfig: map[string]interface{}{
            "temperature": 0.7,
            "maxTokens": 2000,
        },
    },
    {
        Provider: "anthropic",
        Name: "Claude (Anthropic)",
        Description: "Anthropic Claude系列模型",
        DefaultBaseURL: "https://api.anthropic.com",
        SupportedModels: []string{"claude-3-opus", "claude-3-sonnet", "claude-3-haiku"},
        // ...
    },
    // ... 其他供应商
}
```

## 四、功能流程设计

### 4.1 用户模型管理流程

```
用户进入模型管理页面
    ↓
查看供应商模板列表（系统预设）
    ↓
选择供应商模板（如 OpenAI）
    ↓
填写模型配置表单
    ├─→ 模型名称（如：我的GPT-4配置）
    ├─→ 选择具体模型（gpt-4, gpt-3.5-turbo等）
    ├─→ 填写API Key（必填）
    ├─→ 配置Base URL（可选，有默认值）
    ├─→ 配置其他参数（temperature等）
    └─→ 测试连接（可选）
    ↓
保存模型配置
    ↓
模型配置保存到 ai_models 表（与用户绑定）
```

### 4.2 AI节点配置流程

```
用户添加AI节点
    ↓
选择配置模式
    ├─→ 使用已保存模型（推荐）
    │   ├─→ 从下拉列表选择自己的模型（只显示当前用户的模型）
    │   ├─→ 填写提示词
    │   └─→ 可选：覆盖部分参数（temperature等）
    │
    └─→ 自定义配置模式（临时使用）
        ├─→ 选择提供商（OpenAI/Claude/Google等）
        ├─→ 填写模型名称
        ├─→ 填写API Key
        ├─→ 填写提示词
        └─→ 配置其他参数
```

### 4.3 后端执行流程

```
工作流执行器调用AI节点
    ↓
读取节点配置
    ↓
获取当前用户ID（从JWT Token或上下文）
    ↓
判断 modelMode
    ├─→ "saved"
    │   ├─→ 从数据库加载模型配置（ai_models表）
    │   ├─→ 验证模型属于当前用户（created_by = userID）
    │   ├─→ 验证模型状态（status = 'active'）
    │   ├─→ 解密API Key
    │   └─→ 使用模型配置 + 节点配置参数
    │
    └─→ "custom"
        ├─→ 直接使用节点配置中的参数
        ├─→ 验证必填字段（provider, modelName, apiKey）
        └─→ 使用自定义配置（API Key仅在内存中使用，不保存）
    ↓
调用AI服务工厂
    ↓
根据provider创建对应的服务实例
    ↓
执行AI调用
    ↓
返回结果
```

## 五、API设计

### 5.1 获取供应商模板列表

```
GET /api/ai/providers/templates
响应：
{
  "success": true,
  "data": [
    {
      "provider": "openai",
      "name": "OpenAI",
      "description": "OpenAI GPT系列模型",
      "icon": "openai-icon",
      "defaultBaseUrl": "https://api.openai.com/v1",
      "supportedModels": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
      "defaultConfig": {
        "temperature": 0.7,
        "maxTokens": 2000
      }
    },
    ...
  ]
}
```

### 5.2 获取用户自己的模型列表

```
GET /api/ai/models
Headers: Authorization: Bearer <token>
响应：
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "我的GPT-4配置",
      "provider": "openai",
      "modelName": "gpt-4",
      "status": "active",
      "temperature": 0.7,
      "maxTokens": 2000,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    ...
  ]
}
```

**说明**：只返回当前用户创建的模型（`created_by = currentUserID`）

### 5.3 基于模板创建模型配置

```
POST /api/ai/models
Headers: Authorization: Bearer <token>
请求：
{
  "name": "我的GPT-4配置",
  "provider": "openai",           // 基于哪个供应商模板
  "modelName": "gpt-4",           // 从模板支持的模型中选择
  "apiKey": "sk-xxx",             // 用户填写（后端加密存储）
  "baseUrl": "https://api.openai.com/v1",  // 可选，有默认值
  "temperature": 0.7,            // 可选，有默认值
  "maxTokens": 2000              // 可选，有默认值
}

响应：
{
  "success": true,
  "data": {
    "id": 1,
    "name": "我的GPT-4配置",
    "provider": "openai",
    "modelName": "gpt-4",
    "status": "active",
    ...
  }
}
```

### 5.4 更新模型配置

```
PUT /api/ai/models/:id
Headers: Authorization: Bearer <token>
请求：
{
  "name": "更新后的名称",
  "apiKey": "sk-new-key",  // 如果提供，会更新
  "temperature": 0.8,
  ...
}

响应：
{
  "success": true,
  "data": { ... }
}
```

**说明**：只能更新自己创建的模型（验证 `created_by`）

### 5.5 删除模型配置

```
DELETE /api/ai/models/:id
Headers: Authorization: Bearer <token>
响应：
{
  "success": true,
  "message": "模型配置已删除"
}
```

**说明**：只能删除自己创建的模型（验证 `created_by`）

### 5.6 测试模型配置

```
POST /api/ai/models/:id/test
Headers: Authorization: Bearer <token>
请求：
{
  "prompt": "Hello, world!"  // 测试提示词
}

响应：
{
  "success": true,
  "data": {
    "response": "AI返回的内容",
    "tokensUsed": 10,
    "responseTime": 500
  }
}
```

**说明**：用于测试模型配置是否正确

## 六、实现细节

### 6.1 工作流执行器中的AI节点实现

```go
func (e *WorkflowExecutor) executeAINode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
    // 1. 获取节点配置
    modelMode := getString(node.Config, "modelMode", "saved")
    
    var modelConfig *AIModelConfig
    
    // 2. 根据模式加载模型配置
    if modelMode == "saved" {
        // 从数据库加载用户保存的模型
        modelId := getInt(node.Config, "modelId", 0)
        if modelId == 0 {
            return errorResult("未选择模型")
        }
        
        // 获取当前用户ID（从执行上下文获取）
        userID := getCurrentUserID() // 需要从任务或工作流上下文获取
        
        // 加载模型配置，并验证属于当前用户
        aiModel, err := aiService.GetModelByIDAndUser(modelId, userID)
        if err != nil {
            return errorResult("加载模型失败: " + err.Error())
        }
        
        // 验证模型状态
        if aiModel.Status != "active" {
            return errorResult("模型状态异常: " + aiModel.Status)
        }
        
        modelConfig = convertToModelConfig(aiModel)
        
        // 允许节点配置覆盖部分参数
        if temp := getFloat64(node.Config, "temperature", 0); temp > 0 {
            modelConfig.Temperature = &temp
        }
        if maxTokens := getInt(node.Config, "maxTokens", 0); maxTokens > 0 {
            modelConfig.MaxTokens = &maxTokens
        }
    } else {
        // 使用自定义配置（临时使用，不保存）
        modelConfig = parseCustomConfig(node.Config)
        
        // 验证必填字段
        if modelConfig.Provider == "" || modelConfig.ModelName == "" || modelConfig.APIKey == "" {
            return errorResult("自定义配置缺少必填字段")
        }
    }
    
    // 3. 获取提示词和内容
    prompt := getString(node.Config, "prompt", "")
    // ... 解析变量 ...
    
    // 4. 调用AI服务
    result, err := aiService.Chat(modelConfig, prompt, content)
    if err != nil {
        return errorResult("AI调用失败: " + err.Error())
    }
    
    // 5. 返回结果
    return NodeExecutionResult{
        NodeID:  node.ID,
        Type:    "ai",
        Success: true,
        Data:    result,
    }
}
```

### 6.2 AI服务统一接口

```go
// AIService AI服务接口
type AIService interface {
    // Chat 聊天对话
    Chat(config *AIModelConfig, prompt string, content string) (*ChatResponse, error)
    
    // Complete 文本补全
    Complete(config *AIModelConfig, prompt string) (*CompleteResponse, error)
    
    // Embed 文本嵌入
    Embed(config *AIModelConfig, text string) (*EmbedResponse, error)
}

// AIModelConfig 统一的模型配置结构
type AIModelConfig struct {
    Provider        string
    ModelName       string
    APIKey          string  // 已解密
    BaseURL         string
    Endpoint        string
    Temperature     *float64
    MaxTokens       *int
    TopP            *float64
    SystemPrompt    string
    // ... 其他参数
}
```

### 6.3 模型配置转换

```go
// 从数据库模型转换为执行配置
func convertToModelConfig(aiModel *models.AIModel) *AIModelConfig {
    // 解密API Key
    apiKey := decryptAPIKey(aiModel.APIKeyEncrypted)
    
    return &AIModelConfig{
        Provider:     aiModel.Provider,
        ModelName:    aiModel.ModelName,
        APIKey:       apiKey,
        BaseURL:      getStringValue(aiModel.BaseURL),
        Endpoint:     getStringValue(aiModel.Endpoint),
        Temperature:  aiModel.Temperature,
        MaxTokens:    aiModel.MaxTokens,
        // ...
    }
}

// 从节点自定义配置解析
func parseCustomConfig(config map[string]interface{}) *AIModelConfig {
    return &AIModelConfig{
        Provider:     getString(config, "provider", ""),
        ModelName:    getString(config, "modelName", ""),
        APIKey:       getString(config, "apiKey", ""),  // 前端传来的明文
        BaseURL:      getString(config, "baseUrl", ""),
        Endpoint:     getString(config, "endpoint", ""),
        Temperature:  getFloat64Ptr(config, "temperature"),
        MaxTokens:    getIntPtr(config, "maxTokens"),
        // ...
    }
}
```

## 七、安全性考虑

### 7.1 API Key加密存储

- **预设模型**：API Key存储在数据库中，使用加密字段 `api_key_encrypted`
- **自定义配置**：
  - 前端传输时：明文传输（HTTPS保护）
  - 后端存储：如果用户选择"保存为预设模型"，则加密存储
  - 节点配置中：如果只是临时使用，不保存到数据库，则只在内存中使用

### 7.2 加密方案

```go
// 使用系统配置的加密密钥
func encryptAPIKey(apiKey string) (string, error) {
    // 使用 AES 加密
    // 密钥从环境变量或配置中获取
}

func decryptAPIKey(encrypted string) (string, error) {
    // 解密API Key
}
```

## 八、前端UI设计

### 8.1 模型管理页面（用户模型供应面板）

```
┌─────────────────────────────────────────────┐
│ 我的AI模型配置                               │
├─────────────────────────────────────────────┤
│ [+ 添加新模型]                               │
│                                             │
│ ┌─ 模型列表 ────────────────────────────┐  │
│ │ ┌───────────────────────────────────┐  │  │
│ │ │ OpenAI GPT-4                     │  │  │
│ │ │ Provider: OpenAI                 │  │  │
│ │ │ Model: gpt-4                     │  │  │
│ │ │ Status: ✓ Active                 │  │  │
│ │ │ [编辑] [测试] [删除]              │  │  │
│ │ └───────────────────────────────────┘  │  │
│ │                                         │  │
│ │ ┌───────────────────────────────────┐  │  │
│ │ │ Claude 3 Opus                    │  │  │
│ │ │ Provider: Anthropic              │  │  │
│ │ │ Model: claude-3-opus             │  │  │
│ │ │ Status: ✓ Active                 │  │  │
│ │ │ [编辑] [测试] [删除]              │  │  │
│ │ └───────────────────────────────────┘  │  │
│ └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 8.2 添加模型配置表单

```
┌─────────────────────────────────────────────┐
│ 添加AI模型配置                               │
├─────────────────────────────────────────────┤
│ 选择供应商模板: [OpenAI ▼]                  │
│                                             │
│ 模型名称: [我的GPT-4配置]                   │
│                                             │
│ 选择模型: [gpt-4 ▼]                        │
│   - gpt-4                                   │
│   - gpt-4-turbo                             │
│   - gpt-3.5-turbo                           │
│                                             │
│ API Key: [sk-xxx...] *                      │
│                                             │
│ Base URL: [https://api.openai.com/v1]      │
│   (默认值，可修改)                           │
│                                             │
│ 高级参数:                                   │
│   Temperature: [0.7]                        │
│   Max Tokens: [2000]                        │
│                                             │
│ [测试连接] [保存] [取消]                     │
└─────────────────────────────────────────────┘
```

### 8.3 AI节点配置面板

```
┌─────────────────────────────────────┐
│ AI节点配置                          │
├─────────────────────────────────────┤
│ 配置模式: [已保存模型 ▼] [自定义配置]│
│                                     │
│ ┌─ 已保存模型模式 ───────────────┐  │
│ │ 选择模型: [我的GPT-4配置 ▼]   │  │
│ │   - 我的GPT-4配置             │  │
│ │   - 我的Claude配置            │  │
│ │                               │  │
│ │ 提示词:                       │  │
│ │ ┌─────────────────────────┐   │  │
│ │ │ 请分析以下内容...       │   │  │
│ │ └─────────────────────────┘   │  │
│ │                               │  │
│ │ 高级参数（可选）:             │  │
│ │ Temperature: [0.7]            │  │
│ │ Max Tokens: [2000]            │  │
│ └───────────────────────────────┘  │
│                                     │
│ ┌─ 自定义配置模式 ─────────────┐  │
│ │ 提供商: [OpenAI ▼]          │  │
│ │ 模型名称: [gpt-3.5-turbo]   │  │
│ │ API Key: [sk-xxx...]        │  │
│ │ Base URL: [https://...]    │  │
│ │ ...                         │  │
│ └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 九、实施步骤

### 阶段1：数据库和模型
1. 创建 `ai_provider_templates` 表（供应商模板表）
2. 确认 `ai_models` 表的 `created_by` 字段存在（用于用户绑定）
3. 初始化供应商模板数据（OpenAI、Claude、Google等）
4. 创建领域层（domain/entity、domain/repository）

### 阶段2：仓储和服务层
1. 创建供应商模板仓储（ProviderTemplateRepository）
2. 创建AI模型仓储（AIModelRepository），支持按用户ID查询
3. 创建AI服务（AIService），实现模型管理功能
4. 实现API Key加密/解密功能

### 阶段3：提供商实现
1. 实现提供商接口（services/providers/interface.go）
2. 实现 OpenAI 提供商（作为示例）
3. 实现 AI 服务工厂

### 阶段4：API接口
1. 创建 AI 控制器，提供以下API：
   - GET /api/ai/providers/templates - 获取供应商模板列表
   - GET /api/ai/models - 获取用户模型列表
   - POST /api/ai/models - 创建模型配置
   - PUT /api/ai/models/:id - 更新模型配置
   - DELETE /api/ai/models/:id - 删除模型配置
   - POST /api/ai/models/:id/test - 测试模型配置

### 阶段5：工作流集成
1. 实现工作流执行器中的 AI 节点逻辑
2. 支持已保存模型和自定义配置两种模式
3. 实现用户验证（确保只能使用自己的模型）
4. 实现配置转换和参数覆盖

### 阶段6：前端实现
1. 实现模型管理页面（用户模型供应面板）
2. 实现添加/编辑模型配置表单
3. 实现AI节点配置面板
4. 实现模型选择下拉框（只显示当前用户的模型）

## 十、注意事项

1. **用户隔离**：
   - 所有模型查询必须过滤 `created_by = currentUserID`
   - 工作流执行时，验证模型属于当前用户
   - API接口必须验证权限

2. **向后兼容**：
   - 如果节点配置中没有 `modelMode` 字段，默认使用已保存模型模式
   - 如果 `modelId` 不存在或不属于当前用户，给出明确错误提示

3. **安全性**：
   - API Key必须加密存储
   - 自定义配置模式中的API Key仅在内存中使用，不保存到数据库
   - 所有API接口需要JWT认证

4. **性能优化**：
   - 供应商模板可以缓存（很少变化）
   - 用户模型列表可以缓存（按用户ID）

5. **日志记录**：
   - 记录AI调用日志，包括使用的模型、Token消耗、用户ID等
   - 记录模型创建、更新、删除操作

6. **错误处理**：
   - 模型不存在或不属于当前用户时，给出明确错误提示
   - 模型状态异常时，给出明确错误提示
   - API Key无效时，给出明确错误提示

## 十一、扩展性

未来可以支持：
1. **模型使用统计**：统计每个模型的使用次数、Token消耗、成本等
2. **模型版本管理**：支持模型配置的版本历史
3. **批量操作**：批量测试、批量启用/禁用模型
4. **模型共享**：支持用户之间共享模型配置（可选功能）
5. **模型导入/导出**：支持导出模型配置，在其他环境导入
6. **供应商模板管理**：管理员可以添加新的供应商模板

