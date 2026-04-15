export interface AdminAppLogListItem {
  id: number;
  logged_at: string;
  level: string;
  owner: string;
  code: number;
  message: string;
  file_path?: string | null;
  created_at: string;
}

export interface AdminAppLogDetail extends AdminAppLogListItem {
  context?: unknown;
}

export interface AdminAppLogListResponse {
  list: AdminAppLogListItem[];
  total: number;
  page: number;
  page_size: number;
}
