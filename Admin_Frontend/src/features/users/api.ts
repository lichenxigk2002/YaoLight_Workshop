import http from '@/api/http';
import type {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListPage,
  AdminUserListQuery,
  AdminUserStatus,
  AdminUserSummary,
} from './types';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function unwrap<T>(payload: ApiEnvelope<T>, fallback: string): T {
  if (payload.code !== 200 || payload.data === undefined || payload.data === null) {
    throw new Error(payload.message || fallback);
  }
  return payload.data;
}

export async function getAdminUserSummary(): Promise<AdminUserSummary> {
  const { data } = await http.get<ApiEnvelope<AdminUserSummary>>('/admin/users/summary');
  return unwrap(data, '获取用户概览失败');
}

export async function getAdminUsers(params: AdminUserListQuery): Promise<AdminUserListPage> {
  const { data } = await http.get<ApiEnvelope<AdminUserListPage>>('/admin/users', { params });
  return unwrap(data, '获取用户列表失败');
}

export async function getAdminUserDetail(userId: number): Promise<AdminUserDetail> {
  const { data } = await http.get<ApiEnvelope<AdminUserDetail>>(`/admin/users/${userId}`);
  return unwrap(data, '获取用户详情失败');
}

export async function updateAdminUserStatus(userId: number, status: AdminUserStatus): Promise<AdminUserListItem> {
  const { data } = await http.put<ApiEnvelope<AdminUserListItem>>(`/admin/users/${userId}/status`, { status });
  return unwrap(data, '更新用户状态失败');
}

export async function resetAdminUserPassword(userId: number, password: string): Promise<void> {
  const { data } = await http.post<ApiEnvelope<null>>(`/admin/users/${userId}/reset-password`, { password });
  if (data.code !== 200) {
    throw new Error(data.message || '重置密码失败');
  }
}
