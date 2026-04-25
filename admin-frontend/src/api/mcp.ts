import http from '@/api/http';
import axios from 'axios';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise;
    if (response.data.code !== 200) {
      throw new Error(response.data.message || 'Request failed');
    }
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
      throw new Error(error.response?.data?.message || error.message || 'Request failed');
    }
    throw error;
  }
}

export interface AdminMCPSettings {
  enabled: boolean;
  allowExecutionTools: boolean;
  defaultExpiresInDays: number;
  maxExpiresInDays: number;
  maxTokensPerUser: number;
  rateLimitPerMinute: number;
  defaultScopes: string[];
}

export interface AdminMCPToken {
  id: number;
  user_id: number;
  username?: string;
  email?: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at?: string | null;
  last_used_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
}

export interface AdminMCPCallLog {
  id: number;
  user_id: number;
  username?: string;
  email?: string;
  tool_name: string;
  resource_type?: string | null;
  resource_id?: string | null;
  status: string;
  error_message?: string | null;
  latency_ms: number;
  created_at: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminMCPApi = {
  getSettings: () => unwrap<AdminMCPSettings>(http.get('/admin/mcp/settings')),
  updateSettings: (payload: AdminMCPSettings) => unwrap<AdminMCPSettings>(http.put('/admin/mcp/settings', payload)),
  listTokens: (params?: Record<string, unknown>) => unwrap<PageResult<AdminMCPToken>>(http.get('/admin/mcp/tokens', { params })),
  revokeToken: (id: number) => unwrap<void>(http.post(`/admin/mcp/tokens/${id}/revoke`)),
  revokeUserTokens: (userId: number) => unwrap<void>(http.post(`/admin/mcp/users/${userId}/revoke-tokens`)),
  listCallLogs: (params?: Record<string, unknown>) => unwrap<PageResult<AdminMCPCallLog>>(http.get('/admin/mcp/call-logs', { params })),
};
