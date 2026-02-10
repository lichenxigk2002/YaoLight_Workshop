/**
 * Alkaid AI 助手相关类型定义
 */

/**
 * Phase 类型
 */
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

/**
 * 工具步状态
 */
export type ToolStepStatus = 'pending' | 'running' | 'success' | 'error';

/**
 * 智能体工具步
 */
export interface AgentToolStep {
  stepId: string;
  userMessageId: number;               // 所属的用户消息ID（用于分组）
  userMessageContent?: string;         // 用户消息内容（用于展示标题）
  phase: Phase;
  toolName: string;
  toolInput?: Record<string, unknown>;
  status: ToolStepStatus;
  startedAt: string;
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}

/**
 * 创建会话请求
 */
export interface CreateSessionRequest {
  title?: string;
  workflowId?: number;
}

/**
 * 会话信息
 */
export interface Session {
  id: number;
  userId: number;
  title: string;
  workflowId?: number;
  status: string;
  currentPhase?: Phase;
  toolSteps?: AgentToolStep[];
  pendingWorkflow?: unknown;
  pendingPatch?: unknown[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 消息信息
 */
export interface Message {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 发送消息响应
 */
export interface SendMessageResponse {
  message: Message;
  assistantMessage: Message;
}

/**
 * 获取会话列表响应
 */
export interface GetSessionsResponse {
  list: Session[];
  total: number;
}

/**
 * 获取消息列表响应（包含历史工具步）
 */
export interface GetMessagesResponse {
  messages: Message[];
  toolSteps: AgentToolStep[];
}

