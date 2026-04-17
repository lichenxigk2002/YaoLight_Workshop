import http from '@/http';
import type {
  Task,
  TaskListResponse,
  TaskNodeExecutionListResponse,
  TaskNodeExecutionDetailResponse,
  TaskLogListResponse,
  RunningTasksResponse,
  GetTaskListParams,
  GetTaskLogsParams,
} from '@/types/task';

export const taskApi = {
  /**
   * 获取工作流的任务历史列表
   * @param workflowId 工作流ID
   * @param params 分页参数
   */
  getWorkflowTasks: (workflowId: number, params?: GetTaskListParams) =>
    http.get<TaskListResponse>(`/workflows/${workflowId}/tasks`, {
      page: params?.page || 1,
      limit: params?.limit || 20,
    }),

  /**
   * 获取工作流正在运行的任务
   * @param workflowId 工作流ID
   */
  getRunningTasks: (workflowId: number) =>
    http.get<RunningTasksResponse>(`/workflows/${workflowId}/running-tasks`),

  /**
   * 获取任务详情
   * @param taskId 任务ID
   */
  getTaskDetail: (taskId: number) =>
    http.get<Task>(`/tasks/${taskId}`),

  cancelTask: (taskId: number) =>
    http.post<{ task_id: number; status: string; message: string }>(`/tasks/${taskId}/cancel`, {}),

  /**
   * 获取任务的节点执行记录
   * @param taskId 任务ID
   */
  getTaskNodeExecutions: (taskId: number) =>
    http.get<TaskNodeExecutionListResponse>(`/tasks/${taskId}/node-executions`),

  getTaskNodeExecutionDetail: (taskId: number, executionId: number) =>
    http.get<TaskNodeExecutionDetailResponse>(`/tasks/${taskId}/node-executions/${executionId}`),

  /**
   * 获取任务日志
   * @param taskId 任务ID
   * @param params 日志查询参数
   */
  getTaskLogs: (taskId: number, params?: GetTaskLogsParams) =>
    http.get<TaskLogListResponse>(`/tasks/${taskId}/logs`, {
      level: params?.level,
      page: params?.page || 1,
      limit: params?.limit || 100,
    }),

  sendArtifactsEmail: (
    taskId: number,
    payload: {
      to: string;
      subject: string;
      artifactIds: number[];
      body?: string;
    },
  ) =>
    http.post(`/tasks/${taskId}/artifacts/send-email`, payload),
};
