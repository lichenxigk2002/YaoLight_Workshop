# 管理端爬虫规则模块待做文档

## 1. 文档目标

本文档用于定义“管理端爬虫规则”模块的后端待做范围，统一以下内容：

- 当前实现现状
- 目标能力边界
- 一期与后续分期
- 数据模型与运行时配置映射
- 后端接口设计
- 与工作流执行链路的集成方式
- 验收标准、风险与实现顺序

本文档面向：

- 后端开发
- 管理端前端开发
- 产品/架构评审

## 2. 当前现状

### 2.1 已有能力

当前项目已经具备爬虫执行引擎的核心能力：

- HTTP 请求抓取
- Headers / Cookies / Proxy / Timeout / Retry
- Follow Redirect / SSL 校验
- 智能提取、文章提取、列表提取、链接提取、图片提取
- 自定义 CSS Selector 提取
- 分页抓取
- Headless 模式抓取 SPA 页面
- `waitForSelector`、`javascriptWait` 等动态页面等待能力

相关代码：

- `Low_code_Backend/modules/crawler/services/crawler_service.go`
- `Low_code_Backend/modules/crawler/services/headless_crawler.go`
- `Low_code_Backend/modules/workflow/services/crawler_node.go`

### 2.2 已有数据模型

当前已经存在 `CrawlerRule` 持久化实体：

- `Low_code_Backend/modules/crawler/models/crawler_rule.go`

当前模型中已经预留了大量规则中心需要的字段，例如：

- 基本信息：`name`、`description`、`version`
- 匹配规则：`url_pattern`、`url_pattern_type`
- 请求配置：`method`、`headers`、`params`、`body`、`cookies`
- 提取规则：`selectors`、`data_extraction`
- 分页规则：`pagination`
- 代理与执行：`proxy_config`、`timeout`、`retry_count`、`retry_delay`
- 浏览器行为：`javascript_enabled`、`wait_time`、`screenshot`
- 治理指标：`is_active`、`usage_count`、`success_rate`

### 2.3 当前缺口

当前缺少完整的“规则管理层”，具体表现为：

- 没有 `crawler_rules` 的 repository / service / controller
- 没有管理端专用接口
- 没有独立的规则测试接口
- 没有规则到运行时配置的统一映射器
- 工作流节点还不支持 `rule_id` 引用规则
- 统计、版本、引用关系尚未落地

结论：

- 爬虫引擎层已经可用
- 规则中心层尚未落地
- 该模块是“可实现但未完成”的状态

## 3. 模块目标

“管理端爬虫规则”模块的核心目标不是再造一个爬虫引擎，而是把分散在工作流节点中的爬虫配置沉淀为平台级资产。

模块应该支持：

- 统一维护可复用的爬虫规则模板
- 独立测试规则，不依赖完整工作流
- 规则启停、版本、复制、发布
- 统计规则使用情况和执行健康度
- 工作流节点引用规则并按需覆盖局部配置
- 后续支持规则治理和标准化接入

## 4. 业务价值

该模块落地后的价值：

- 降低重复配置成本
- 统一反爬配置和提取逻辑
- 避免每个工作流单独维护 selector
- 支持规则失效后的集中修复
- 为规则质量、命中率、成功率建立治理基础
- 为后续“规则模板市场 / 行业模板库”预留能力

## 5. 一期范围

一期建议只做“可上线最小闭环”。

### 5.1 一期必须完成

- 规则 CRUD
- 规则启用 / 禁用
- 规则测试接口
- 规则与运行时配置映射
- 工作流爬虫节点支持 `rule_id`
- 节点局部覆盖规则配置
- 使用次数与成功率基础统计
- 管理端列表页/详情页所需接口

### 5.2 一期可以不做

- 完整版本树
- 审批流
- 灰度发布
- 批量回滚
- 多环境规则隔离
- 复杂的 AB Test

## 6. 二期/后续能力

- 独立规则版本表
- 规则发布态与草稿态
- 规则变更审计
- 工作流引用影响分析
- 失效率告警
- 自动回归测试集
- 规则标签、分类、行业模板
- 导入/导出规则

## 7. 推荐后端目录结构

建议在 `modules/crawler` 下补齐如下结构：

```text
modules/crawler/
  controllers/
    admin_crawler_rule_controller.go
  repositories/
    crawler_rule_repository.go
  services/
    admin_crawler_rule_service.go
    crawler_rule_mapper.go
    crawler_rule_test_service.go
  docs/
    CRAWLER_RULES_TODO.md
```

如后续需要版本表，可继续增加：

```text
modules/crawler/
  models/
    crawler_rule_version.go
```

## 8. 数据结构设计

### 8.1 当前 `crawler_rules` 表的职责

`crawler_rules` 主表建议承担以下职责：

- 规则元数据
- 当前生效版本的默认配置
- 统计字段
- 启停状态

### 8.2 推荐字段职责说明

建议按以下语义使用当前字段：

- `name`: 规则名称
- `description`: 规则描述
- `version`: 当前规则版本号
- `url_pattern`: 规则命中的 URL 模式
- `url_pattern_type`: `regex | glob | exact`
- `method`: 默认请求方法
- `headers`: 默认请求头
- `params`: 查询参数
- `body`: 请求体
- `selectors`: selector 相关配置
- `data_extraction`: 提取规则配置
- `pagination`: 分页配置
- `proxy_config`: 代理配置
- `cookies`: 默认 cookie
- `timeout`: 请求超时
- `retry_count`: 重试次数
- `retry_delay`: 重试延迟
- `user_agent`: 默认 UA
- `follow_redirects`: 是否跟随重定向
- `verify_ssl`: 是否验证证书
- `wait_time`: 请求后等待时间
- `javascript_enabled`: 是否使用 Headless
- `screenshot`: 是否截图
- `is_active`: 启停状态
- `usage_count`: 使用次数
- `success_rate`: 成功率
- `created_by`: 创建人

### 8.3 建议的 JSON 结构

为减少“表字段很多但语义不统一”的问题，建议统一约定以下 JSON Schema。

#### selectors

```json
{
  "primary": ".article-content",
  "fallback": [".content", "article", "#main"],
  "wait_for_selector": ".article-content"
}
```

#### data_extraction

```json
{
  "mode": "custom",
  "extract_type": "text",
  "extract_attr": "",
  "smart_mode": false
}
```

其中：

- `mode`: `smart | article | list | links | images | custom`
- `extract_type`: `text | html | link | image | attr | all`

#### pagination

```json
{
  "enabled": true,
  "selector": ".next-page",
  "page_param": "page",
  "start_page": 1,
  "max_pages": 5,
  "increment": 1
}
```

#### proxy_config

```json
{
  "enabled": false,
  "url": "http://127.0.0.1:7890"
}
```

#### cookies

```json
{
  "session_id": "xxx",
  "auth_token": "yyy"
}
```

## 9. 运行时映射设计

### 9.1 问题

当前工作流执行层使用的是 `CrawlerConfig`，而规则中心存的是 `CrawlerRule`。两者字段语义接近，但不完全一致。

因此必须新增统一映射器：

- `crawler_rule_mapper.go`

### 9.2 映射目标

将 `CrawlerRule` 转为运行时 `CrawlerConfig`。

映射关系建议如下：

- `url_pattern` 不参与执行，仅用于规则匹配
- `method -> Method`
- `headers -> Headers`
- `cookies -> Cookies`
- `timeout -> Timeout`
- `retry_count -> RetryCount`
- `retry_delay -> RetryDelay`
- `user_agent -> UserAgent`
- `follow_redirects -> FollowRedirect`
- `verify_ssl -> VerifySSL`
- `wait_time -> WaitTime`
- `javascript_enabled -> UseHeadless`
- `proxy_config.url -> Proxy`
- `selectors.primary -> Selector`
- `selectors.wait_for_selector -> WaitForSelector`
- `data_extraction.mode -> ExtractMode`
- `data_extraction.extract_type -> ExtractType`
- `data_extraction.extract_attr -> ExtractAttr`
- `pagination -> Pagination`

### 9.3 局部覆盖规则

工作流节点引用规则后，运行时需要按以下优先级合并：

1. 节点覆盖配置
2. 规则默认配置
3. 系统默认值

例如：

- 规则中定义 `extractMode=article`
- 某工作流节点只覆盖 `timeout=60`
- 最终执行配置为：规则其余字段 + 节点 timeout

### 9.4 推荐实现方法

建议新增两个方法：

- `MapRuleToCrawlerConfig(rule *CrawlerRule) (CrawlerConfig, error)`
- `MergeCrawlerConfig(base CrawlerConfig, override map[string]interface{}) (CrawlerConfig, error)`

## 10. 工作流集成设计

### 10.1 当前状态

当前爬虫节点直接从节点配置构造 `CrawlerConfig` 并执行。

### 10.2 目标状态

爬虫节点支持两种模式：

- 纯节点本地配置模式
- `rule_id` 引用规则模式

### 10.3 节点推荐配置结构

```json
{
  "ruleId": 1001,
  "url": "{{start.data.url}}",
  "timeout": 60,
  "headers": {
    "Authorization": "Bearer {{token}}"
  }
}
```

语义如下：

- `ruleId` 指向规则中心
- 其余字段视为对规则的覆盖

### 10.4 执行流程

1. 读取节点配置
2. 若存在 `ruleId`，先加载规则
3. 将规则映射为 `CrawlerConfig`
4. 将节点字段覆盖到 `CrawlerConfig`
5. 再执行现有 `crawlerService.Execute`

### 10.5 当前需要修改的文件

- `Low_code_Backend/modules/workflow/services/crawler_node.go`

主要增加：

- 识别 `ruleId`
- 从 repository/service 拉取规则
- 做配置合并
- 保持原有无规则模式兼容

## 11. 后端接口设计

### 11.1 管理接口路由

建议新增路由组：

- `/api/admin/crawler-rules`

需要接入 `AdminOnlyMiddleware()`

### 11.2 接口列表

#### 1. 获取规则列表

`GET /api/admin/crawler-rules`

查询参数建议：

- `keyword`
- `is_active`
- `created_by`
- `page`
- `page_size`
- `sort_by`
- `sort_order`

返回：

- 列表
- 总数
- 分页信息

#### 2. 获取规则详情

`GET /api/admin/crawler-rules/:id`

#### 3. 创建规则

`POST /api/admin/crawler-rules`

#### 4. 更新规则

`PUT /api/admin/crawler-rules/:id`

#### 5. 删除规则

`DELETE /api/admin/crawler-rules/:id`

建议使用软删除。

#### 6. 启用/禁用规则

`PATCH /api/admin/crawler-rules/:id/status`

请求体示例：

```json
{
  "is_active": true
}
```

#### 7. 测试规则

`POST /api/admin/crawler-rules/test`

请求体建议同时支持两种方式：

- 直接传完整规则体
- 传 `rule_id + test_url + override`

示例：

```json
{
  "rule_id": 1001,
  "test_url": "https://example.com/article/123",
  "override": {
    "timeout": 60
  }
}
```

返回建议：

```json
{
  "success": true,
  "data": {},
  "raw_html": "<html>...</html>",
  "status_code": 200,
  "response_time": 1240,
  "error": "",
  "debug": {}
}
```

#### 8. 获取规则引用关系

`GET /api/admin/crawler-rules/:id/usages`

返回：

- 被哪些 workflow 引用
- 被哪些 node 引用
- 最近使用时间

#### 9. 复制规则

`POST /api/admin/crawler-rules/:id/clone`

用于快速生成新版本。

## 12. Repository 设计

建议新增 `crawler_rule_repository.go`，至少包含：

- `FindByID(id uint) (*CrawlerRule, error)`
- `List(query ListCrawlerRulesQuery) ([]CrawlerRule, int64, error)`
- `Create(rule *CrawlerRule) error`
- `Update(rule *CrawlerRule) error`
- `Delete(id uint) error`
- `UpdateStatus(id uint, isActive bool) error`
- `IncrementUsage(id uint) error`
- `UpdateMetrics(id uint, success bool) error`

如二期做版本：

- `FindLatestVersionByName(name string)`
- `CreateVersion(version *CrawlerRuleVersion)`

## 13. Service 设计

### 13.1 AdminCrawlerRuleService

职责：

- 参数校验
- CRUD 业务逻辑
- 状态切换
- 规则复制
- 统计字段回写

建议方法：

- `ListRules`
- `GetRule`
- `CreateRule`
- `UpdateRule`
- `DeleteRule`
- `SetRuleStatus`
- `CloneRule`

### 13.2 CrawlerRuleTestService

职责：

- 规则测试
- 将规则映射为 `CrawlerConfig`
- 合并测试覆盖参数
- 返回标准化调试结果

建议方法：

- `TestRule(req TestCrawlerRuleRequest) (*CrawlerResult, error)`

### 13.3 CrawlerRuleMapper

职责：

- 规则实体到运行配置映射
- 规则配置与节点配置合并

## 14. Controller 设计

建议新增：

- `admin_crawler_rule_controller.go`

控制器职责：

- 参数绑定
- 身份校验
- 调用 service
- 返回统一 JSON

建议控制器方法：

- `ListRules`
- `GetRule`
- `CreateRule`
- `UpdateRule`
- `DeleteRule`
- `SetRuleStatus`
- `TestRule`
- `GetRuleUsages`
- `CloneRule`

## 15. 请求校验规则

建议做基础校验，避免脏数据进入系统。

### 15.1 必填项

- `name`
- `url_pattern`
- `url_pattern_type`

测试时额外要求：

- `test_url`

### 15.2 枚举校验

- `url_pattern_type`: `regex | glob | exact`
- `method`: `GET | POST | PUT | DELETE | PATCH`
- `data_extraction.mode`: `smart | article | list | links | images | custom`
- `data_extraction.extract_type`: `text | html | link | image | attr | all`

### 15.3 JSON 字段校验

以下字段需要保证是合法结构：

- `headers`
- `params`
- `body`
- `selectors`
- `data_extraction`
- `pagination`
- `proxy_config`
- `cookies`

## 16. 统计设计

一期先做轻量统计。

### 16.1 usage_count

触发时机：

- 工作流执行中某爬虫节点成功加载并使用规则

### 16.2 success_rate

建议统计口径：

- 只统计“使用了规则的爬虫节点执行结果”
- `success_rate = success_count / total_count`

如果不想改主表结构过多，一期可以：

- 仅维护 `usage_count`
- `success_rate` 通过简单累计计算更新

更稳妥的二期方式：

- 增加规则执行统计表

## 17. 版本设计建议

### 17.1 一期简化方案

先不单独建版本表，采用“复制规则”方案：

- 旧规则保留
- 新规则复制生成一条新记录
- `version` 字段递增

优点：

- 成本低
- 落地快

缺点：

- 历史关系表达不够清晰

### 17.2 二期正式方案

新增：

- `crawler_rule_versions`

主表存“当前版本元信息”，版本表存“每次发布快照”。

## 18. 与管理端前端的对接约定

管理端页面最少需要以下页面能力：

- 规则列表页
- 规则详情/编辑页
- 规则测试页或测试抽屉
- 引用关系页

后端应确保返回结构稳定，避免前端自己拼接复杂逻辑。

列表页建议返回：

- `id`
- `name`
- `version`
- `is_active`
- `url_pattern`
- `usage_count`
- `success_rate`
- `updated_at`
- `created_by`

## 19. 兼容性要求

该模块上线时，必须保证：

- 旧工作流继续可执行
- 不引用 `ruleId` 的爬虫节点行为不变
- 新增规则引用不会破坏现有执行链路
- 没有规则库时系统依然可跑原有工作流

## 20. 风险与注意事项

### 20.1 字段语义不一致风险

当前 `CrawlerRule` 和 `CrawlerConfig` 字段并非一一对应，必须通过 mapper 统一，否则后面会出现：

- 同一配置在不同地方名称不同
- 管理端填了但执行层没生效
- 节点覆盖规则逻辑混乱

### 20.2 Headless 资源风险

规则测试接口如果允许大量 Headless 调用，可能带来：

- CPU 高占用
- 内存波动
- 测试阻塞

建议：

- 限制并发
- 限制测试超时
- 管理端接口增加频控

### 20.3 代理与敏感信息风险

`headers`、`cookies`、`proxy_config` 可能包含敏感信息。

建议：

- 管理端列表不直接回显敏感字段
- 操作日志对敏感值脱敏
- 测试结果不回显完整凭证

### 20.4 规则变更影响范围风险

规则一旦被多个工作流复用，修改可能影响大量任务。

建议：

- 一期至少提供“引用关系查询”
- 长期需要版本和发布机制

## 21. 推荐实现顺序

### Phase 1

1. 新增 repository
2. 新增 service
3. 新增 controller
4. 接入 `main.go` 管理端路由
5. 完成 CRUD + 状态切换

### Phase 2

1. 新增 `crawler_rule_mapper.go`
2. 新增独立规则测试接口
3. 打通规则到 `CrawlerConfig` 的转换

### Phase 3

1. 修改工作流爬虫节点执行逻辑，支持 `ruleId`
2. 实现局部覆盖配置
3. 回写统计字段

### Phase 4

1. 新增引用关系查询
2. 新增复制规则
3. 补充测试用例

## 22. 验收标准

满足以下条件可认为一期完成：

- 管理端可以新增、编辑、删除、启停爬虫规则
- 管理端可以输入测试 URL 独立测试规则
- 规则测试结果可返回提取结果、状态码、耗时、报错
- 工作流爬虫节点可以通过 `ruleId` 引用规则
- 节点仍然可以局部覆盖超时、Header、URL 等字段
- 不使用规则的旧工作流行为不变
- 基础统计字段可更新

## 23. 待办清单

### 必做

- [ ] 新建 `repositories/crawler_rule_repository.go`
- [ ] 新建 `services/admin_crawler_rule_service.go`
- [ ] 新建 `services/crawler_rule_mapper.go`
- [ ] 新建 `services/crawler_rule_test_service.go`
- [ ] 新建 `controllers/admin_crawler_rule_controller.go`
- [ ] 在 `cmd/server/main.go` 中接入 `/api/admin/crawler-rules`
- [ ] 实现规则 CRUD
- [ ] 实现规则启用/禁用
- [ ] 实现规则测试接口
- [ ] 修改 `workflow/services/crawler_node.go` 支持 `ruleId`
- [ ] 实现规则配置与节点配置合并
- [ ] 实现 `usage_count` / `success_rate` 基础更新

### 建议做

- [ ] 实现规则复制
- [ ] 实现引用关系查询
- [ ] 增加请求校验与错误码
- [ ] 增加单元测试
- [ ] 增加集成测试

### 二期做

- [ ] 独立版本表
- [ ] 发布/草稿机制
- [ ] 影响分析
- [ ] 自动回归测试
- [ ] 告警与健康监控

## 24. 实施结论

结论很明确：

- 现有后端已经具备“执行爬虫规则”的底层能力
- 但还不具备“管理爬虫规则中心”的完整业务层能力
- 补齐 repository / service / controller / mapper / test / workflow 引用后，该模块可以正式落地

换句话说，这不是从零开始做，而是在现有爬虫引擎之上补完规则管理层。
