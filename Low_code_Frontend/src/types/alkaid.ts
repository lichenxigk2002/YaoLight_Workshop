/**
 * Alkaid AI 助手相关类型定义
 */

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

