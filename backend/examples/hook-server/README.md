# 瑶光星 Hooks 示例服务器

这是一个用于测试瑶光星 Hooks 系统的示例服务器。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3001` 启动。

### 3. 配置瑶光星

在 `backend/.env` 中添加：

```bash
# 瑶光星 Hooks 配置
ALKAID_HOOK_BEFORE_GENERATE_URL=http://localhost:3001/hooks/before-generate
ALKAID_HOOK_AFTER_GENERATE_URL=http://localhost:3001/hooks/after-generate
ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL=http://localhost:3001/hooks/before-apply
ALKAID_HOOK_ON_WORKFLOW_RUN_FAILED_URL=http://localhost:3001/hooks/on-run-failed
```

### 4. 测试

启动瑶光星后端服务，在前端发送以下测试消息：

1. **测试 BeforeGenerate（会被拒绝）**：
   ```
   帮我生成一个删除用户数据的工作流
   ```
   预期：被 Hook 拦截，显示错误信息

2. **测试正常流程**：
   ```
   帮我生成一个爬虫工作流
   ```
   预期：正常生成工作流

3. **测试 AfterGenerate（节点超限）**：
   生成一个包含超过 20 个节点的复杂工作流
   预期：被 Hook 拦截

## 功能说明

### 1. BeforeGenerate Hook
- 检查敏感词：删除、清空、DROP、DELETE
- 记录审计日志
- 可自定义检查规则

### 2. AfterGenerate Hook
- 限制节点数量（最多 20 个）
- 检测硬编码的 API Key
- 可添加合规检查

### 3. BeforeApplyWorkflow Hook
- 权限验证示例（VIP 用户检查）
- 可添加额外的安全检查

### 4. OnWorkflowRunFailed Hook
- 记录失败日志
- 发送告警通知（示例）
- 可集成 JIRA、钉钉等

## 自定义开发

编辑 `server.js` 文件，根据您的需求修改 Hook 逻辑：

```javascript
app.post('/hooks/before-generate', (req, res) => {
  // 您的检查逻辑
  
  if (needToReject) {
    return res.json({
      allow: false,
      reason: '拒绝原因'
    });
  }
  
  res.json({ allow: true });
});
```

## 手动测试

使用 curl 测试 Hook：

```bash
# 测试 BeforeGenerate
curl -X POST http://localhost:3001/hooks/before-generate \
  -H "Content-Type: application/json" \
  -d '{
    "event": "BeforeGenerate",
    "sessionId": 123,
    "userId": 456,
    "userMessage": "测试消息"
  }'
```

## 集成真实服务

### 钉钉通知

```javascript
const axios = require('axios');

async function sendDingTalkNotification(message) {
  await axios.post(
    'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN',
    {
      msgtype: 'text',
      text: { content: message }
    }
  );
}
```

### JIRA 工单

```javascript
async function createJiraIssue(error) {
  await axios.post(
    'https://your-domain.atlassian.net/rest/api/3/issue',
    {
      fields: {
        project: { key: 'WORKFLOW' },
        summary: `工作流失败: ${error.message}`,
        issuetype: { name: 'Bug' }
      }
    },
    {
      auth: {
        username: 'your-email',
        password: 'your-api-token'
      }
    }
  );
}
```

## 生产部署

1. 使用 HTTPS
2. 添加身份验证
3. 配置日志系统
4. 设置监控告警
5. 使用 PM2 等进程管理器

## 更多信息

参见：`backend/modules/alkaid/docs/08-ALKaid-Hooks-Implementation.md`
