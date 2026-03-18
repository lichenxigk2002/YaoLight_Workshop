import http from '@/http';
import type {
  TaskSchedulePage,
  TaskScheduleRunPage,
  TaskScheduleMutationResult,
} from '@/types/taskSchedule';

export const taskScheduleApi = {
  list: (params?: { workflowId?: number; triggerType?: string; page?: number; pageSize?: number }) =>
    http.get<TaskSchedulePage>('/task-schedules', params),

  create: (payload: Record<string, any>) =>
    http.post<TaskScheduleMutationResult>('/task-schedules', payload),

  update: (id: number, payload: Record<string, any>) =>
    http.patch<TaskScheduleMutationResult>(`/task-schedules/${id}`, payload),

  cancel: (id: number) =>
    http.post(`/task-schedules/${id}/cancel`, {}),

  triggerNow: (id: number, payload?: { input?: any; requestId?: string }) =>
    http.post(`/task-schedules/${id}/trigger-now`, payload || {}),

  listRuns: (id: number, params?: { page?: number; pageSize?: number }) =>
    http.get<TaskScheduleRunPage>(`/task-schedules/${id}/runs`, params),
};
