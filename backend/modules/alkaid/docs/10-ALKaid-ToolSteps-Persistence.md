# ALKaid 工具步持久化实现文档

## 📋 概述

本文档说明了 **工具步持久化** 功能的实现，确保每次会话的工具步（Tool Steps）能够永久保存到数据库，并在用户切换会话或刷新页面后继续展示。

## 🎯 功能需求

用户希望：

1. ✅ 每次会话的工具步永久保存到数据库
2. ✅ 切换会话或刷新页面后，能看到历史的工具步
3. ✅ 这些工具步**不传给 AI**（只用于前端展示和审计）
4. ✅ 可以审计整个执行过程
5. ✅ **工具步按对话轮次分组显示**（每次新对话开始一组新的工具步）

## 🏗️ 设计架构

### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                      Agentic Loop                           │
│  ┌────────────┐        ┌────────────┐        ┌──────────┐  │
│  │ Tool Start │  ───>  │ SSEWriter  │  ───>  │ Frontend │  │
│  └────────────┘        │  (内存缓存) │        │   (SSE)  │  │
│                        └────────────┘        └──────────┘  │
│  ┌────────────┐               │                            │
│  │ Tool Finish│  ───>  ───────┘                            │
│  └────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  │ Close()
                                  ▼
                        ┌──────────────────┐
                        │ SaveToDatabase   │
                        │ (持久化到数据库) │
                        └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ alkaid_sessions  │
                        │ .tool_steps_json │
                        └──────────────────┘
                                  │
                                  │ GetMessages API
                                  ▼
                        ┌──────────────────┐
                        │ Frontend Display │
                        │ (历史工具步展示) │
                        └──────────────────┘
```

## 📁 实现细节

### 1. 数据库模型

#### 1.1 AgentToolStep 结构

工具步包含用户消息信息，用于前端按对话轮次分组显示：

```go
// backend/modules/alkaid/models/progress.go

type AgentToolStep struct {
    StepID            string                 `json:"stepId"`
    UserMessageID     uint                   `json:"userMessageId"`              // 所属的用户消息ID
    UserMessageContent string                `json:"userMessageContent,omitempty"` // 用户消息内容
    Phase             string                 `json:"phase"`
    ToolName          string                 `json:"toolName"`
    ToolInput         map[string]interface{} `json:"toolInput,omitempty"`
    Status            string                 `json:"status"`
    StartedAt         time.Time              `json:"startedAt"`
    FinishedAt        *time.Time             `json:"finishedAt,omitempty"`
    ResultSummary     string                 `json:"resultSummary,omitempty"`
    ErrorMessage      string                 `json:"errorMessage,omitempty"`
}
```

#### 1.2 会话存储

`AlkaidSession` 中的 `ToolStepsJSON` 字段（`shared.JSONB` 类型）：

```go
// backend/modules/alkaid/models/alkaid.go

type AlkaidSession struct {
    // ...
    ToolStepsJSON shared.JSONB `gorm:"type:jsonb" json:"toolSteps,omitempty"`
    // 存储 []AgentToolStep，最多保留最近 100 条
}
```

### 2. SSEWriter 增强

#### 2.1 添加状态字段

```go
// backend/modules/alkaid/services/agentic/stream_writer.go

type SSEWriter struct {
    ctx                *gin.Context
    flush              func() error
    closed             bool
    sessionID          uint                         // 会话 ID
    userMessageID      uint                         // 当前用户消息ID（用于分组）
    userMessageContent string                       // 用户消息内容
    toolSteps          []alkaidModels.AgentToolStep // 内存缓存的工具步
}
```

**创建时传入用户消息信息**：

```go
// backend/modules/alkaid/services/agentic/loop.go

userMsg := &alkaidModels.AlkaidMessage{
    SessionID: req.SessionID,
    Role:      "user",
    Content:   req.Message,
    Type:      "text",
}
if err := repo.CreateMessage(userMsg); err != nil {
    return err
}

// 传入 userMsg.ID 和内容，用于工具步分组
sw := NewSSEWriter(ctx, req.SessionID, userMsg.ID, req.Message)
defer sw.Close()
```

#### 2.2 工具步记录

- **`WriteToolStepStarted`**: 创建新的 `AgentToolStep`，**包含 userMessageID 和 userMessageContent**，添加到 `toolSteps` 数组，同时发送 SSE 事件
- **`WriteToolStepFinished`**: 更新对应的工具步状态、结果和错误信息

#### 2.3 持久化到数据库

```go
func (w *SSEWriter) SaveToolStepsToSession() error {
    // 1. 读取已有的工具步
    // 2. 合并新的工具步（追加到末尾）
    // 3. 限制最多保存 100 条（避免数据过大）
    // 4. 更新 session.ToolStepsJSON
}
```

#### 2.4 自动保存

在 `Close()` 方法中自动调用 `SaveToolStepsToSession()`：

```go
func (w *SSEWriter) Close() {
    if !w.closed {
        _ = w.SaveToolStepsToSession()
        w.closed = true
    }
}
```

### 3. 后端 API 修改

#### 3.1 GetMessages 接口

`GET /alkaid/sessions/:id/messages` 现在返回：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "messages": [
      {
        "id": 1,
        "role": "user",
        "content": "帮我生成一个工作流"
      }
    ],
    "toolSteps": [
      {
        "stepId": "step-1",
        "phase": "planning",
        "toolName": "get_capabilities",
        "status": "success",
        "startedAt": "2026-02-10T10:00:00Z",
        "finishedAt": "2026-02-10T10:00:01Z",
        "resultSummary": "获取能力列表成功"
      }
    ]
  }
}
```

**关键修改**：

```go
// backend/modules/alkaid/controllers/alkaid_controller.go

func (c *AlkaidController) GetMessages(ctx *gin.Context) {
    // ...
    messages, err := c.alkaidService.GetMessages(uint(sessionID), limit)
    
    // 读取历史工具步
    var toolSteps []interface{}
    if session.ToolStepsJSON.Data != nil {
        if stepsData, ok := session.ToolStepsJSON.Data.([]interface{}); ok {
            toolSteps = stepsData
        }
    }
    
    ctx.JSON(http.StatusOK, gin.H{
        "code":    200,
        "message": "获取成功",
        "data": gin.H{
            "messages":  messages,
            "toolSteps": toolSteps, // 历史工具步
        },
    })
}
```

### 4. 前端类型定义

#### 4.1 新增类型

```typescript
// frontend/src/types/alkaid.ts

export type Phase =
  | 'idle'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'repairing'
  | 'running_trial'
  | 'summarizing'
  | 'waiting_approval'
  | 'error';

export type ToolStepStatus = 'pending' | 'running' | 'success' | 'error';

export interface AgentToolStep {
  stepId: string;
  phase: Phase;
  toolName: string;
  status: ToolStepStatus;
  startedAt: string;
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}

export interface GetMessagesResponse {
  messages: Message[];
  toolSteps: AgentToolStep[];
}
```

#### 4.2 API 修改

```typescript
// frontend/src/api/alkaid.ts

getMessages: (sessionId: number, limit?: number) =>
  http.get<GetMessagesResponse>(`/alkaid/sessions/${sessionId}/messages`, limit ? { limit } : {}),
```

### 5. 前端组件修改

#### 5.1 加载历史工具步

```typescript
// frontend/src/components/Alkaid/AlkaidAssistant.tsx

const loadMessages = async (sid: number) => {
  try {
    const response = await alkaidApi.getMessages(sid);
    const msgs = response.messages || [];
    const toolSteps = response.toolSteps || [];
    
    // 格式化消息
    const formattedMessages: Message[] = msgs.map((msg: any) => ({
      id: msg.id.toString(),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.createdAt),
    }));
    setMessages(formattedMessages);
    
    // 加载历史工具步（仅用于前端展示）
    setAgenticToolSteps(toolSteps);
  } catch (error) {
    console.error('Load messages error:', error);
  }
};
```

#### 5.2 工具步累积显示

**重要修改**：工具步现在会**累积显示**，而不是每次发送新消息时清空：

```typescript
// 发送新消息时，不再清空历史工具步
if (useAgentic) {
  setAgenticPendingSummary(null);
  setAgenticPendingPatchCount(null);
  // ❌ 删除：setAgenticToolSteps([]);
  setAgenticPhase('planning');
}

// 打断请求时，也不清空历史工具步
if (loading && useAgentic) {
  if (cancelStream) cancelStream();
  setCancelStream(null);
  setLoading(false);
  setAgenticPhase('idle');
  // ❌ 删除：setAgenticToolSteps([]);
}
```

**行为说明**：

- ✅ **同一会话**：多次对话的工具步会累积显示
- ✅ **切换会话**：`loadMessages` 会替换为新会话的工具步
- ✅ **刷新页面**：工具步从数据库加载，不会丢失
- ✅ **关闭对话框**：工具步保留，下次打开继续显示

## 🎨 前端展示效果

### AlkaidProgress 组件 - 按对话分组显示

前端的 `AlkaidProgress` 组件会**按用户消息分组**展示工具步：

```
┌─ 意图分析与规划
│  💬 "帮我生成一个登录工作流"
│    ✓ get_capabilities - 获取到 15 项能力
│    ✓ get_workflow - 获取当前工作流
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━
│  💬 "修改一下按钮文字"
│    ✓ get_workflow - 获取当前工作流
│    ✓ validate_workflow - 验证通过
└─ ...
```

**功能特点**：

1. ✅ 工具步按 `userMessageId` 自动分组
2. ✅ 显示用户消息内容（前30字 + "..."）
3. ✅ 不同分组之间用分隔线区分
4. ✅ 单条消息时不显示分组标题（避免冗余）
5. ✅ 工具步时间线、状态、结果摘要、错误信息

用户切换会话或刷新页面后，依然可以看到**完整且分组清晰**的历史执行过程。

## 🔒 安全考虑

1. **不传给 AI**: 历史工具步只在前端展示，不会被包含在 LLM 的上下文中
2. **数据量限制**: 最多保存 100 条工具步，避免数据库膨胀
3. **权限验证**: 只有会话所有者能看到工具步历史

## 📊 数据库存储

### 示例数据

```json
{
  "toolSteps": [
    {
      "stepId": "step-capabilities-1",
      "userMessageId": 123,
      "userMessageContent": "帮我生成一个登录工作流",
      "phase": "planning",
      "toolName": "get_capabilities",
      "status": "success",
      "startedAt": "2026-02-10T10:00:00.000Z",
      "finishedAt": "2026-02-10T10:00:01.234Z",
      "resultSummary": "获取到 15 项能力"
    },
    {
      "stepId": "step-validate",
      "userMessageId": 123,
      "userMessageContent": "帮我生成一个登录工作流",
      "phase": "validating",
      "toolName": "validate_workflow",
      "status": "success",
      "startedAt": "2026-02-10T10:00:05.000Z",
      "finishedAt": "2026-02-10T10:00:06.456Z",
      "resultSummary": "验证通过，无错误"
    },
    {
      "stepId": "step-capabilities-2",
      "userMessageId": 124,
      "userMessageContent": "修改一下按钮文字",
      "phase": "planning",
      "toolName": "get_workflow",
      "status": "success",
      "startedAt": "2026-02-10T10:01:00.000Z",
      "finishedAt": "2026-02-10T10:01:01.123Z",
      "resultSummary": "获取当前工作流成功"
    }
  ]
}
```

## ✅ 功能验收

### 测试步骤

1. **创建新会话，发送消息**
   - 观察 SSE 事件流中的 `tool_step_started` / `tool_step_finished` 事件
   - 前端 `AlkaidProgress` 组件实时显示工具步

2. **刷新页面**
   - 切换到同一会话
   - 检查历史工具步是否正确加载和显示

3. **切换到其他会话**
   - 检查工具步是否独立（不同会话有不同的工具步历史）

4. **检查数据库**
   ```sql
   SELECT id, title, tool_steps_json 
   FROM alkaid_sessions 
   WHERE user_id = ? 
   ORDER BY updated_at DESC;
   ```

## 📝 相关文件

### 后端

- `modules/alkaid/models/alkaid.go`: `AlkaidSession.ToolStepsJSON` 字段
- `modules/alkaid/models/progress.go`: `AgentToolStep` 结构定义
- `modules/alkaid/services/agentic/stream_writer.go`: SSE 写入器 + 工具步持久化逻辑
- `modules/alkaid/services/agentic/loop.go`: 创建 `SSEWriter` 时传入 `sessionID`
- `modules/alkaid/controllers/alkaid_controller.go`: `GetMessages` 接口返回工具步
- `modules/alkaid/repositories/alkaid_repository.go`: 数据访问层

### 前端

- `src/types/alkaid.ts`: `AgentToolStep` 和 `GetMessagesResponse` 类型
- `src/api/alkaid.ts`: `getMessages` API 返回类型修改
- `src/components/Alkaid/AlkaidAssistant.tsx`: 加载和展示历史工具步
- `src/components/Alkaid/components/AlkaidProgress.tsx`: 工具步时间线展示组件

## 🚀 部署说明

1. **数据库迁移**: `ToolStepsJSON` 字段已在 `010_alkaid_session_agentic_fields.sql` 迁移中添加
2. **后端重启**: 重新编译并重启后端服务
3. **前端无需改动**: 类型定义和组件逻辑已完成，无需额外配置

## 🎉 总结

工具步持久化功能已完整实现：

- ✅ **自动保存**: 每次会话结束时，工具步自动保存到数据库
- ✅ **历史查看**: 切换会话或刷新页面后，历史工具步依然可见
- ✅ **不传 AI**: 工具步仅用于前端展示和审计，不占用 LLM token
- ✅ **性能优化**: 限制最多 100 条工具步，避免数据库膨胀
- ✅ **对话分组**: 工具步按用户消息分组显示，清晰展示每次对话的执行过程
- ✅ **可追溯性**: 每个工具步记录所属的用户消息ID和内容

用户现在可以完整追溯每个会话的工具执行历史，**并且可以清晰区分不同对话的执行过程**，提升了系统的可观测性和可审计性！🎊
