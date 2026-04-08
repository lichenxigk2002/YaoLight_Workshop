export type AdminAccountStatus = 'active' | 'inactive' | 'suspended';

export interface PermissionOption {
  id: number;
  resource_key: string;
  action: 'view' | 'edit';
  key: string;
  description?: string | null;
}

export interface RoleListItem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  admin_count: number;
  permission_ids: number[];
  permissions: PermissionOption[];
}

export interface AdminRoleSummary {
  id: number;
  code: string;
  name: string;
}

export interface AdminAccountItem {
  id: number;
  user_no: number;
  username: string;
  email: string;
  phone?: string | null;
  status: AdminAccountStatus;
  created_at: string;
  updated_at: string;
  roles: AdminRoleSummary[];
  permissions: string[];
}

export interface PromotableUserOption {
  id: number;
  user_no: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  status: AdminAccountStatus;
}

export interface CreateRolePayload {
  code: string;
  name: string;
  description?: string;
  permission_ids: number[];
}

export interface UpdateRolePayload {
  name: string;
  description?: string;
  permission_ids: number[];
}

export interface CreateAdminPayload {
  username: string;
  email: string;
  password: string;
  phone?: string;
  role_ids: number[];
}

export interface PromoteAdminPayload {
  user_id: number;
  role_ids: number[];
}
