import http from '@/http';
import type {
  CreateSessionRequest,
  Session,
  SendMessageResponse,
  GetSessionsResponse,
  GetMessagesResponse,
} from '@/types/alkaid';
import type { AgentPlanStep, InteractionMode, PendingPatchSummary } from '@/components/Alkaid/types';
import { createSSEReader } from '@/utils/sseUtils';

/**
 * Alkaid AI 助手 API
 */
export const alkaidApi = {
  /**
   * 创建会话
   */
  createSession: (data: CreateSessionRequest) =>
    http.post<Session>('/alkaid/sessions', data),

  /**
   * 获取会话列表
   */
  getSessions: (page = 1, pageSize = 20) =>
    http.get<GetSessionsResponse>('/alkaid/sessions', { page, pageSize }),

  /**
   * 获取会话详情
   */
  getSession: (sessionId: number) =>
    http.get<Session>(`/alkaid/sessions/${sessionId}`),

  /**
   * 更新会话标题
   */
  updateSessionTitle: (sessionId: number, title: string) =>
    http.put(`/alkaid/sessions/${sessionId}/title`, { title }),

  /**
   * 删除会话
   */
  deleteSession: (sessionId: number) =>
    http.delete(`/alkaid/sessions/${sessionId}`),

  /**
   * 发送消息
   * 注意：AI 响应可能需要较长时间（1-2分钟），因此设置了 3 分钟的超时时间
   */
  sendMessage: (sessionId: number, content: string) =>
    http.post<SendMessageResponse>(
      '/alkaid/messages',
      {
        sessionId,
        content,
      },
      {
        timeout: 180000, // 3分钟超时（180秒）
      }
    ),

  /**
   * 流式发送消息
   */
  sendMessageStream: (
    sessionId: number,
    content: string,
    onMessage: (content: string, step: string, done: boolean) => void,
    onError?: (error: string) => void,
    onComplete?: () => void
  ): (() => void) => {
    // 获取token
    let token: string | null = null;
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        token = authData.state?.token || null;
      }
    } catch (e) {
      // 获取token失败，继续执行
    }

    const baseURL = import.meta.env.VITE_BASE_URL || '/api';
    const url = `${baseURL}/alkaid/messages/stream`;

    // 使用AbortController支持取消
    const abortController = new AbortController();
    let cancelReader: (() => void) | null = null;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ sessionId, content }),
      signal: abortController.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        cancelReader = createSSEReader(response, {
          onMessage: (_nodeId, content, done, contentType) => {
            // contentType 对应 step
            onMessage(content, contentType as string, done);
          },
          onError,
          onComplete,
        });
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        onError?.(err.message || '请求失败');
      });

    return () => {
      if (cancelReader) cancelReader();
      abortController.abort();
    };
  },

  /**
   * 获取消息列表（包含历史工具步）
   */
  getMessages: (sessionId: number, limit?: number) =>
    http.get<GetMessagesResponse>(`/alkaid/sessions/${sessionId}/messages`, limit ? { limit } : {}),

  /**
   * Agentic 流式接口：POST /alkaid/sessions/:id/stream，SSE 事件 content / phase_changed / tool_step_* / done / error
   */
  sessionStreamAgentic: (
    sessionId: number,
    message: string,
    callbacks: {
      onContent?: (delta: string) => void;
      onInteractionMode?: (data: { mode: InteractionMode; reason?: string; showProgress: boolean; at: string }) => void;
      onPhaseChanged?: (phase: string) => void;
      onPlanCreated?: (data: { steps: AgentPlanStep[] }) => void;
      onPlanStepStarted?: (data: any) => void;
      onPlanStepUpdated?: (data: any) => void;
      onPlanStepFinished?: (data: any) => void;
      onToolStepStarted?: (data: { stepId: string; planStepId?: string; toolName: string; phase: string }) => void;
      onToolStepFinished?: (data: { stepId: string; status: string; resultSummary?: string; errorMessage?: string }) => void;
      onPendingWorkflow?: (data: { summary: { nodeCount: number; edgeCount: number } }) => void;
      onPendingPatch?: (data: { patchCount: number; summary?: PendingPatchSummary }) => void;
      onDone?: () => void;
      onError?: (message: string) => void;
    },
    context?: { currentWorkflow?: any } // 新增 context 参数
  ): (() => void) => {
    let token: string | null = null;
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        token = authData.state?.token || null;
      }
    } catch (e) { }
    const baseURL = import.meta.env.VITE_BASE_URL || '/api';
    const url = `${baseURL}/alkaid/sessions/${sessionId}/stream`;
    const abortController = new AbortController();
    let cancelReader: (() => void) | null = null;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ message, interrupt: false, context }), // 传递 context
      signal: abortController.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventType = '';
        const process = (): Promise<void> =>
          reader.read().then(({ value, done }) => {
            if (done) {
              callbacks.onDone?.();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (line.startsWith('event: ')) eventType = line.slice(7).trim();
              else if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (eventType === 'content') callbacks.onContent?.(data.delta ?? '');
                  else if (eventType === 'interaction_mode') callbacks.onInteractionMode?.(data);
                  else if (eventType === 'phase_changed') callbacks.onPhaseChanged?.(data.phase);
                  else if (eventType === 'plan_created') callbacks.onPlanCreated?.(data);
                  else if (eventType === 'plan_step_started') callbacks.onPlanStepStarted?.(data);
                  else if (eventType === 'plan_step_updated') callbacks.onPlanStepUpdated?.(data);
                  else if (eventType === 'plan_step_finished') callbacks.onPlanStepFinished?.(data);
                  else if (eventType === 'tool_step_started') callbacks.onToolStepStarted?.(data);
                  else if (eventType === 'tool_step_finished') callbacks.onToolStepFinished?.(data);
                  else if (eventType === 'pending_workflow') callbacks.onPendingWorkflow?.(data);
                  else if (eventType === 'pending_patch') callbacks.onPendingPatch?.(data);
                  else if (eventType === 'done') callbacks.onDone?.();
                  else if (eventType === 'interrupted') callbacks.onDone?.(); // 打断视为结束，与 onDone 一致清理状态
                  else if (eventType === 'error') callbacks.onError?.(data.message ?? '');
                } catch (_) { }
              }
            }
            return process();
          });
        cancelReader = () => reader.cancel();
        return process();
      })
      .catch(err => {
        if (err.name !== 'AbortError') callbacks.onError?.(err.message ?? '请求失败');
      });

    return () => {
      if (cancelReader) cancelReader();
      abortController.abort();
    };
  },

  applyWorkflow: (sessionId: number, workflowId?: number) =>
    http.post<{ code: number; message: string }>('/alkaid/apply-workflow', { sessionId, workflowId }),

  applyPatch: (sessionId: number, workflowId?: number) =>
    http.post<{ code: number; message: string }>('/alkaid/apply-patch', { sessionId, workflowId }),

  discardPending: (sessionId: number, type: 'workflow' | 'patch') =>
    http.post<{ code: number; message: string }>('/alkaid/discard-pending', { sessionId, type }),
};
