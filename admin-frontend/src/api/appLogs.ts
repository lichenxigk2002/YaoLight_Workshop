import http from '@/api/http';
import type { AdminAppLogDetail, AdminAppLogListResponse } from '@/types/appLogs';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  if (response.data.code !== 200) {
    throw new Error(response.data.message || 'Request failed');
  }
  return response.data.data;
}

export interface ListAdminAppLogsParams {
  keyword?: string;
  level?: string;
  owner?: string;
  code?: number;
  file_path?: string;
  created_from?: string;
  created_to?: string;
  page?: number;
  page_size?: number;
}

function normalizeAppLogListResponse(payload: AdminAppLogListResponse | null | undefined): AdminAppLogListResponse {
  return {
    list: Array.isArray(payload?.list) ? payload.list : [],
    total: payload?.total ?? 0,
    page: payload?.page ?? 1,
    page_size: payload?.page_size ?? 20,
  };
}

export function listAdminAppLogs(params: ListAdminAppLogsParams) {
  return unwrap<AdminAppLogListResponse>(http.get('/admin/app-logs', { params })).then(normalizeAppLogListResponse);
}

export function getAdminAppLogDetail(id: number | string) {
  return unwrap<AdminAppLogDetail>(http.get(`/admin/app-logs/${id}`));
}

export function deleteAdminAppLog(id: number | string) {
  return unwrap<void>(http.delete(`/admin/app-logs/${id}`));
}

export function clearAdminAppLogs() {
  return unwrap<{ deleted: number }>(http.delete('/admin/app-logs'));
}
