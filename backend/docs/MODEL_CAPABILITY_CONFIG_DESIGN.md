# 模型能力配置表设计方案

## 目标

- 按 **provider + model_name** 存储每个模型的**能力开关**（0/1），与计费表维度一致。
- 0/1 表示「是否支持」；用户是否启用、具体取值（温度、深度思考等）由节点/用户配置决定。
- 支持扩展：子配置（如图片生成的分辨率、尺寸）用 JSONB 描述，不加死列。

## 表结构：model_capability_configs

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 主键 |
| provider | varchar(50) | 供应商，与计费表一致 |
| model_name | varchar(100) | 模型名，与计费表一致 |
| support_temperature | bool default true | 支持调节温度 |
| support_max_tokens | bool default true | 支持 max_tokens |
| support_top_p | bool default true | 支持 top_p |
| support_stream | bool default false | 支持流式输出 |
| support_thinking | bool default false | 支持深度思考(DeepSeek) |
| support_thinking_level | bool default false | 支持思考档位(豆包) |
| support_enable_thinking | bool default false | 支持思考开关(通义) |
| support_frequency_penalty | bool default false | 支持频率惩罚 |
| support_presence_penalty | bool default false | 支持存在惩罚 |
| support_stop_sequences | bool default false | 支持停止序列 |
| support_vision | bool default false | 支持图像输入 |
| support_image_generation | bool default false | 支持图像生成 |
| max_tokens_limit | int default 32768 | 该模型最大 token 上限 |
| capability_options | jsonb nullable | 子配置，如 image_generation.resolutions |
| display_name | varchar(200) | 展示名（可选） |
| sort_order | int default 0 | 排序 |
| is_active | bool default true | 是否启用 |
| created_at, updated_at, deleted_at | | 常规审计 |

唯一约束：`(provider, model_name)`。

## 接口与接入

1. **已实现**  
   - `GET /api/ai/model-capabilities?provider=xxx&model_name=xxx`：按 provider+model 查一条，返回能力与 max_tokens_limit、capability_options。  
   - `GET /api/ai/providers/templates`：响应中每个 provider 增加 `modelCapabilities`，为 `{ [modelName]: { support_*, max_tokens_limit, capability_options } }`，便于前端一次拉取。

2. **执行/列表处**  
   - 工作流执行、模型列表展示时，按 (provider, model_name) 查本表；若无记录则回退到代码默认（现有逻辑），保证兼容。

3. **前端**  
   - 用接口返回的 capabilities 控制表单项显隐、maxTokens 上限；逐步去掉前端按 provider 的硬编码。

## 子配置（图片生成等）

- `capability_options` 示例：  
  `{"image_generation":{"resolutions":["1024x1024","512x512"],"default_resolution":"1024x1024"}}`  
- 后台维护该 JSON；前端根据 support_image_generation 与 capability_options 渲染分辨率等控件；用户选择存节点 config。

## 实施顺序

1. 后端：GORM 模型 + 迁移（AutoMigrate）+ Seed（按计费表生成默认能力行）。  
2. 后端：Repository + Service + 读接口（按 provider+model 返回能力）。  
3. 后端：在 GetProviderTemplates 或系统预设模型中附带 capabilities（可选）。  
4. 前端：调用新接口，用 capabilities 驱动 UI，替换硬编码。
