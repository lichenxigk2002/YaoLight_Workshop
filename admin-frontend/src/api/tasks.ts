import http from '@/api/http';
import type {
  AdminTaskActionResponse,
  AdminTaskArtifactListResponse,
  AdminTaskDetail,
  AdminTaskFailureStats,
  AdminTaskListResponse,
  AdminTaskLogResponse,
  AdminTaskNodeExecutionResponse,
  AdminTaskNodeExecutionDetailResponse,
  AdminTaskSummary,
} from '@/types/tasks';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  if (response.data.code !== 200) {
    throw new Error(response.data.message || '请求失败');
  }
  return response.data.data;
}

export interface ListAdminTasksParams {
  keyword?: string;
  user_id?: number;
  workflow_id?: number;
  status?: string;
  started_from?: string;
  started_to?: string;
  page?: number;
  page_size?: number;
}

export interface ListAdminTaskFailuresParams extends Omit<ListAdminTasksParams, 'status'> {
  error_keyword?: string;
  node_type?: string;
}

export function getAdminTasksSummary() {
  return unwrap<AdminTaskSummary>(http.get('/admin/tasks/summary'));
}

export function listAdminTasks(params: ListAdminTasksParams) {
  return unwrap<AdminTaskListResponse>(http.get('/admin/tasks', { params }));
}

export function listRunningAdminTasks(params: Omit<ListAdminTasksParams, 'status'>) {
  return unwrap<AdminTaskListResponse>(http.get('/admin/tasks/running', { params }));
}

export function listFailedAdminTasks(params: ListAdminTaskFailuresParams) {
  return unwrap<AdminTaskListResponse>(http.get('/admin/tasks/failures', { params }));
}

export function getAdminTaskFailureStats(params?: ListAdminTaskFailuresParams) {
  return unwrap<AdminTaskFailureStats>(http.get('/admin/tasks/failure-stats', { params }));
}

export function getAdminTaskDetail(id: string | number) {
  return unwrap<AdminTaskDetail>(http.get(`/admin/tasks/${id}`));
}

export function getAdminTaskArtifacts(id: string | number, params?: { page?: number; page_size?: number }) {
  return unwrap<AdminTaskArtifactListResponse>(http.get(`/admin/tasks/${id}/artifacts`, { params }));
}

export function getAdminTaskNodeExecutions(id: string | number) {
  return unwrap<AdminTaskNodeExecutionResponse>(http.get(`/admin/tasks/${id}/node-executions`));
}

export function getAdminTaskNodeExecutionDetail(id: string | number, executionId: string | number) {
  return unwrap<AdminTaskNodeExecutionDetailResponse>(http.get(`/admin/tasks/${id}/node-executions/${executionId}`));
}

export function getAdminTaskLogs(
  id: string | number,
  params?: { level?: string; node_id?: string; page?: number; page_size?: number },
) {
  return unwrap<AdminTaskLogResponse>(http.get(`/admin/tasks/${id}/logs`, { params }));
}

export function cancelAdminTask(id: string | number) {
  return unwrap<AdminTaskActionResponse>(http.post(`/admin/tasks/${id}/cancel`));
}

export function retryAdminTask(id: string | number) {
  return unwrap<AdminTaskActionResponse>(http.post(`/admin/tasks/${id}/retry`));
}

export async function downloadAdminTaskArtifact(id: string | number, filename?: string) {
  const response = await http.get(`/admin/tasks/artifacts/${id}/download`, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || `artifact-${id}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
