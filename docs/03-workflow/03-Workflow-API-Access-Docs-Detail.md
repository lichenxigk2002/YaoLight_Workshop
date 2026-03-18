# 工作流 API 接入文档页详细设计

| 项目 | 说明 |
|------|------|
| 文档名称 | 工作流 API 接入文档页详细设计 |
| 文档版本 | 1.0 |
| 适用范围 | `Low_code_Frontend`、`Low_code_Backend` |
| 更新时间 | 2026-03-16 |

---

## 1. 文档目标

本页不是后台 PRD，也不是管理员说明页。

它的目标是：

> 当一个工作流发布为 API 后，系统自动生成一页给外部开发者直接接入的文档页，体验参考 Dify 的 API Access。

这页文档要解决的不是“解释系统怎么设计”，而是“让对方 5 分钟内完成接入”。

---

## 2. 使用对象

- 工作流拥有者
- 外部开发者
- 合作方技术人员
- 内部其他系统的接入方

---

## 3. 页面定位

建议分成两类页面：

## 3.1 站内预览页

用于工作流拥有者在系统内查看和确认文档。

建议路由：

```text
/workflow-apis/:id/docs
```

特点：

- 需要登录
- 可以看到完整 Key 管理入口
- 可以复制调试用示例
- 可以跳到“发布设置”和“调用记录”

## 3.2 外部只读页

用于分享给真正的接入方。

建议路由：

```text
/open-api-docs/:slug
```

或直接由前端调用：

```text
GET /open-api/v1/workflows/:slug/docs
```

特点：

- 只读
- 不展示后台编辑能力
- 不直接暴露已有 Key 明文
- 可由工作流拥有者单独复制 Key 发给对方

---

## 4. 页面结构

建议采用接近 Dify 的双栏布局。

## 4.1 左侧信息区

用于解释“这个 API 是什么、怎么调、有哪些规则”。

模块建议顺序：

1. API 标题区
2. 基本信息
3. 鉴权说明
4. 请求说明
5. 响应说明
6. 异步说明
7. Artifact 下载说明
8. 错误码说明
9. 更新记录

## 4.2 右侧示例区

用于展示“复制即可用”的代码。

模块建议：

1. 语言切换 Tabs
2. 请求示例代码块
3. 示例响应代码块
4. 复制按钮
5. 快速切换 `wait / async`

建议语言首批支持：

- `curl`
- `JavaScript`
- `Python`

---

## 5. 页面模块详细设计

## 5.1 标题区

展示：

- API 名称
- 简短描述
- 状态标记：`Published`
- 最近更新时间
- Base URL
- 请求方法
- 路径

示例：

```text
文章摘要 API
输入标题和正文，返回摘要、关键词和导出文档

POST https://api.example.com/open-api/v1/workflows/article-summary/invoke
```

## 5.2 基本信息

字段建议：

- API 名称
- 工作流名称
- 项目名称
- 发布版本
- 返回模式：`json / artifact / mixed`
- 默认执行模式：`wait / async`
- 超时时间

## 5.3 鉴权说明

明确告诉对方：

- 使用 `X-API-Key`
- 请求头格式
- Key 由工作流拥有者分发
- 不支持匿名调用

示例：

```text
X-API-Key: your_api_key_here
Content-Type: application/json
```

## 5.4 请求说明

分成三部分：

### 请求格式

```json
{
  "input": {},
  "options": {}
}
```

### 字段说明表

建议字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `input` | object | 是 | 业务输入参数 |
| `options.responseMode` | string | 否 | `wait` 或 `async` |
| `options.waitTimeoutSeconds` | number | 否 | wait 模式最大等待秒数 |

### 输入示例

示例应来自发布配置中的 request example。

## 5.5 响应说明

根据 API 的 `result_mode` 自动切换展示。

### `json`

展示：

- 标准响应结构
- `data.result`

### `artifact`

展示：

- `requestId`
- `artifacts`
- `downloadUrl`

### `mixed`

展示：

- 结构化结果
- artifact 列表

## 5.6 异步说明

当支持 `async` 时，必须有独立模块。

写清楚：

1. 调用 `invoke`
2. 得到 `requestId`
3. 轮询结果接口
4. 若有 artifact，再下载文件

建议配流程说明：

```text
invoke -> requestId -> query result -> get artifacts -> download
```

## 5.7 Artifact 下载说明

仅当结果模式包含 artifact 时展示。

内容包括：

- 哪些格式会生成文件
- 如何获取 artifact 列表
- 如何下载
- 下载链接是否长期有效

## 5.8 错误码说明

首期建议固定一组通用错误码：

| code | 含义 |
|------|------|
| `400` | 请求参数错误 |
| `401` | API Key 缺失或无效 |
| `403` | API 已停用或 Key 已禁用 |
| `404` | API 不存在 |
| `409` | 当前状态不可调用 |
| `429` | 超过限流 |
| `500` | 服务器内部错误 |

## 5.9 更新记录

可先做轻量版本：

- 发布时间
- 最后更新时间

后续再扩展为版本历史。

---

## 6. 页面交互要求

## 6.1 复制体验

页面应支持一键复制：

- 完整 URL
- Header 示例
- 请求示例
- `curl`
- `JavaScript`
- `Python`

## 6.2 模式切换

右侧代码示例至少支持切换：

- `wait`
- `async`

切换后自动更新：

- 请求体中的 `options.responseMode`
- 示例响应
- 轮询说明

## 6.3 语言切换

代码示例支持 Tab：

- `curl`
- `JavaScript`
- `Python`

切换后内容使用同一份元数据自动生成。

## 6.4 状态提示

若 API 未发布或已停用：

- 页面顶部展示明显状态
- 外部页不再给出可调用代码

---

## 7. 后端数据契约

建议由后端直接返回文档页渲染需要的结构化数据，而不是前端自己拼装。

接口：

```text
GET /open-api/v1/workflows/:slug/docs
```

建议返回结构：

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "api": {
      "name": "文章摘要 API",
      "description": "输入标题和正文，返回摘要与关键词",
      "status": "active",
      "method": "POST",
      "baseUrl": "https://api.example.com",
      "path": "/open-api/v1/workflows/article-summary/invoke",
      "fullUrl": "https://api.example.com/open-api/v1/workflows/article-summary/invoke",
      "defaultResponseMode": "wait",
      "resultMode": "mixed",
      "waitTimeoutSeconds": 15,
      "publishedAt": "2026-03-16T10:00:00Z",
      "updatedAt": "2026-03-16T12:00:00Z"
    },
    "auth": {
      "type": "x-api-key",
      "headerName": "X-API-Key",
      "example": "your_api_key_here",
      "description": "由 API 拥有者发放"
    },
    "request": {
      "contentType": "application/json",
      "schema": {
        "type": "object"
      },
      "fields": [
        {
          "name": "input",
          "type": "object",
          "required": true,
          "description": "业务输入参数"
        },
        {
          "name": "options.responseMode",
          "type": "string",
          "required": false,
          "description": "wait 或 async"
        },
        {
          "name": "options.waitTimeoutSeconds",
          "type": "number",
          "required": false,
          "description": "wait 模式等待秒数"
        }
      ],
      "example": {
        "input": {
          "title": "示例标题",
          "content": "示例正文"
        },
        "options": {
          "responseMode": "wait",
          "waitTimeoutSeconds": 15
        }
      }
    },
    "response": {
      "resultMode": "mixed",
      "waitExample": {
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
      },
      "asyncExample": {
        "code": 202,
        "message": "accepted",
        "data": {
          "requestId": "req_xxx",
          "status": "running",
          "queryUrl": "/open-api/v1/invocations/req_xxx"
        }
      }
    },
    "artifacts": {
      "enabled": true,
      "listUrlTemplate": "/open-api/v1/invocations/{requestId}/artifacts",
      "downloadUrlTemplate": "/open-api/v1/invocations/{requestId}/artifacts/{artifactId}/download",
      "description": "当工作流产生文件时，通过上述接口查询和下载"
    },
    "errors": [
      { "code": 400, "message": "bad request" },
      { "code": 401, "message": "invalid api key" },
      { "code": 403, "message": "endpoint disabled" },
      { "code": 429, "message": "rate limit exceeded" },
      { "code": 500, "message": "internal server error" }
    ],
    "codeSamples": {
      "curl": "curl --request POST ...",
      "javascript": "const response = await fetch(...);",
      "python": "response = requests.post(...)"
    }
  }
}
```

---

## 8. 代码示例生成规则

代码示例不要写死在页面里，应由后端或前端根据统一模板生成。

建议做法：

- 后端返回 `codeSamples`
- 若后端暂不生成，则前端基于 `api/auth/request` 元数据拼接

## 8.1 curl

示例应包含：

- `POST`
- `Content-Type`
- `X-API-Key`
- 完整 JSON body

## 8.2 JavaScript

建议基于 `fetch`

示例应包含：

- `method`
- `headers`
- `JSON.stringify(body)`
- `await response.json()`

## 8.3 Python

建议基于 `requests`

示例应包含：

- `headers`
- `json=payload`
- `response.json()`

---

## 9. 示例内容来源

## 9.1 请求示例来源

优先级建议：

1. 发布配置中手工填写的 request example
2. request schema 自动生成空示例
3. 若都没有，给出最小通用结构

## 9.2 响应示例来源

优先级建议：

1. 最近一次成功调用快照
2. 发布配置中手工维护的 response example
3. 系统默认结构模板

## 9.3 Artifact 说明来源

来自：

- 输出节点配置
- 实际执行结果中的 artifact

---

## 10. 前端实现建议

建议新增页面组件：

- `ApiDocsPage`
- `ApiDocsHeader`
- `ApiDocsAuthCard`
- `ApiDocsRequestCard`
- `ApiDocsResponseCard`
- `ApiDocsArtifactsCard`
- `ApiDocsErrorCodesCard`
- `ApiCodeSamplePanel`

建议路由：

- 站内：`/workflow-apis/:id/docs`
- 外部：`/open-api-docs/:slug`

建议 UI 特点：

- 干净、偏开发者文档风格
- 信息密度高，但可快速复制
- 桌面端双栏，移动端单栏折叠

---

## 11. 状态与边界处理

## 11.1 未发布

展示：

- “该 API 尚未发布”
- 不展示对外调用代码

## 11.2 已停用

展示：

- “该 API 已停用”
- 保留历史说明
- 不给出有效调用建议

## 11.3 无 artifact

隐藏：

- Artifact 下载说明模块

## 11.4 仅 async

隐藏：

- wait 示例响应

## 11.5 仅 wait

隐藏：

- 轮询说明

---

## 12. MVP 必做项

- 自动生成接入文档页
- 支持 `curl / JavaScript / Python`
- 支持 `wait / async` 示例切换
- 支持请求示例、响应示例、错误码说明
- 支持 artifact 场景说明
- 支持站内预览和外部只读访问

---

## 13. 后续增强项

- 生成 OpenAPI 3.0 文档
- 下载 Postman Collection
- 下载示例 SDK
- 接入调试台
- 多版本文档切换

---

## 14. 一句话结论

“像 Dify 那样的接入文档”不是附属说明，而应该是工作流 API 发布后的标准产物之一。

对这个项目来说，最合适的做法是：

- 工作流发布后自动生成一页开发者文档
- 文档内容基于发布配置和最近成功结果动态生成
- 对外开发者看到的是“能直接复制调用”的页面，而不是后台术语页
