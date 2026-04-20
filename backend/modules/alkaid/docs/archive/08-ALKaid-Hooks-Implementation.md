# 瑶光星 Hooks 系统 · 实现文档

> 本文档记录瑶光星智能体的 Hooks（钩子）系统实现，包括 4 个钩子的配置、使用方法和示例代码。

---

## 1. Hooks 系统概述

### 1.1 什么是 Hooks

Hooks（钩子）是在关键操作节点设置的**拦截器**或**回调点**，允许外部系统在特定时机介入瑶光星的执行流程，用于：

- ✅ **合规检查**：生成前检查用户输入是否包含敏感词
- ✅ **风控审计**：生成后审计工作流是否符合规范
- ✅ **权限控制**：应用前验证用户权限
- ✅ **自动化响应**：失败时自动发送告警、触发诊断

### 1.2 设计原则

- **非侵入性**：Hook 失败不影响主流程（超时或异常时默认允许继续）
- **可配置性**：通过环境变量配置，不需要则无需配置
- **异步友好**：Hook 调用有超时限制（5秒）
- **标准化**：统一的请求/响应格式

---

## 2. 4 个核心 Hooks

### 2.1 BeforeGenerate - 生成前检查

**触发时机**：用户发送需求后、LLM 开始处理前

**配置环境变量**：
```bash
ALKAID_HOOK_BEFORE_GENERATE_URL=https://your-domain.com/hooks/before-generate
```

**请求格式**：
```json
{
  "event": "BeforeGenerate",
  "sessionId": 123,
  "userId": 456,
  "userMessage": "帮我生成一个删除用户数据的工作流"
}
```

**响应格式**：
```json
{
  "allow": false,
  "reason": "禁止生成涉及删除用户数据的工作流"
}
```

**典型用途**：
- 检查敏感词（如"删除"、"清空"、"DROP"）
- 验证用户权限
- 记录审计日志
- 强制使用特定模板

---

### 2.2 AfterGenerate - 生成后审计

**触发时机**：LLM 生成工作流 JSON 后、校验前

**配置环境变量**：
```bash
ALKAID_HOOK_AFTER_GENERATE_URL=https://your-domain.com/hooks/after-generate
```

**请求格式**：
```json
{
  "event": "AfterGenerate",
  "sessionId": 123,
  "userId": 456,
  "workflow": {
    "version": "1.0",
    "nodes": [...],
    "edges": [...]
  }
}
```

**响应格式**：
```json
{
  "allow": true
}
```

或拒绝：
```json
{
  "allow": false,
  "reason": "工作流节点数超过限制（50/20）"
}
```

**典型用途**：
- 检查节点数量限制
- 验证是否包含必需节点（如日志节点）
- 检测硬编码的敏感信息（API Key、密码等）
- 自动注入监控节点

---

### 2.3 BeforeApplyWorkflow - 应用前校验

**触发时机**：用户点击"应用到画布"后、写入画布前

**配置环境变量**：
```bash
ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL=https://your-domain.com/hooks/before-apply
```

**请求格式**：
```json
{
  "event": "BeforeApplyWorkflow",
  "sessionId": 123,
  "workflowId": 789,
  "userId": 456
}
```

**响应格式**：
```json
{
  "allow": false,
  "reason": "检测到敏感配置，请使用环境变量"
}
```

**典型用途**：
- 再次验证用户权限
- 检查敏感配置
- 自动备份当前画布
- 限制修改频率

---

### 2.4 OnWorkflowRunFailed - 失败时响应

**触发时机**：工作流试跑失败时

**配置环境变量**：
```bash
ALKAID_HOOK_ON_WORKFLOW_RUN_FAILED_URL=https://your-domain.com/hooks/on-run-failed
```

**请求格式**：
```json
{
  "event": "OnWorkflowRunFailed",
  "sessionId": 123,
  "userId": 456,
  "workflowId": 789,
  "executionError": {
    "message": "节点 crawler 执行超时",
    "summary": "试跑失败，共 3 个节点执行完成",
    "details": {
      "success": false,
      "error": "timeout",
      "results": [...]
    }
  }
}
```

**响应格式**：
```json
{
  "allow": true
}
```

**典型用途**：
- 发送告警通知（钉钉、企微、Slack）
- 自动创建工单（JIRA、Trello）
- 记录错误日志到分析系统
- 触发自动诊断流程

**注意**：此 Hook 的返回值不影响流程，主要用于通知和审计

---

## 3. Hook 服务器实现示例

### 3.1 Node.js + Express 示例

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// BeforeGenerate Hook
app.post('/hooks/before-generate', (req, res) => {
  const { userMessage } = req.body;
  
  // 检查敏感词
  const forbiddenWords = ['删除', '清空', 'DROP', 'DELETE'];
  const hasForbidden = forbiddenWords.some(word => 
    userMessage.includes(word)
  );
  
  if (hasForbidden) {
    return res.json({
      allow: false,
      reason: '检测到敏感操作，请联系管理员'
    });
  }
  
  // 记录审计日志
  console.log(`[Audit] User ${req.body.userId} requested: ${userMessage}`);
  
  res.json({ allow: true });
});

// AfterGenerate Hook
app.post('/hooks/after-generate', (req, res) => {
  const { workflow } = req.body;
  
  // 检查节点数量
  if (workflow.nodes && workflow.nodes.length > 20) {
    return res.json({
      allow: false,
      reason: `工作流过于复杂（${workflow.nodes.length}/20 节点）`
    });
  }
  
  // 检查是否包含硬编码的 API Key
  const workflowStr = JSON.stringify(workflow);
  if (/sk-[a-zA-Z0-9]{32,}/.test(workflowStr)) {
    return res.json({
      allow: false,
      reason: '检测到硬编码的 API Key，请使用环境变量'
    });
  }
  
  res.json({ allow: true });
});

// BeforeApplyWorkflow Hook
app.post('/hooks/before-apply', (req, res) => {
  const { userId, workflowId } = req.body;
  
  // 检查用户权限（示例）
  const userHasPermission = checkPermission(userId, workflowId);
  
  if (!userHasPermission) {
    return res.json({
      allow: false,
      reason: '您没有修改此工作流的权限'
    });
  }
  
  res.json({ allow: true });
});

// OnWorkflowRunFailed Hook
app.post('/hooks/on-run-failed', async (req, res) => {
  const { userId, executionError } = req.body;
  
  // 发送钉钉通知（示例）
  await sendDingTalkNotification({
    title: '⚠️ 工作流执行失败',
    text: `用户 ${userId} 的工作流试跑失败\n错误：${executionError.message}`,
    url: `https://your-platform.com/session/${req.body.sessionId}`
  });
  
  // 记录到错误分析系统
  await logToErrorTracking(executionError);
  
  res.json({ allow: true });
});

app.listen(3001, () => {
  console.log('Hook server running on port 3001');
});
```

### 3.2 Python + Flask 示例

```python
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/hooks/before-generate', methods=['POST'])
def before_generate():
    data = request.json
    user_message = data.get('userMessage', '')
    
    # 检查敏感词
    forbidden_words = ['删除', '清空', 'DROP', 'DELETE']
    if any(word in user_message for word in forbidden_words):
        return jsonify({
            'allow': False,
            'reason': '检测到敏感操作，请联系管理员'
        })
    
    return jsonify({'allow': True})

@app.route('/hooks/after-generate', methods=['POST'])
def after_generate():
    data = request.json
    workflow = data.get('workflow', {})
    
    # 检查节点数量
    nodes = workflow.get('nodes', [])
    if len(nodes) > 20:
        return jsonify({
            'allow': False,
            'reason': f'工作流过于复杂（{len(nodes)}/20 节点）'
        })
    
    return jsonify({'allow': True})

@app.route('/hooks/on-run-failed', methods=['POST'])
def on_run_failed():
    data = request.json
    
    # 发送企微通知
    send_wecom_alert(
        title='⚠️ 工作流执行失败',
        content=f"错误：{data['executionError']['message']}"
    )
    
    return jsonify({'allow': True})

if __name__ == '__main__':
    app.run(port=3001)
```

---

## 4. 配置说明

### 4.1 环境变量配置

在 `.env` 文件中添加：

```bash
# 瑶光星 Hooks 配置
ALKAID_HOOK_BEFORE_GENERATE_URL=http://localhost:3001/hooks/before-generate
ALKAID_HOOK_AFTER_GENERATE_URL=http://localhost:3001/hooks/after-generate
ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL=http://localhost:3001/hooks/before-apply
ALKAID_HOOK_ON_WORKFLOW_RUN_FAILED_URL=http://localhost:3001/hooks/on-run-failed
```

### 4.2 不配置时的行为

- 未配置环境变量时，Hook 不会被调用
- 默认允许所有操作继续
- 不影响现有功能

### 4.3 超时与容错

- Hook 调用超时：**5 秒**
- 超时行为：默认允许继续（避免阻塞用户）
- HTTP 错误：默认允许继续
- 解析失败：默认允许继续

所有错误都会在服务器日志中记录。

---

## 5. 实际应用案例

### 案例 1: 金融公司合规

```javascript
// BeforeGenerate: 检查敏感操作
if (userMessage.match(/转账|支付|删除账户/)) {
  // 要求二次确认
  return { allow: false, reason: '敏感操作需要二次确认' };
}

// AfterGenerate: 强制添加审计节点
workflow.nodes.push({
  id: 'audit-node',
  type: 'logger',
  data: { level: 'info', message: 'Audit trail' }
});
```

### 案例 2: 教育平台限制

```javascript
// AfterGenerate: 限制学生账号
if (user.role === 'student') {
  if (workflow.nodes.some(n => n.type === 'api')) {
    return { 
      allow: false, 
      reason: '学生账号不允许使用 API 节点' 
    };
  }
}
```

### 案例 3: DevOps 自动化

```javascript
// OnWorkflowRunFailed: 自动创建工单
await createJiraIssue({
  project: 'WORKFLOW',
  type: 'Bug',
  summary: `工作流执行失败: ${executionError.message}`,
  description: JSON.stringify(executionError.details, null, 2)
});
```

---

## 6. 安全注意事项

### 6.1 HTTPS

生产环境必须使用 HTTPS：
```bash
ALKAID_HOOK_BEFORE_GENERATE_URL=https://your-domain.com/hooks/before-generate
```

### 6.2 身份验证

Hook 服务器应验证请求来源：

```javascript
app.use((req, res, next) => {
  const secret = req.headers['x-alkaid-secret'];
  if (secret !== process.env.ALKAID_HOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 6.3 敏感信息

- ❌ 不要在 Hook 请求中包含密码、Token
- ❌ 不要在 reason 中暴露系统内部信息
- ✅ 只传递必要的元数据

---

## 7. 测试 Hooks

### 7.1 手动测试

使用 curl 测试 Hook 服务器：

```bash
curl -X POST http://localhost:3001/hooks/before-generate \
  -H "Content-Type: application/json" \
  -d '{
    "event": "BeforeGenerate",
    "sessionId": 123,
    "userId": 456,
    "userMessage": "测试消息"
  }'
```

### 7.2 集成测试

启动 Hook 服务器后，在瑶光星中测试：

1. 发送包含敏感词的需求 → 应被拦截
2. 生成超大工作流 → 应被拒绝
3. 模拟试跑失败 → 应收到通知

---

## 8. 故障排查

### 问题 1: Hook 未被调用

**检查**：
```bash
# 查看环境变量
echo $ALKAID_HOOK_BEFORE_GENERATE_URL

# 检查 Hook 服务器是否运行
curl http://localhost:3001/health
```

### 问题 2: Hook 调用超时

**解决**：
- 优化 Hook 服务器响应速度
- 避免在 Hook 中执行耗时操作（如数据库查询）
- 使用异步任务队列处理通知

### 问题 3: 总是返回 allow: true

**检查**：
- Hook 服务器日志
- 响应格式是否正确
- HTTP 状态码是否为 200

---

## 9. 文件清单

| 文件 | 说明 |
|------|------|
| `modules/alkaid/services/agentic/hooks.go` | Hooks 核心实现 |
| `modules/alkaid/services/agentic/loop.go` | Hook 集成点（BeforeGenerate、AfterGenerate、OnWorkflowRunFailed） |
| `modules/alkaid/services/agentic/apply.go` | BeforeApplyWorkflow 集成点 |
| `docs/08-ALKaid-Hooks-Implementation.md` | 本文档 |

---

## 10. 后续优化方向

1. **脚本支持**：除了 HTTP，支持本地脚本执行
2. **异步 Hook**：支持 Webhook 异步回调
3. **Hook 链**：支持多个 Hook 依次执行
4. **可视化配置**：在管理界面配置 Hook
5. **Hook 市场**：提供常用 Hook 模板

---

## 11. 总结

Hooks 系统为瑶光星提供了强大的扩展能力：

- ✅ 4 个钩子覆盖关键节点
- ✅ 简单的 HTTP 回调接口
- ✅ 容错设计不影响主流程
- ✅ 丰富的应用场景

通过合理配置 Hooks，可以实现合规检查、风险控制、自动化响应等企业级功能！🎣
