/**
 * 瑶光星 Hooks 示例服务器
 * 
 * 使用方法：
 * 1. npm install express
 * 2. node server.js
 * 3. 在 .env 中配置：
 *    ALKAID_HOOK_BEFORE_GENERATE_URL=http://localhost:3001/hooks/before-generate
 *    ALKAID_HOOK_AFTER_GENERATE_URL=http://localhost:3001/hooks/after-generate
 *    ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL=http://localhost:3001/hooks/before-apply
 *    ALKAID_HOOK_ON_WORKFLOW_RUN_FAILED_URL=http://localhost:3001/hooks/on-run-failed
 */

const express = require('express');
const app = express();
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ====================================
// Hook 1: BeforeGenerate - 生成前检查
// ====================================
app.post('/hooks/before-generate', (req, res) => {
  const { event, sessionId, userId, userMessage } = req.body;
  console.log(`\n📝 BeforeGenerate Hook 被调用`);
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Message: ${userMessage}`);
  
  // 检查敏感词
  const forbiddenWords = ['删除', '清空', 'DROP', 'DELETE', '删库'];
  const hasForbidden = forbiddenWords.some(word => 
    userMessage.includes(word)
  );
  
  if (hasForbidden) {
    console.log(`   ❌ 拒绝：检测到敏感词`);
    return res.json({
      allow: false,
      reason: '检测到敏感操作词汇，为了安全，请避免使用"删除"、"清空"等操作'
    });
  }
  
  // 检查是否是测试拒绝
  if (userMessage.includes('测试拒绝')) {
    console.log(`   ❌ 拒绝：测试模式`);
    return res.json({
      allow: false,
      reason: '这是一个测试拒绝，验证 Hook 功能正常'
    });
  }
  
  console.log(`   ✅ 允许继续`);
  res.json({ allow: true });
});

// ====================================
// Hook 2: AfterGenerate - 生成后审计
// ====================================
app.post('/hooks/after-generate', (req, res) => {
  const { event, sessionId, userId, workflow } = req.body;
  console.log(`\n🔍 AfterGenerate Hook 被调用`);
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   User ID: ${userId}`);
  
  if (!workflow) {
    console.log(`   ⚠️ 没有工作流数据`);
    return res.json({ allow: true });
  }
  
  const nodeCount = workflow.nodes ? workflow.nodes.length : 0;
  const edgeCount = workflow.edges ? workflow.edges.length : 0;
  console.log(`   Workflow: ${nodeCount} 节点, ${edgeCount} 边`);
  
  // 检查节点数量限制
  if (nodeCount > 20) {
    console.log(`   ❌ 拒绝：节点数量超限`);
    return res.json({
      allow: false,
      reason: `工作流过于复杂（${nodeCount}/20 节点），请简化后再试`
    });
  }
  
  // 检查是否包含硬编码的 API Key
  const workflowStr = JSON.stringify(workflow);
  const apiKeyPattern = /sk-[a-zA-Z0-9]{32,}/;
  if (apiKeyPattern.test(workflowStr)) {
    console.log(`   ❌ 拒绝：检测到硬编码的 API Key`);
    return res.json({
      allow: false,
      reason: '检测到硬编码的 API Key，请使用环境变量配置'
    });
  }
  
  console.log(`   ✅ 允许继续`);
  res.json({ allow: true });
});

// ====================================
// Hook 3: BeforeApplyWorkflow - 应用前校验
// ====================================
app.post('/hooks/before-apply', (req, res) => {
  const { event, sessionId, workflowId, userId } = req.body;
  console.log(`\n🚀 BeforeApplyWorkflow Hook 被调用`);
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   User ID: ${userId}`);
  
  // 这里可以添加额外的权限检查
  // 例如：检查用户是否有修改此工作流的权限
  
  // 模拟：VIP 用户才能应用超过 10 个节点的工作流
  const isVIP = userId % 2 === 0; // 简单示例：偶数 ID 为 VIP
  if (!isVIP && Math.random() > 0.8) {
    console.log(`   ❌ 拒绝：非 VIP 用户`);
    return res.json({
      allow: false,
      reason: '此工作流较为复杂，请升级为 VIP 后再应用'
    });
  }
  
  console.log(`   ✅ 允许应用`);
  res.json({ allow: true });
});

// ====================================
// Hook 4: OnWorkflowRunFailed - 失败时响应
// ====================================
app.post('/hooks/on-run-failed', (req, res) => {
  const { event, sessionId, userId, workflowId, executionError } = req.body;
  console.log(`\n⚠️ OnWorkflowRunFailed Hook 被调用`);
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Error: ${executionError?.message || 'Unknown'}`);
  
  // 这里可以实现：
  // 1. 发送钉钉/企微/Slack 通知
  // 2. 创建 JIRA 工单
  // 3. 记录到错误分析系统
  // 4. 触发自动诊断流程
  
  // 示例：打印错误详情
  if (executionError?.details) {
    console.log(`   Details:`, JSON.stringify(executionError.details, null, 2));
  }
  
  // 模拟发送通知
  console.log(`   📨 已发送告警通知到管理员`);
  
  // OnWorkflowRunFailed 的返回值不影响流程，主要用于通知
  console.log(`   ✅ Hook 处理完成`);
  res.json({ allow: true });
});

// ====================================
// 健康检查
// ====================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hooks: [
      'BeforeGenerate',
      'AfterGenerate',
      'BeforeApplyWorkflow',
      'OnWorkflowRunFailed'
    ]
  });
});

// ====================================
// 测试端点
// ====================================
app.get('/test', (req, res) => {
  res.send(`
    <h1>瑶光星 Hooks 测试服务器</h1>
    <h2>可用的 Hook 端点：</h2>
    <ul>
      <li>POST /hooks/before-generate - 生成前检查</li>
      <li>POST /hooks/after-generate - 生成后审计</li>
      <li>POST /hooks/before-apply - 应用前校验</li>
      <li>POST /hooks/on-run-failed - 失败时响应</li>
    </ul>
    <h2>测试用例：</h2>
    <pre>
# 测试 BeforeGenerate（会被拒绝）
curl -X POST http://localhost:3001/hooks/before-generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "BeforeGenerate",
    "sessionId": 123,
    "userId": 456,
    "userMessage": "帮我删除所有数据"
  }'

# 测试 AfterGenerate（正常通过）
curl -X POST http://localhost:3001/hooks/after-generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "AfterGenerate",
    "sessionId": 123,
    "userId": 456,
    "workflow": {
      "version": "1.0",
      "nodes": [{"id": "1", "type": "start"}],
      "edges": []
    }
  }'
    </pre>
  `);
});

// ====================================
// 启动服务器
// ====================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🎣 瑶光星 Hooks 服务器已启动`);
  console.log(`   监听端口: ${PORT}`);
  console.log(`   健康检查: http://localhost:${PORT}/health`);
  console.log(`   测试页面: http://localhost:${PORT}/test`);
  console.log(`\n📝 配置示例（.env）：`);
  console.log(`   ALKAID_HOOK_BEFORE_GENERATE_URL=http://localhost:${PORT}/hooks/before-generate`);
  console.log(`   ALKAID_HOOK_AFTER_GENERATE_URL=http://localhost:${PORT}/hooks/after-generate`);
  console.log(`   ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL=http://localhost:${PORT}/hooks/before-apply`);
  console.log(`   ALKAID_HOOK_ON_WORKFLOW_RUN_FAILED_URL=http://localhost:${PORT}/hooks/on-run-failed`);
  console.log(`\n等待 Hook 调用...\n`);
});
