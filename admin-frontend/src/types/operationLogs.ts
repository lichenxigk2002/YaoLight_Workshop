export interface AdminOperationLogListItem {
  id: number;
  user_id?: number | null;
  username?: string | null;
  real_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  action: string;
  resource_type: string;
  resource_id?: number | null;
  ip_address?: string | null;
  status_code?: number | null;
  error_message?: string | null;
  created_at: string;
}

export interface AdminOperationLogDetail extends AdminOperationLogListItem {
  user_agent?: string | null;
  request_data?: unknown;
  response_data?: unknown;
}

export interface AdminOperationLogListResponse {
  list: AdminOperationLogListItem[];
  total: number;
  page: number;
  page_size: number;
}
