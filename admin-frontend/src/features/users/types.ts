export type AdminUserRole = 'admin' | 'user';
export type AdminUserStatus = 'active' | 'inactive' | 'suspended';

export interface AdminUserSummary {
  total: number;
  active: number;
  admins: number;
  new_last_7_days: number;
}

export interface AdminUserListItem {
  id: number;
  user_no: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  token_balance: number;
  login_count: number;
  last_login_at?: string | null;
  created_at: string;
}

export interface AdminUserInviter {
  id: number;
  username: string;
  email: string;
}

export interface AdminUserStats {
  project_count: number;
  workflow_count: number;
  task_count: number;
  invite_count: number;
  paid_order_count: number;
  total_paid: number;
}

export interface AdminUserDetail extends AdminUserListItem {
  phone?: string | null;
  real_name?: string | null;
  last_login_ip?: string | null;
  updated_at: string;
  has_password: boolean;
  inviter?: AdminUserInviter | null;
  stats: AdminUserStats;
}

export interface AdminUserListQuery {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: AdminUserStatus;
  role?: AdminUserRole;
  created_from?: string;
  created_to?: string;
}

export interface AdminUserListPage {
  list: AdminUserListItem[];
  total: number;
  page: number;
  page_size: number;
}
