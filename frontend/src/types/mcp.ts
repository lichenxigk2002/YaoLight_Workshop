import type { PageResponse } from './api';

export interface MCPToken {
  id: number;
  user_id: number;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at?: string | null;
  last_used_at?: string | null;
  last_used_ip?: string | null;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatedMCPToken {
  token: string;
  token_record: MCPToken;
}

export interface CreateMCPTokenRequest {
  name: string;
  scopes: string[];
  expires_in_days: number;
}

export interface MCPAccessSettings {
  enabled: boolean;
  allowExecutionTools: boolean;
  defaultExpiresInDays: number;
  maxExpiresInDays: number;
  maxTokensPerUser: number;
  rateLimitPerMinute: number;
  defaultScopes: string[];
  publicApiBaseUrl?: string;
}

export interface MCPCallLog {
  id: number;
  user_id: number;
  token_id?: number | null;
  tool_name: string;
  request_summary?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  status: 'success' | 'error' | string;
  error_message?: string | null;
  latency_ms: number;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export type MCPCallLogPage = PageResponse<MCPCallLog>;
