# 数据协议与强类型检查 PRD

## 1. 背景

当前系统已有若干与 Schema 相关的基础能力：
- `node_types.config_schema` 用于描述节点配置表单
- 工作流数据流有统一 `NodeData` 包装结构
- 开放 API 已有 request/response example 概念

但这些能力并不等于“节点间数据协议”。  
现在仍缺少：
- 每类节点标准输入/输出定义
- 连线阶段的协议校验
- 运行前静态检查
- 输出 Schema 演进管理

## 2. 目标

- 建立节点输入/输出 Schema Registry。
- 为节点输出定义标准 JSON Schema。
- 在连线阶段校验上游输出是否兼容下游输入。
- 在执行前给出明确的协议风险提示，提升稳定性。

## 3. 非目标

- 本期不要求所有历史节点一次性补齐完整 schema。
- 本期不做 IDE 级代码生成。
- 本期不要求所有用户自定义表达式都拥有完备静态类型推导。

## 4. 用户价值

- 用户在画布上连线时就能发现类型不匹配，而不是运行后才报错。
- AI 助手生成工作流时可参考更明确的节点数据协议。
- 复杂工作流更容易维护、复用和排查。

## 5. 核心概念

### 5.1 节点输入/输出 Schema

- 每类节点定义：
  - `inputSchema`
  - `outputSchema`
  - `examples`

### 5.2 兼容性判定

- 兼容
- 可转换
- 不兼容

### 5.3 Schema 版本

- 支持版本号
- 节点升级时保留旧版本兼容信息

## 6. 功能需求

### 6.1 Registry 管理

- 系统节点内置官方 Schema
- 管理端可查看节点协议定义
- 后续支持自定义节点上传协议定义

### 6.2 连线校验

- 用户拖拽连线时，立即校验 source output 与 target input
- 不兼容时：
  - 阻止连线
  - 或弹提示要求插入转换节点

### 6.3 保存前校验

- 保存工作流时执行一次全图协议扫描
- 输出：
  - 错误
  - 警告
  - 自动修复建议

### 6.4 运行前校验

- 执行前再次校验关键节点协议
- 对动态结构未知的节点给出风险提示，但不一刀切阻止

## 7. 与现有模块集成

### 7.1 AI 助手

- Alkaid 获取节点规格时可直接使用结构化输入输出 schema
- 提高 AI 生成工作流的稳定性

### 7.2 开放 API

- 后续可基于 Registry 自动导出工作流请求/响应 schema
- 与 Workflow API 发布能力打通

### 7.3 生成物管理

- 输出节点可声明 artifact schema，例如：
  - `text/markdown`
  - `application/pdf`
  - `image/png`

## 8. 协议建模建议

### 8.1 系统节点优先补齐

- `start`
- `crawler`
- `dataclean`
- `ai`
- `condition`
- `transform`
- `merge`
- `loop`
- `output`

### 8.2 典型协议示例

- 爬虫节点输出：
  - `{ url, title, content, html, metadata }`
- AI 节点输出：
  - `{ content, reasoningContent?, usage?, model }`
- 输出节点：
  - `{ artifactId?, downloadUrl?, content?, format }`

## 9. 异常处理与自愈

- 对“可转换”类型，系统给出自动补救建议：
  - 插入 transform 节点
  - 插入 dataclean 节点
  - 修改字段映射

- 对“未知 Schema”节点，允许降级为 warning，不强制阻塞

## 10. 数据模型建议

建议新增：
- `node_io_schemas`
- `workflow_schema_snapshots`

节点 Schema 字段建议：
- `node_type`
- `version`
- `input_schema`
- `output_schema`
- `compatibility_rules`
- `examples`

## 11. 前端需求

- 连线时显示兼容状态颜色
- 节点面板新增“输入/输出协议”页签
- 保存前弹出协议校验报告

## 12. 验收标准

- 系统节点中至少 5 类节点拥有可运行的输入/输出 Schema
- 连线阶段可识别至少三种结果：兼容、可转换、不兼容
- 保存前协议扫描可输出具体错误节点和边
- AI 助手生成工作流时可引用结构化节点协议

## 13. 优先级

- P0：Registry 数据结构 + 连线兼容判断
- P1：保存前全图扫描 + 前端提示
- P2：自动修复建议 + OpenAPI schema 导出

