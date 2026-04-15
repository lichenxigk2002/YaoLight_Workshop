import http from '@/api/http';
import type { AdminOperationLogDetail, AdminOperationLogListResponse } from '@/types/operationLogs';

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

export interface ListAdminOperationLogsParams {
  keyword?: string;
  action?: string;
  resource_type?: string;
  resource_id?: number;
  result?: 'success' | 'failed';
  status_code?: number;
  created_from?: string;
  created_to?: string;
  page?: number;
  page_size?: number;
}

export function listAdminOperationLogs(params: ListAdminOperationLogsParams) {
  return unwrap<AdminOperationLogListResponse>(http.get('/admin/operation-logs', { params }));
}

export function getAdminOperationLogDetail(id: number | string) {
  return unwrap<AdminOperationLogDetail>(http.get(`/admin/operation-logs/${id}`));
}
