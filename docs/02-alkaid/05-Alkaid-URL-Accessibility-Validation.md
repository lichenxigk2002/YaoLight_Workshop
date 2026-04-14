# 瑶光星 URL 可抓取预检说明

## 目标

避免瑶光星生成不可运行的 crawler 工作流，尤其是：

- 搜索页
- 登录页
- 强依赖前端脚本渲染的页面
- 非正文 HTML 页面

## 本轮实现

新增工具：
- `check_url_accessibility`

代码位置：
- `backend/modules/alkaid/services/tools/check_url_accessibility.go`
- `backend/modules/alkaid/services/agentic/tool_defs.go`
- `backend/modules/alkaid/services/tools/registry.go`

## 工具返回字段

工具会返回以下关键信息：

- `ok`
- `status_code`
- `final_url`
- `content_type`
- `content_length`
- `page_title`
- `is_html`
- `is_search_page`
- `needs_login`
- `likely_js_heavy`
- `extractable_text_length`
- `reason`
- `suggestion`

## 校验逻辑

工具会用轻量 HTTP 请求做预检：

1. 请求 URL，跟随重定向。
2. 读取有限响应体，不做完整下载。
3. 判断是否为 HTML。
4. 提取标题和可读文本长度。
5. 检测是否像搜索页、登录页或 JS 壳页面。

## Agentic 接入点

当前状态：

- 工具 `check_url_accessibility` 已经开放给模型按需调用。
- 自动兜底校验曾经接入过 proposal 前链路，但目前已关闭。

原因：

- 这一步的启发式判断还需要继续打磨。
- 在判断不够稳时，自动拦截会让整轮结果直接中断，体验成本过高。

当前建议：

- 先由模型在生成 crawler 节点前按需调用这个工具。
- 等判断规则更稳定后，再考虑恢复“proposal 前强制校验”。

## 预期效果

- 模型可以主动用这个工具先筛选数据源。
- 在自动拦截关闭的情况下，不会因为预检误判导致整轮结果被清空。

## 已验证

已添加测试：
- `backend/modules/alkaid/services/tools/check_url_accessibility_test.go`

已执行：

```bash
go test ./modules/ai/services/providers/deepseek ./modules/alkaid/...
```
