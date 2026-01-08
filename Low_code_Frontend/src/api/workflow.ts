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
   * 获取工作流的节点和边
   */
  getWorkflowNodes: (workflowId: number) =>
    http.get<{ nodes: any[]; edges: any[]; commentCards?: any[] }>(`/workflows/${workflowId}/nodes`),

  /**
   * 保存工作流的节点和边
   */
  saveWorkflowNodes: (workflowId: number, data: { nodes: any[]; edges: any[]; commentCards?: any[] }) =>
    http.put(`/workflows/${workflowId}/nodes`, data),
};
