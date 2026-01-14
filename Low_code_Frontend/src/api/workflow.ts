import http from '@/http';
import { createSSEReader } from '@/utils/sseUtils';
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
      timeout: 120000, // 120秒超时，给爬虫足够的时间执行
    }).then((result) => {
      return result;
    }).catch((error) => {
      console.error('工作流执行失败:', error);
      throw error;
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
    onMessage: (nodeId: string, content: string, done: boolean, contentType?: 'reasoning' | 'content' | 'node_complete' | 'node_result') => void,
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
    const url = `${baseURL}/workflows/execute/stream`;

    // 使用AbortController支持取消
    const abortController = new AbortController();

    let cancelReader: (() => void) | null = null;

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

        // 使用工具函数创建SSE读取器
        cancelReader = createSSEReader(response, {
          onMessage,
          onError,
          onComplete,
        });
      })
      .catch(err => {
        // 如果是取消操作，不触发错误回调
        if (err.name === 'AbortError') {
          // 取消操作，不显示错误
          return;
        }
          onError?.(err.message || '请求失败');
      });

    // 返回取消函数
    return () => {
      if (cancelReader) {
        cancelReader();
      }
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

  /**
   * 保存单个节点
   */
  saveWorkflowNode: (workflowId: number, nodeId: string, nodeData: { id: string; type: string; position: any; data: any }) =>
    http.put(`/workflows/${workflowId}/nodes/${nodeId}`, { node: nodeData }),
};
