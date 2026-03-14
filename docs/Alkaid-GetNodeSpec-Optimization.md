# 瑶光星 `get_node_spec` 工具优化说明

## 1. 本次修复目标

本轮优化聚焦两个问题：

1. `get_node_spec` 工具本身不稳：
   - `nodeType` 为空时不会报错
   - 未知节点类型会被当成“成功返回一个 error 对象”
   - 节点类型输入缺少标准化和别名兼容

2. 工具调用协议会泄漏到用户对话：
   - DeepSeek 在部分场景会把工具调用写进 `content`
   - 典型表现为前端直接看到：
     - `<｜DSML｜function_calls> ... </｜DSML｜function_calls>`

## 2. 已完成修复

### 2.1 `get_node_spec` 参数校验与错误语义

文件：
- `Low_code_Backend/modules/alkaid/services/tools/get_node_spec.go`

修复内容：

- 对 `nodeType` 做了标准化处理：
  - 去前后空格
  - 小写化
  - 兼容常见别名，如：
    - `merge_node` -> `merge`
    - `data-clean` -> `dataclean`
    - `output-node` -> `output`

- `nodeType` 为空时，改为真正返回错误。
- 节点类型不存在时，改为真正返回错误，而不是返回一个带 `error` 字段的成功结果。
- 错误信息里带上当前支持的节点类型列表，便于模型和后续排障使用。

### 2.2 DSML 工具调用兼容解析

文件：
- `Low_code_Backend/modules/ai/services/providers/deepseek/deepseek_provider.go`

修复内容：

- 为 DeepSeek 增加了 DSML 工具调用兼容解析。
- 当响应里没有标准 `tool_calls`，但 `content` 中包含：
  - `<｜DSML｜function_calls>`
  - `<｜DSML｜invoke ...>`
  - `<｜DSML｜parameter ...>`

  会自动把它解析成内部 `ToolCall` 结构，而不是当作普通回复文本。

- 解析后会把 DSML 标签从 `content` 中剥离，避免直接泄漏给前端用户。

### 2.3 带工具的流式输出收口

文件：
- `Low_code_Backend/modules/ai/services/providers/deepseek/deepseek_provider.go`
- `Low_code_Backend/modules/alkaid/services/agentic/loop.go`

修复内容：

- 对带工具的 `ChatWithToolsStream` 做了保护：
  - 当存在工具定义时，不再把可能含 DSML 的中间 `content` 直接逐段推给前端
  - 先聚合，再判断是否是工具调用

- Agentic 最终总结阶段的流式输出改为 **无工具模式**：
  - 避免“最终回复流”再次混入工具调用协议
  - 保留正文流式体验

### 2.4 `Capabilities` 数据源稳定性和覆盖范围

文件：
- `Low_code_Backend/modules/alkaid/services/config_extractor.go`
- `Low_code_Backend/modules/alkaid/services/capabilities_service.go`

修复内容：

- `config_extractor` 改为优先使用源码文件自身位置推导 `workflow/services` 路径，不再依赖当前工作目录是否正确。
- 自动提取覆盖范围补充了：
  - `transform`
  - `loop`
  - `delay`

- `CapabilitiesService` 增加了短 TTL 内存缓存：
  - 降低 `get_node_spec` / `get_capabilities` 高频调用时反复扫源码的成本
  - 减少工具调用抖动

当前缓存 TTL：
- `15s`

## 3. 已补测试

新增测试：

- `Low_code_Backend/modules/ai/services/providers/deepseek/deepseek_provider_test.go`
  - 校验 DSML 工具调用是否能被正确解析
  - 校验普通文本不会误判为工具调用

- `Low_code_Backend/modules/alkaid/services/tools/get_node_spec_test.go`
  - 校验 `nodeType` 标准化
  - 校验空参数报错
  - 校验别名输入可用
  - 校验未知节点类型失败

## 4. 本轮未解决但值得继续做

以下问题已经明显收敛，但还不是最终形态：

### 4.1 `get_node_spec` 与 `get_capabilities` 仍有职责重叠

当前：
- `get_capabilities` 返回完整 `nodeTypes`
- `get_node_spec` 返回单节点规格

后续建议：
- 让 `get_capabilities` 负责全局约束和摘要
- 让 `get_node_spec` 只返回“模型当前需要的最小子集”
- 控制 token 体积，避免重复把整份 spec 喂回模型

### 4.2 配置提取器仍是“正则增强”，不是严格 AST 级抽取

当前：
- 能补齐默认值、部分 allowVars 和字段发现
- 但对条件必填、复杂枚举、动态约束的表达能力仍有限

后续建议：
- 如果后面继续扩节点体系，建议逐步转成 AST 或显式 schema 产物

### 4.3 节点类型别名还可以继续丰富

当前已覆盖常见别名，但不算完整自然语言映射。

后续建议：
- 增加面向模型常见输出的 alias
- 例如：
  - `data_clean_node`
  - `clean_node`
  - `output node`

## 5. 建议的下一步优化顺序

建议按以下顺序继续：

1. 继续压缩 `get_node_spec` 返回体，做“最小必要字段”版本。
2. 给工具调用链补更细的日志：
   - 原始模型返回是否含标准 `tool_calls`
   - 是否触发 DSML fallback
   - 最终执行了哪个工具
3. 对 `get_capabilities` / `get_node_spec` 做调用策略收敛，减少重复请求。
4. 如果后面节点管理体系继续扩展，再把正则提取升级为 AST / 构建期 schema。

## 6. 验证结果

本轮已执行：

```bash
go test ./modules/ai/services/providers/deepseek ./modules/alkaid/...
```

结果：
- 通过
