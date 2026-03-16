# 工作流对外 API 发布技术实现文档

| 项目 | 说明 |
|------|------|
| 文档名称 | 工作流对外 API 发布技术实现文档 |
| 文档版本 | 1.0 |
| 适用范围 | `Low_code_Backend`、`Low_code_Frontend`、`Admin_Frontend` |
| 更新时间 | 2026-03-16 |

关联文档：

- `docs/Workflow-API-Access-Docs-Detail.md`

---

## 1. 设计原则

## 1.1 复用现有主链路

必须复用当前已经存在的：

- 工作流编排数据
- 工作流执行器
- `task`
- `artifact`

不要新做一套独立“API 执行引擎”。

## 1.2 对外开放能力与输出节点解耦

输出节点继续负责：

- 导出格式
- artifact 生成
- 结果结构

API 发布层负责：

- 对外路由
- API Key
- 请求入参
- 调用日志
- 限流
- 结果查询
- 接入文档生成

## 1.3 统一走“带 task 的执行路径”

当前非流式 `WorkflowExecutor.Execute()` 不创建 `task`，而输出节点 `destination=api` 依赖 `TaskID`。  
因此开放 API 不应基于 `Execute()`，而应统一复用当前**会创建任务**的执行路径。

建议把现有 `ExecuteWorkflowStream()` 背后的公共逻辑抽成：

```text
ExecuteWithTask(ctx, req, observer)
```

供以下调用方复用：

- 站内工作流执行
- 对外 API 调用
- 后续定时任务 / Webhook 触发

---

## 2. 当前代码现状映射

当前已存在：

- 工作流执行入口：
  - `Low_code_Backend/modules/workflow/controllers/workflow_controller.go`
- 执行器：
  - `Low_code_Backend/modules/workflow/services/workflow_executor.go`
  - `Low_code_Backend/modules/workflow/services/workflow_executor_stream.go`
- 输出节点：
  - `Low_code_Backend/modules/workflow/services/output_node.go`
- artifact 查询与下载：
  - `Low_code_Backend/modules/artifact/controllers/artifact_controller.go`
- 路由注册：
  - `Low_code_Backend/cmd/server/main.go`

当前约束：

- 所有 artifact 查询 / 下载接口都走 JWT
- 开始节点只有静态 `inputData`
- 没有 API Key 模块
- 没有外部调用日志模型
- 没有面向外部开发者的 API 接入文档页

---

## 3. 总体架构

建议新增独立模块：

```text
modules/workflow_api
```

建议结构：

- `models/`
- `repositories/`
- `services/`
- `controllers/`

职责拆分：

- `WorkflowAPIService`
  - 创建 / 更新 / 发布 / 停用 API
- `WorkflowAPIKeyService`
  - 生成、校验、禁用、轮换 Key
- `WorkflowAPIInvocationService`
  - 接收外部请求
  - 转换为执行请求
  - 关联 task
  - 组装返回结果
- `WorkflowAPIDocService`
  - 生成接入文档元数据
  - 生成代码示例
  - 生成请求/响应示例
- `OpenAPIController`
  - 暴露外部调用接口
- `WorkflowAPIController`
  - 暴露站内管理接口
- `WorkflowAPIDocController`
  - 暴露接入文档接口

---

## 4. 数据模型设计

## 4.1 `workflow_api_endpoints`

建议字段：

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `user_id` | 所属用户 |
| `project_id` | 所属项目 |
| `workflow_id` | 关联工作流 |
| `name` | API 名称 |
| `slug` | 对外路径标识，唯一 |
| `description` | 描述 |
| `status` | `draft / active / disabled` |
| `response_mode` | `async / wait / hybrid` |
| `result_mode` | `json / artifact / mixed` |
| `wait_timeout_seconds` | wait 模式最大等待时长 |
| `request_schema` | 请求示例或 schema |
| `start_input_config` | 运行时入参映射配置 |
| `result_config` | 结果组装配置 |
| `rate_limit_per_minute` | 限流 |
| `ip_whitelist` | 白名单，可选 |
| `published_at` | 发布时间 |
| `created_at / updated_at` | 时间戳 |

## 4.2 `workflow_api_keys`

建议字段：

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `endpoint_id` | 所属 API |
| `name` | Key 名称 |
| `key_prefix` | 明文前缀，便于展示 |
| `key_hash` | 哈希值 |
| `status` | `active / disabled / expired` |
| `expires_at` | 失效时间，可空 |
| `last_used_at` | 最后使用时间 |
| `created_at / updated_at` | 时间戳 |

说明：

- 后端只存 `prefix + hash`
- 明文只在创建时返回一次
- 不建议使用可逆加密

## 4.3 `workflow_api_invocations`

建议字段：

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `endpoint_id` | 所属 API |
| `api_key_id` | 使用的 Key |
| `request_id` | 对外请求 ID，建议 UUID |
| `task_id` | 关联任务 |
| `status` | `accepted / running / completed / failed / timeout` |
| `request_headers` | 脱敏后的请求头 |
| `request_query` | query |
| `request_body` | body |
| `response_snapshot` | 最终响应快照 |
| `error_message` | 错误 |
| `client_ip` | 来源 IP |
| `user_agent` | UA |
| `started_at / completed_at` | 调用时间 |
| `created_at / updated_at` | 时间戳 |

---

## 5. 路由设计

## 5.1 站内管理接口

建议挂在 JWT 鉴权下：

```text
GET    /api/workflows/:id/api
POST   /api/workflows/:id/api
PUT    /api/workflow-apis/:id
POST   /api/workflow-apis/:id/publish
POST   /api/workflow-apis/:id/disable
GET    /api/workflow-apis/:id/keys
POST   /api/workflow-apis/:id/keys
POST   /api/workflow-api-keys/:id/disable
POST   /api/workflow-api-keys/:id/rotate
GET    /api/workflow-apis/:id/invocations
GET    /api/workflow-apis/:id/invocations/:requestId
```

## 5.2 对外开放接口

建议使用独立前缀，避免与站内 JWT API 混淆：

```text
POST   /open-api/v1/workflows/:slug/invoke
GET    /open-api/v1/invocations/:requestId
GET    /open-api/v1/invocations/:requestId/artifacts
GET    /open-api/v1/invocations/:requestId/artifacts/:artifactId/download
GET    /open-api/v1/workflows/:slug/docs
GET    /open-api/v1/workflows/:slug/schema
```

鉴权头建议：

```text
X-API-Key: ylw_live_xxx
```

不建议复用 `Authorization: Bearer`，避免与站内 JWT 语义混淆。

其中：

- `/docs`：返回接入文档需要的完整只读元数据，供前端渲染 Dify 风格文档页
- `/schema`：返回更结构化的请求/响应 schema，便于后续扩展 SDK 或 OpenAPI 导出

---

## 6. 请求与响应协议

## 6.1 请求结构

建议：

```json
{
  "input": {
    "title": "测试标题",
    "content": "测试内容"
  },
  "options": {
    "responseMode": "wait",
    "waitTimeoutSeconds": 15
  }
}
```

## 6.2 `async` 响应

```json
{
  "code": 202,
  "message": "accepted",
  "data": {
    "requestId": "req_xxx",
    "status": "running",
    "queryUrl": "/open-api/v1/invocations/req_xxx"
  }
}
```

## 6.3 `wait` 完成响应

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "requestId": "req_xxx",
    "status": "completed",
    "result": {
      "summary": "..."
    },
    "artifacts": [
      {
        "name": "output.pdf",
        "kind": "pdf",
        "downloadUrl": "/open-api/v1/invocations/req_xxx/artifacts/12/download"
      }
    ]
  }
}
```

## 6.4 `wait` 超时响应

```json
{
  "code": 202,
  "message": "running",
  "data": {
    "requestId": "req_xxx",
    "status": "running",
    "queryUrl": "/open-api/v1/invocations/req_xxx"
  }
}
```

## 6.5 接入文档输出内容

建议 `GET /open-api/v1/workflows/:slug/docs` 返回：

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "name": "文章摘要 API",
    "description": "输入标题和正文，返回摘要与关键词",
    "baseUrl": "https://your-domain.com",
    "path": "/open-api/v1/workflows/article-summary/invoke",
    "method": "POST",
    "auth": {
      "type": "x-api-key",
      "header": "X-API-Key"
    },
    "requestExample": {
      "input": {
        "title": "示例标题",
        "content": "示例正文"
      }
    },
    "responseExample": {
      "code": 200,
      "message": "ok",
      "data": {
        "requestId": "req_xxx",
        "status": "completed"
      }
    },
    "codeSamples": {
      "curl": "curl ...",
      "javascript": "fetch(...)",
      "python": "requests.post(...)"
    }
  }
}
```

---

## 7. 执行链路设计

## 7.1 外部请求进入系统

步骤：

1. `OpenAPIKeyMiddleware` 校验 Key
2. 加载 `workflow_api_endpoint`
3. 校验状态、限流、过期、IP 白名单
4. 创建 `workflow_api_invocation`
5. 加载对应工作流节点与边
6. 组装 `ExecutionRequest`
7. 调用统一的 `ExecuteWithTask`
8. 更新 invocation 状态
9. 返回同步结果或异步受理结果

## 7.2 `ExecutionRequest` 扩展

建议新增字段：

```go
type ExecutionRequest struct {
    Nodes        []NodeConfig
    Edges        []EdgeConfig
    UserID       uint
    WorkflowID   uint
    RuntimeInput interface{}
    RuntimeMeta  map[string]interface{}
}
```

其中：

- `RuntimeInput`：外部传入的 `input`
- `RuntimeMeta`：请求头、query、requestId、endpointId 等

## 7.3 开始节点改造

当前开始节点只读 `config.inputData`。  
建议改为：

- 若存在 `RuntimeInput`，优先使用运行时输入
- 若同时存在静态默认值，则按配置决定：
  - `replace`
  - `shallow_merge`
  - `deep_merge`

建议默认：

- `RuntimeInput` 覆盖静态输入

## 7.4 变量上下文改造

建议在 `VariableContext` 中新增全局变量注入能力，例如：

- `runtime.body`
- `runtime.headers`
- `runtime.query`
- `runtime.requestId`
- `runtime.api.slug`

这样 AI、清洗、条件、转换节点都可直接引用。

---

## 8. 结果组装设计

## 8.1 JSON 结果来源

建议优先顺序：

1. `task.result`
2. 终点节点输出
3. 指定输出节点的 `data`

## 8.2 artifact 结果来源

直接复用现有 artifact 数据，不新增重复存储。

对外返回时不要直接暴露站内 JWT 下载地址，应重新组装开放下载地址。

## 8.3 多输出节点处理

MVP 建议支持：

- 全部输出节点产物都返回

增强版可支持：

- 发布时指定“哪些输出节点对外暴露”

---

## 9. 鉴权与安全

## 9.1 API Key 生成

建议格式：

```text
ylw_live_<random>
```

建议实现：

- 随机生成 32+ 字节明文
- 存 `prefix`
- 存 `sha256(plain + pepper)`

配置新增：

```text
OPEN_API_KEY_PEPPER=
```

## 9.2 脱敏

以下内容不得明文落日志：

- API Key
- Authorization
- Cookie
- 可能包含密码或 Token 的字段

可复用现有操作日志脱敏规则思路。

## 9.3 限流

MVP 建议按：

- `endpoint_id + api_key_id`

做分钟级限流。  
可先用内存或 Redis 实现，项目已有 Redis 基础设施，优先走 Redis。

## 9.4 下载安全

下载接口需验证：

- `requestId` 存在
- artifact 属于该 invocation 对应的 task
- 调用 Key 对该 endpoint 有权限

不要允许只凭 artifact ID 直接下载。

---

## 10. 后端落地建议

## 10.1 新增模块

建议新增：

- `Low_code_Backend/modules/workflow_api/models/`
- `Low_code_Backend/modules/workflow_api/repositories/`
- `Low_code_Backend/modules/workflow_api/services/`
- `Low_code_Backend/modules/workflow_api/controllers/`

## 10.2 路由注册

在 `Low_code_Backend/cmd/server/main.go` 中新增两组路由：

- JWT 管理路由
- `open-api` 公共路由
- `open-api docs` 文档路由

## 10.3 统一执行入口

建议把当前 `workflow_executor_stream.go` 的任务创建与执行主链路抽出，形成服务级公共方法，避免：

- 站内执行一套
- 对外 API 再复制一套

## 10.4 migration

建议新增迁移：

- `015_create_workflow_api_endpoints.sql`
- `016_create_workflow_api_keys.sql`
- `017_create_workflow_api_invocations.sql`

---

## 11. 前端落地建议

## 11.1 用户前端

建议在 `Low_code_Frontend` 中新增 API 发布页或抽屉：

- 发布配置表单
- Key 管理
- 调用示例
- 调用记录
- 接入文档预览与分享

建议位置：

- 工作流详情页
- 或工作流编辑器页右上角“发布为 API”

建议额外新增一页开发者文档页，例如：

```text
/workflow-apis/:id/docs
```

该页用于站内预览最终会给外部人员看到的文档效果。

## 11.2 输出节点前端

不建议把 API 地址、Key、限流配置继续放入 `OutputNodeConfig.tsx`。

输出节点只需保留：

- `format`
- `destination`
- `fileName`
- 可能的“是否允许对外暴露”标记

## 11.3 文档页体验

目标体验参考 Dify：

- 左侧展示 API 基本信息与说明
- 右侧展示示例代码与响应
- 顶部可切换 `curl / JavaScript / Python`
- 可复制完整请求
- 可看到 `async / wait` 两种模式差异
- 若存在 artifact，单独展示下载说明

## 11.4 文档数据来源

接入文档页不应手写存静态 HTML，而应根据发布配置自动生成：

- API 名称、路径、鉴权头来自 endpoint 配置
- 请求示例来自用户配置的 request example / schema
- 响应示例来自 result mode 配置与最近一次成功调用快照
- 代码示例由 `WorkflowAPIDocService` 按模板生成

## 11.5 管理后台

`Admin_Frontend` 本期可以不做完整发布功能，但建议预留：

- API 发布总览
- 异常调用查询
- 停用接口 / Key

---

## 12. 测试方案

## 12.1 单元测试

- Key 生成与校验
- 限流逻辑
- 运行时输入注入开始节点
- invocation 到 task 的映射
- artifact 开放下载鉴权

## 12.2 集成测试

至少覆盖：

1. 外部调用 JSON 返回工作流
2. 外部调用 artifact 返回工作流
3. wait 模式超时回退 async
4. Key 禁用后调用失败
5. 限流命中

## 12.3 回归测试

重点确认：

- 原有站内工作流执行不受影响
- 原有 artifact 站内下载不受影响
- 输出节点现有导出格式不回退

---

## 13. 分阶段实施建议

## Phase 1

- 新表
- API 发布管理
- API Key
- 外部调用
- invocation 查询
- artifact 开放下载

## Phase 2

- 参数 schema 校验
- IP 白名单
- 更丰富的示例文档
- Webhook 完成通知

## Phase 3

- 多版本发布
- 调用计费
- 平台级运营视图

---

## 14. 关键结论

从当前项目来看，最稳妥的实现方式不是“继续把开放 API 写进输出节点”，而是：

1. 复用现有工作流执行、任务、artifact 链路
2. 在其上新增 `workflow_api` 发布层
3. 增加 API Key 鉴权与外部调用路由
4. 补齐运行时入参与对外结果查询能力

这样改动最符合当前代码结构，风险也最低。
