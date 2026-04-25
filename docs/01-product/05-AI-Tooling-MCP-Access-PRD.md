# AI 工具接入与 MCP 能力规划

## 1. 背景

YaoLight 已经具备项目、工作流、任务、日志、知识库、工件、模型配置等平台对象。这些对象天然适合被 AI 工具读取、理解、诊断和调用。

当前用户使用 Codex、Cursor、Claude Desktop、ChatGPT 等 AI 工具时，AI 无法直接理解 YaoLight 的业务对象，只能依赖用户手动复制页面信息或接口结果。MCP 可以作为 AI 工具和 YaoLight 平台之间的结构化工具层，让 AI 通过明确的工具访问平台能力。

目标不是简单增加一个接口，而是让 AI 能够围绕 YaoLight 的真实业务对象完成工作，例如：

- 分析某个工作流为什么失败
- 查询任务日志并定位异常节点
- 读取工作流节点配置并给出修复建议
- 帮用户找到项目、工作流、工件和知识条目
- 在确认后运行指定工作流

## 2. 定位

MCP 能力应定位为 YaoLight 的 AI 工具接入层。

建议整体结构：

```text
Codex / Cursor / Claude Desktop / 其他 AI 工具
  ↓ 本地启动
YaoLight MCP Server
  ↓ HTTPS
YaoLight Backend API
  ↓
Postgres / Redis / Storage
```

MCP Server 通常运行在 AI 工具所在的用户电脑上，而不是运行在 YaoLight 管理后台页面里。管理后台和用户端页面负责开通、授权、配置、审计；MCP Server 负责被 AI 客户端调用，并访问 YaoLight API。

## 3. 放置位置建议

### 3.1 用户端

用户端适合放主要入口，因为 MCP 是用户把自己的 AI 工具接入 YaoLight。

建议菜单：

```text
用户端 -> 设置 -> AI 工具接入
```

第一阶段页面能力：

- 创建 MCP Token
- 查看自己的 Token 列表
- 吊销自己的 Token
- 复制 Codex / Cursor / Claude Desktop 配置
- 查看自己的 MCP 调用记录
- 显示安装与使用说明

### 3.2 管理端

管理端适合放平台治理能力，而不是作为用户主要接入口。

建议菜单：

```text
管理端 -> 系统设置 -> AI 工具接入
```

管理端能力：

- 全局开关：是否启用 MCP 接入
- 默认 Token 有效期
- 默认权限范围
- 全站调用日志
- 高风险调用审计
- 禁用某个用户的 MCP Token
- 查看用户接入状态

### 3.3 MCP Server 本身

第一阶段建议以本地进程方式运行：

```text
用户本地 AI 工具
  ↓
npx yaolight-mcp
  ↓
https://www.yaolight.site/api
```

后续成熟后可以再考虑远程 MCP：

```text
AI 工具
  ↓
https://mcp.yaolight.site
  ↓
YaoLight API
```

远程 MCP 会带来多租户鉴权、限流、审计、权限隔离等复杂度，不建议作为第一阶段目标。

## 4. 适合优先开放的能力

第一阶段应优先开放只读能力。只读能力风险低，AI 使用价值高，适合验证产品价值。

建议第一批 MCP 工具：

```text
get_current_user
list_projects
get_project
list_workflows
get_workflow
get_workflow_nodes
get_task
get_task_logs
```

典型场景：

```text
用户：帮我看看这个工作流为什么失败了。

AI 调用：
1. list_workflows
2. get_workflow
3. get_task
4. get_task_logs
5. get_workflow_nodes

AI 输出：
失败节点、错误原因、可能修复方式、下一步建议。
```

## 5. 第二阶段能力

第二阶段可以加入受控执行类能力。此类能力会改变系统状态，因此必须配合权限、确认和审计。

建议能力：

```text
run_workflow
cancel_task
retry_task
list_artifacts
get_artifact
download_artifact
search_project_knowledge
list_available_models
```

使用原则：

- 执行工作流前必须让 AI 展示将要执行的工作流和输入参数
- 取消任务、重试任务必须记录审计日志
- 下载工件要校验用户权限
- 搜索知识库只返回当前用户有权限访问的项目内容

## 6. 第三阶段能力

第三阶段才适合开放编辑类能力。

建议能力：

```text
create_project
create_workflow
update_workflow_metadata
propose_workflow_patch
apply_workflow_patch
create_project_knowledge
publish_workflow_api
```

这类能力必须具备：

- Preview
- Diff
- 用户确认
- 审计日志
- 可回滚策略

尤其是 `apply_workflow_patch`，建议先与现有 Alkaid 工作流补丁机制保持一致，让 AI 先提出补丁，由用户在 UI 中确认后再落库。

## 7. 暂不建议开放的能力

第一阶段不建议开放高风险能力：

```text
delete_project
delete_workflow
delete_user
modify_rbac
modify_billing
grant_quota
reset_password
bulk_delete
admin_system_config_write
```

这些能力即使后续开放，也应只对管理员开放，并且必须具备强确认、审计和回滚策略。

## 8. Token 与权限设计

建议新增独立的 MCP Token，不直接复用用户登录 JWT。

原因：

- JWT 适合登录会话，不适合长期本地工具接入
- MCP Token 可以单独吊销
- MCP Token 可以绑定权限范围
- MCP Token 可以设置有效期和最后使用时间
- MCP Token 可以记录调用来源

建议 Token 字段：

```text
id
user_id
name
token_hash
scopes
expires_at
last_used_at
last_used_ip
revoked_at
created_at
updated_at
```

建议权限范围：

```text
projects:read
workflows:read
workflows:execute
tasks:read
artifacts:read
knowledge:read
models:read
```

后续再考虑：

```text
projects:write
workflows:write
knowledge:write
admin:read
```

## 9. 调用日志设计

建议记录每次 MCP 工具调用，方便排查和审计。

建议字段：

```text
id
user_id
token_id
tool_name
request_summary
resource_type
resource_id
status
error_message
latency_ms
ip
user_agent
created_at
```

注意：

- 不建议完整记录敏感输入
- 可以记录参数摘要和资源 ID
- 对执行类工具应记录完整审计上下文

## 10. 用户端配置示例

用户端页面可以生成配置片段，方便用户复制到 AI 工具。

示例：

```json
{
  "mcpServers": {
    "yaolight": {
      "command": "npx",
      "args": ["yaolight-mcp"],
      "env": {
        "YAOLIGHT_BASE_URL": "https://www.yaolight.site/api",
        "YAOLIGHT_TOKEN": "yl_mcp_xxx"
      }
    }
  }
}
```

## 11. CLI 与 MCP 的关系

CLI 可以作为 MCP 的底层执行器，也可以作为独立调试工具。

建议结构：

```text
YaoLight MCP Server
  ↓
YaoLight CLI 或 HTTP Client
  ↓
YaoLight Backend API
```

当前已验证的 CLI 方向：

```text
yaolight login
yaolight me
yaolight projects list
yaolight workflows list
yaolight workflows get --nodes
yaolight tasks get
yaolight tasks logs
yaolight api get
```

后续 MCP 可以优先复用这些能力，也可以直接用 HTTP Client 调用 API。

从产品化角度看：

- CLI 适合开发者、服务器运维、本地调试
- MCP 适合 AI 工具调用
- 用户端设置页适合 Token 管理和配置分发
- 管理端适合全局治理和审计

## 12. 推荐实施路线

### Phase 1：只读 MVP

目标：让 AI 能读懂 YaoLight 的项目、工作流和任务。

范围：

- 新增 MCP Token 表
- 新增 Token 创建、列表、吊销接口
- 用户端设置页展示 Token 与配置
- MCP Server 提供 8 个只读工具
- 记录基础调用日志

工具：

```text
get_current_user
list_projects
get_project
list_workflows
get_workflow
get_workflow_nodes
get_task
get_task_logs
```

### Phase 2：诊断增强

目标：让 AI 可以完整分析失败任务。

范围：

- 获取任务节点执行记录
- 获取工件列表
- 搜索项目知识
- 查看可用模型
- 增强调用日志和错误摘要

新增工具：

```text
get_task_node_executions
list_task_artifacts
list_project_artifacts
search_project_knowledge
list_available_models
```

### Phase 3：受控执行

目标：让 AI 在用户确认后运行工作流和处理任务。

范围：

- 执行工作流
- 取消任务
- 重试任务
- 执行前参数预览
- 执行类审计日志

新增工具：

```text
run_workflow
cancel_task
retry_task
```

### Phase 4：编辑与协作

目标：让 AI 能参与工作流创建和修复，但最终由用户确认。

范围：

- 创建工作流草稿
- 提出工作流补丁
- 应用工作流补丁
- 与 Alkaid 补丁机制整合

新增工具：

```text
create_workflow_draft
propose_workflow_patch
apply_workflow_patch
```

## 13. MVP 验收标准

Phase 1 可以用下面标准验收：

- 用户可以在设置页创建 MCP Token
- 用户可以复制 MCP 配置到 AI 工具
- AI 工具可以调用 `list_projects`
- AI 工具可以调用 `list_workflows`
- AI 工具可以读取指定工作流节点
- AI 工具可以读取指定任务日志
- 用户可以吊销 Token
- 被吊销 Token 立即不可用
- 后台可以看到基础调用日志

## 14. 一句话结论

MCP 很适合 YaoLight，但第一阶段应从用户端入口和只读诊断能力开始。管理端负责治理，用户端负责接入，MCP Server 在 AI 工具本地运行，通过 HTTPS 调用 YaoLight API。
