import http from '@/http';
import type { PageRequest, PageResponse } from '@/types/api';
import type {
  Workflow,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from '@/types/workflow';

/**
 * 工作流 API
 */
export const workflowApi = {
  /**
   * 获取工作流列表（分页）
   * @param params 分页参数，可包含 projectId 用于按项目筛选
   */
  getWorkflowList: (params?: PageRequest & { projectId?: number }) =>
    http.get<PageResponse<Workflow>>('/workflows', params),

  /**
   * 获取工作流详情
   */
  getWorkflowById: (id: number) =>
    http.get<Workflow>(`/workflows/${id}`),

  /**
   * 创建工作流
   */
  createWorkflow: (data: CreateWorkflowRequest) =>
    http.post<Workflow>('/workflows', data),

  /**
   * 更新工作流
   */
  updateWorkflow: (id: number, data: UpdateWorkflowRequest) =>
    http.put<Workflow>(`/workflows/${id}`, data),

  /**
   * 删除工作流
   */
  deleteWorkflow: (id: number) =>
    http.delete(`/workflows/${id}`),

  /**
   * 执行工作流
   */
  executeWorkflow: (data: ExecuteWorkflowRequest & { workflowId?: number }): Promise<ExecuteWorkflowResponse> => {
    return http.post('/workflows/execute', data, {
      timeout: 60000, // 60秒超时，给爬虫足够的时间执行
    });
  },

  /**
   * 流式执行工作流（SSE）
   * @param data 执行请求
   * @param onMessage 接收消息的回调函数
   * @param onError 错误回调函数
   * @param onComplete 完成回调函数
   * @returns 取消函数
   */
  executeWorkflowStream: (
    data: ExecuteWorkflowRequest & { workflowId?: number },
    onMessage: (nodeId: string, content: string, done: boolean, contentType?: 'reasoning' | 'content') => void,
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
      console.warn('获取token失败:', e);
    }

    const baseURL = import.meta.env.VITE_BASE_URL || '/api';
    const url = `${baseURL}/workflows/execute/stream`;

    // 使用AbortController支持取消
    const abortController = new AbortController();

    // 使用fetch实现POST + SSE
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(data),
      signal: abortController.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('✅ SSE连接建立成功');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is null');
        }

        let buffer = '';
        let currentData = '';

        const readChunk = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              console.log('✅ SSE流结束');
              // 处理最后的数据
              if (currentData) {
                try {
                  const parsed = JSON.parse(currentData);
                  if (parsed.nodeId && parsed.content !== undefined) {
                    // 解析内容类型标记
                    let content = parsed.content || '';
                    let contentType: 'reasoning' | 'content' | undefined = undefined;

                    if (content.startsWith('[REASONING_DELTA]')) {
                      content = content.substring('[REASONING_DELTA]'.length);
                      contentType = 'reasoning';
                    } else if (content.startsWith('[CONTENT_DELTA]')) {
                      content = content.substring('[CONTENT_DELTA]'.length);
                      contentType = 'content';
                    }

                    onMessage(parsed.nodeId, content, parsed.done || false, contentType);
                  }
                } catch (e) {
                  console.warn('解析最后SSE数据失败:', e);
                }
              }
              onComplete?.();
              return;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // 按行分割
            const lines = buffer.split('\n');
            // 保留最后一行不完整的数据
            buffer = lines.pop() || '';

            // 处理每一行的辅助函数
            const processData = (dataStr: string) => {
              if (!dataStr) return;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.nodeId && parsed.content !== undefined) {
                  // 直接使用后端发送的 contentType，如果没有则向后兼容解析标记
                  let content = parsed.content || '';
                  let contentType: 'reasoning' | 'content' | undefined = parsed.contentType || undefined;

                  // 如果后端没有发送 contentType，向后兼容：尝试解析标记
                  if (!contentType) {
                    if (content.startsWith('[REASONING_DELTA]')) {
                      content = content.substring('[REASONING_DELTA]'.length);
                      contentType = 'reasoning';
                      console.log('🧠 [SSE解析] 向后兼容：识别为思考内容增量:', content.substring(0, 30));
                    } else if (content.startsWith('[CONTENT_DELTA]')) {
                      content = content.substring('[CONTENT_DELTA]'.length);
                      contentType = 'content';
                      console.log('✅ [SSE解析] 向后兼容：识别为正式内容增量:', content.substring(0, 30));
                    } else if (content.includes('[REASONING]') || content.includes('[CONTENT]')) {
                      // 完整格式（done时可能发送）
                      const reasoningMatch = content.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
                      const contentMatch = content.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/);

                      if (reasoningMatch && contentMatch) {
                        // 同时包含两种内容，分别发送
                        console.log('🧠 [SSE解析] 向后兼容：识别为完整格式，包含思考和正式内容');
                        onMessage(parsed.nodeId, reasoningMatch[1], parsed.done || false, 'reasoning');
                        onMessage(parsed.nodeId, contentMatch[1], parsed.done || false, 'content');
                        return;
                      } else if (reasoningMatch) {
                        content = reasoningMatch[1];
                        contentType = 'reasoning';
                        console.log('🧠 [SSE解析] 向后兼容：识别为完整思考内容:', content.substring(0, 30));
                      } else if (contentMatch) {
                        content = contentMatch[1];
                        contentType = 'content';
                        console.log('✅ [SSE解析] 向后兼容：识别为完整正式内容:', content.substring(0, 30));
                      }
                    }
                  } else {
                    // 后端已发送 contentType，直接使用
                    if (contentType === 'reasoning') {
                      console.log('🧠 [SSE解析] 使用后端contentType: reasoning, 内容:', content.substring(0, 30));
                    } else if (contentType === 'content') {
                      console.log('✅ [SSE解析] 使用后端contentType: content, 内容:', content.substring(0, 30));
                    }
                  }

                  onMessage(parsed.nodeId, content, parsed.done || false, contentType);
                } else if (parsed.error) {
                  onError?.(parsed.error);
                }
              } catch (e) {
                console.warn('解析SSE数据失败:', dataStr, e);
              }
            };

            for (const line of lines) {
              const trimmedLine = line.trim();

              if (trimmedLine === '') {
                // 空行表示一个事件结束，处理之前累积的数据
                if (currentData) {
                  processData(currentData);
                  currentData = '';
                }
              } else if (line.startsWith('data:')) {
                // 遇到新的data行，先处理之前的数据（如果有）
                if (currentData) {
                  processData(currentData);
                }

                const dataContent = line.substring(5).trim();
                if (dataContent === '[DONE]') {
                  onComplete?.();
                  return;
                }
                currentData = dataContent;
              }
              // 忽略 event: 行和其他行
            }

            readChunk();
          }).catch(err => {
            if (err.name !== 'AbortError') {
              console.error('读取流失败:', err);
              onError?.(err.message || '读取流失败');
            }
          });
        };

        console.log('🚀 开始读取SSE流');
        readChunk();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          onError?.(err.message || '请求失败');
        }
      });

    // 返回取消函数
    return () => {
      abortController.abort();
    };
  },

  /**
   * 获取工作流的节点和边
   */
  getWorkflowNodes: (workflowId: number) =>
    http.get(`/workflows/${workflowId}/nodes`),

  /**
   * 保存工作流的节点和边
   */
  saveWorkflowNodes: (workflowId: number, data: { nodes: any[]; edges: any[]; commentCards?: any[] }) =>
    http.put(`/workflows/${workflowId}/nodes`, data),
};
