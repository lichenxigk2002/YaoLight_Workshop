# 豆包（Doubao）API 接入方案

## 一、需求分析

### 1.1 豆包功能特性
- ✅ **文本生成**：问答、分析、改写、摘要、编程、翻译等
- ✅ **深度思考**：类似 DeepSeek 的思考能力
- ✅ **多模态理解**：支持图片、视频、PDF 文件输入
- ✅ **多个模型系列**：
  - `Doubao-1.5-pro`：文本生成
  - `Doubao-1.5-vision`：支持图片输入
  - `Doubao-lite`：轻量版本

### 1.2 与现有架构的对比

| 功能 | DeepSeek | 豆包 | 差异点 |
|------|----------|------|--------|
| 文本生成 | ✅ | ✅ | API 格式可能不同 |
| 深度思考 | ✅ (thinking参数) | ✅ | 参数名称/格式可能不同 |
| 流式输出 | ✅ | ✅ | SSE 格式可能不同 |
| 多模态 | ❌ | ✅ | **新增功能，需要扩展接口** |

## 二、架构设计思路

### 2.1 文件结构

```
modules/ai/services/providers/
├── interface.go              # 统一接口（可能需要扩展多模态）
├── deepseek/
│   └── deepseek_provider.go
└── doubao/                   # 新增豆包提供商
    ├── doubao_provider.go    # 实现 AIProvider 接口
    ├── doubao_config.go      # 豆包特有配置结构
    └── doubao_models.go      # 支持的模型列表
```

### 2.2 核心问题分析

#### 问题 1：多模态支持
**现状**：当前 `AIProvider` 接口只支持文本输入
```go
Chat(config *AIModelConfig, prompt string, content string, ...)
```

**解决方案选项**：
- **选项 A**：扩展 `providerConfig` 支持文件输入
  ```go
  providerConfig["images"] = []string{"base64_image1", "base64_image2"}
  providerConfig["files"] = []string{"file_id1", "file_id2"}
  ```
- **选项 B**：新增多模态接口方法（更清晰，但需要修改接口）
  ```go
  ChatMultimodal(config *AIModelConfig, messages []MultimodalMessage, ...)
  ```
- **选项 C**：在 `content` 参数中支持特殊格式（向后兼容）
  ```go
  // content 可以是文本或 JSON 格式的多模态内容
  content = `{"text": "...", "images": ["base64..."], "files": [...]}`
  ```

**推荐**：选项 A（最小改动，向后兼容）

#### 问题 2：深度思考参数
**DeepSeek 方式**：
```json
{
  "thinking": {
    "type": "enabled"  // 或 "disabled"
  }
}
```

**豆包可能的方式**：
- 可能使用相同格式（如果兼容 OpenAI）
- 可能使用不同的参数名（如 `enable_thinking`）
- 可能通过模型选择（如 `doubao-thinking` 模型）

**需要确认**：豆包 API 文档中的深度思考参数格式

#### 问题 3：流式输出格式
**DeepSeek 格式**：
```
data: {"choices": [{"delta": {"content": "...", "reasoning_content": "..."}}]}
```

**豆包可能格式**：
- 如果兼容 OpenAI：格式相同
- 如果不兼容：需要单独解析逻辑

**需要确认**：豆包 SSE 响应格式

#### 问题 4：模型配置差异
**需要配置的模型**：
- `Doubao-1.5-pro`：基础文本模型
- `Doubao-1.5-vision`：多模态模型（需要特殊处理）
- `Doubao-lite`：轻量模型

**配置项差异**：
- 是否需要特殊的认证方式？
- BaseURL 是什么？
- 是否有特殊的请求头？

## 三、实施步骤规划

### 阶段 1：信息收集（当前阶段）
1. ✅ 确认豆包 API 文档地址
2. ⏳ 确认 API 认证方式（API Key 格式）
3. ⏳ 确认 BaseURL 和 Endpoint
4. ⏳ 确认请求格式（是否兼容 OpenAI）
5. ⏳ 确认深度思考参数格式
6. ⏳ 确认流式输出格式
7. ⏳ 确认多模态输入格式（图片如何传递）

### 阶段 2：基础实现
1. 创建 `doubao_provider.go` 实现基础 Chat 方法
2. 实现 ChatStream 方法（流式输出）
3. 注册到 ProviderFactory
4. 添加系统预设配置支持

### 阶段 3：深度思考支持
1. 解析豆包的深度思考参数格式
2. 在 `providerConfig` 中支持 `thinking` 参数
3. 解析流式输出中的思考内容（类似 DeepSeek）

### 阶段 4：多模态支持（可选，根据需求）
1. 扩展 `providerConfig` 支持图片/文件输入
2. 实现多模态消息构建逻辑
3. 前端支持图片上传和预览

### 阶段 5：配置和测试
1. 添加豆包到提供商模板
2. 前端添加豆包模型选择
3. 测试各种场景

## 四、关键技术点

### 4.1 API 请求格式（已确认）

#### 方案 A：使用官方 SDK（推荐用于快速验证）
```go
import "github.com/volcengine/volcengine-go-sdk/service/arkruntime"

client := arkruntime.NewClientWithApiKey(
    apiKey,
    arkruntime.WithBaseUrl("https://ark.cn-beijing.volces.com/api/v3"),
)

// 文本生成
resp, err := client.CreateResponses(ctx, &responses.ResponsesRequest{
    Model: "doubao-seed-1-6-251015",
    Input: &responses.ResponsesInput{
        Union: &responses.ResponsesInput_StringValue{
            StringValue: prompt + "\n\n" + content,
        },
    },
    Thinking: &responses.ResponsesThinking{
        Type: responses.ThinkingType_enabled.Enum(),  // 深度思考
    },
})
```

#### 方案 B：直接 HTTP 请求（保持与 DeepSeek 一致）
```go
// 需要根据 Responses API 的实际 HTTP 格式构建请求
// 可能需要查看 SDK 源码或 API 文档来了解 HTTP 请求格式
requestBody := map[string]interface{}{
    "model": "doubao-seed-1-6-251015",
    "input": map[string]interface{}{
        "string_value": prompt + "\n\n" + content,
    },
    "thinking": map[string]interface{}{
        "type": "enabled",  // 或 "disabled"
    },
}
```

### 4.2 流式响应解析（待确认）
```go
// 需要确认豆包的 SSE 格式
// 是否包含 reasoning_content 字段？
// 字段名是 reasoning_content 还是 thinking_content？
```

### 4.3 多模态消息构建（已确认）
```go
// 豆包的多模态格式（基于 SDK 示例）
inputMessage := &responses.ItemInputMessage{
    Role: responses.MessageRole_user,
    Content: []*responses.ContentItem{
        {
            Union: &responses.ContentItem_Image{
                Image: &responses.ContentItemImage{
                    Type:     responses.ContentItemType_input_image,
                    ImageUrl: lo.ToPtr("https://example.com/image.png"),  // 或 base64
                },
            },
        },
        {
            Union: &responses.ContentItem_Text{
                Text: &responses.ContentItemText{
                    Type: responses.ContentItemType_input_text,
                    Text: "这是什么？",
                },
            },
        },
    },
}

// 在 providerConfig 中传递
providerConfig["multimodal"] = true
providerConfig["images"] = []string{"image_url1", "image_url2"}
providerConfig["text"] = "这是什么？"
```

## 五、已确认的信息（基于 SDK 示例）

### 5.1 API 基础信息 ✅
- ✅ **BaseURL**：`https://ark.cn-beijing.volces.com/api/v3`
- ✅ **API Key**：环境变量 `ARK_API_KEY`
- ✅ **认证方式**：API Key（通过 `NewClientWithApiKey`）
- ✅ **SDK 包**：`github.com/volcengine/volcengine-go-sdk`

### 5.2 请求格式 ✅
- ✅ **API 类型**：**Responses API**（不是 OpenAI 兼容的 Chat Completions）
- ✅ **深度思考参数**：
  ```go
  Thinking: &responses.ResponsesThinking{
      Type: responses.ThinkingType_disabled.Enum()  // 或 enabled
  }
  ```
- ✅ **多模态输入格式**：
  ```go
  Content: []*responses.ContentItem{
      {Union: &responses.ContentItem_Image{...}},
      {Union: &responses.ContentItem_Text{...}},
  }
  ```
- ✅ **文本输入格式**：
  ```go
  Input: &responses.ResponsesInput{
      Union: &responses.ResponsesInput_StringValue{
          StringValue: "hello"
      }
  }
  ```

### 5.3 响应格式 ⏳
- ⏳ **流式输出格式**：需要确认 Responses API 是否支持流式
- ⏳ **思考内容字段名**：需要确认响应中思考内容的字段名
- ⏳ **错误响应格式**：需要确认

### 5.4 模型信息 ✅
- ✅ **文本生成模型**：`doubao-seed-1-6-251015`
- ✅ **图片生成模型**：`doubao-seedream-4-5-251128`
- ⏳ **其他模型**：需要查看完整模型列表

## 六、实施建议（更新）

### 6.1 实施方案选择

#### 方案 A：使用官方 SDK（快速但增加依赖）
**优点**：
- 快速实现，官方维护
- 自动处理序列化/反序列化
- 类型安全

**缺点**：
- 增加外部依赖
- 需要了解 SDK 的流式输出方式
- 可能与现有架构不一致

#### 方案 B：直接 HTTP 请求（推荐，保持一致性）
**优点**：
- 与 DeepSeek 实现方式一致
- 不增加外部依赖
- 完全控制请求/响应处理

**缺点**：
- 需要手动构建请求体（需要查看 SDK 源码或 API 文档）
- 需要手动解析响应

**推荐**：方案 B（保持架构一致性）

### 6.2 优先级
1. **P0（必须）**：基础文本生成（非流式）
2. **P1（重要）**：流式输出支持
3. **P2（重要）**：深度思考支持
4. **P3（可选）**：多模态支持（如果当前不需要可以延后）

### 6.3 关键技术决策

#### 决策 1：是否引入 SDK 依赖？
**建议**：不引入，直接使用 HTTP 请求
- 保持与 DeepSeek 实现的一致性
- 减少依赖，降低维护成本
- 需要查看 SDK 源码了解 HTTP 请求格式

#### 决策 2：如何适配 Responses API？
**方案**：在 `doubao_provider.go` 中实现适配层
- 将统一的 `AIModelConfig` 转换为豆包的 `ResponsesRequest`
- 将豆包的响应转换为统一的 `ChatResponse`
- 保持接口不变，内部实现差异

#### 决策 3：多模态如何处理？
**方案**：通过 `providerConfig` 传递
```go
// 在 providerConfig 中传递多模态信息
if images, ok := providerConfig["images"].([]string); ok {
    // 构建多模态消息
}
```

## 七、风险评估

### 7.1 技术风险
- **低风险**：如果豆包 API 兼容 OpenAI 格式，实现会很简单
- **中风险**：如果格式不兼容，需要单独实现解析逻辑
- **高风险**：多模态功能可能需要大幅修改现有架构

### 7.2 时间估算
- 基础实现：2-4 小时
- 深度思考支持：1-2 小时
- 多模态支持：4-8 小时（如果架构需要调整）

## 八、实施步骤（更新）

### 步骤 1：了解 Responses API 的 HTTP 格式
**目标**：在不使用 SDK 的情况下，了解如何构建 HTTP 请求

**方法**：
1. 查看 SDK 源码，了解 `CreateResponses` 如何构建 HTTP 请求
2. 或查看豆包 API 文档（如果有）
3. 或使用 Postman 测试 SDK 生成的请求

**关键信息**：
- HTTP 方法：POST
- Endpoint：`/api/v3/responses`（推测）
- 请求头：`Authorization: Bearer {API_KEY}`
- 请求体格式：需要确认 JSON 结构

### 步骤 2：实现基础 Chat 方法
```go
func (p *DoubaoProvider) Chat(
    config *providers.AIModelConfig,
    prompt string,
    content string,
    providerConfig map[string]interface{},
) (*providers.ChatResponse, error) {
    // 1. 构建豆包的请求体
    // 2. 发送 HTTP 请求
    // 3. 解析响应
    // 4. 转换为统一的 ChatResponse
}
```

### 步骤 3：实现流式输出
- 需要确认 Responses API 是否支持流式
- 如果支持，解析 SSE 格式
- 处理思考内容（如果存在）

### 步骤 4：深度思考支持
- 在请求中添加 `thinking` 参数
- 解析响应中的思考内容

### 步骤 5：多模态支持（可选）
- 扩展 `providerConfig` 支持图片
- 构建多模态消息

## 九、关键问题（需要确认）

### 9.1 Responses API 的 HTTP 格式
- [ ] Endpoint 路径是什么？（`/api/v3/responses`？）
- [ ] 请求体的 JSON 结构是什么？
- [ ] 是否支持流式输出？如何启用？
- [ ] 响应格式是什么？

### 9.2 深度思考
- [ ] 响应中思考内容的字段名是什么？
- [ ] 流式输出中如何区分思考内容和正式内容？

### 9.3 多模态
- [ ] 图片如何传递？（URL 还是 base64？）
- [ ] 是否支持本地文件上传？

---

**建议**：
1. 先查看 SDK 源码，了解 HTTP 请求格式
2. 或使用 Postman 抓包 SDK 的请求
3. 实现基础功能后再逐步添加高级特性

