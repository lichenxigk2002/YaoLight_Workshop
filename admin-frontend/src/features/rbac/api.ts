import http from '@/api/http';
import type {
  AdminAccountItem,
  AdminAccountStatus,
  CreateAdminPayload,
  CreateRolePayload,
  PermissionOption,
  PromoteAdminPayload,
  PromotableUserOption,
  RoleListItem,
  UpdateRolePayload,
} from './types';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function unwrap<T>(payload: ApiEnvelope<T>, fallback: string): T {
  if (payload.code !== 200 || payload.data === undefined) {
    throw new Error(payload.message || fallback);
  }
  return payload.data;
}

export async function getRbacPermissions(): Promise<PermissionOption[]> {
  const { data } = await http.get<ApiEnvelope<PermissionOption[]>>('/admin/rbac/permissions');
  return unwrap(data, '加载权限列表失败');
}

export async function getRbacRoles(): Promise<RoleListItem[]> {
  const { data } = await http.get<ApiEnvelope<RoleListItem[]>>('/admin/rbac/roles');
  return unwrap(data, '加载角色列表失败');
}

export async function createRbacRole(payload: CreateRolePayload): Promise<RoleListItem> {
  const { data } = await http.post<ApiEnvelope<RoleListItem>>('/admin/rbac/roles', payload);
  return unwrap(data, '创建角色失败');
}

export async function updateRbacRole(roleId: number, payload: UpdateRolePayload): Promise<RoleListItem> {
  const { data } = await http.put<ApiEnvelope<RoleListItem>>(`/admin/rbac/roles/${roleId}`, payload);
  return unwrap(data, '更新角色失败');
}

export async function getRbacAdmins(): Promise<AdminAccountItem[]> {
  const { data } = await http.get<ApiEnvelope<AdminAccountItem[]>>('/admin/rbac/admins');
  return unwrap(data, '加载管理员列表失败');
}

export async function getRbacPromotableUsers(keyword?: string): Promise<PromotableUserOption[]> {
  const { data } = await http.get<ApiEnvelope<PromotableUserOption[]>>('/admin/rbac/promotable-users', {
    params: { keyword: keyword?.trim() || undefined },
  });
  return unwrap(data, '加载可提权用户列表失败');
}

export async function createRbacAdmin(payload: CreateAdminPayload): Promise<AdminAccountItem> {
  const { data } = await http.post<ApiEnvelope<AdminAccountItem>>('/admin/rbac/admins', payload);
  return unwrap(data, '创建管理员失败');
}

export async function promoteRbacAdmin(payload: PromoteAdminPayload): Promise<AdminAccountItem> {
  const { data } = await http.post<ApiEnvelope<AdminAccountItem>>('/admin/rbac/admins/promote', payload);
  return unwrap(data, '提权用户为管理员失败');
}

export async function updateRbacAdminRoles(adminId: number, roleIds: number[]): Promise<AdminAccountItem> {
  const { data } = await http.put<ApiEnvelope<AdminAccountItem>>(`/admin/rbac/admins/${adminId}/roles`, {
    role_ids: roleIds,
  });
  return unwrap(data, '更新管理员角色失败');
}

export async function updateRbacAdminStatus(adminId: number, status: AdminAccountStatus): Promise<AdminAccountItem> {
  const { data } = await http.put<ApiEnvelope<AdminAccountItem>>(`/admin/rbac/admins/${adminId}/status`, { status });
  return unwrap(data, '更新管理员状态失败');
}

export async function resetRbacAdminPassword(adminId: number, password: string): Promise<void> {
  const { data } = await http.post<ApiEnvelope<null>>(`/admin/rbac/admins/${adminId}/reset-password`, { password });
  if (data.code !== 200) {
    throw new Error(data.message || '重置管理员密码失败');
  }
}

export async function demoteRbacAdmin(adminId: number): Promise<void> {
  const { data } = await http.post<ApiEnvelope<{ id: number; role: 'user' }>>(`/admin/rbac/admins/${adminId}/demote`);
  if (data.code !== 200) {
    throw new Error(data.message || '管理员降权失败');
  }
}
