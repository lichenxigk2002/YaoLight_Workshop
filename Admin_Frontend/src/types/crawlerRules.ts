export interface CrawlerRuleListItem {
  id: number;
  name: string;
  description?: string | null;
  version: string;
  url_pattern?: string | null;
  url_pattern_type: 'regex' | 'glob' | 'exact';
  is_active: boolean;
  usage_count: number;
  success_rate?: number | null;
  updated_at: string;
  created_by?: number | null;
}

export interface CrawlerRuleDetail {
  id: number;
  name: string;
  description?: string | null;
  version: string;
  url_pattern?: string | null;
  url_pattern_type: 'regex' | 'glob' | 'exact';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
  body?: unknown;
  selectors?: Record<string, unknown> | null;
  data_extraction?: Record<string, unknown> | null;
  pagination?: Record<string, unknown> | null;
  proxy_config?: Record<string, unknown> | null;
  cookies?: Record<string, unknown> | null;
  timeout: number;
  retry_count: number;
  retry_delay: number;
  user_agent?: string | null;
  follow_redirects: boolean;
  verify_ssl: boolean;
  wait_time: number;
  javascript_enabled: boolean;
  screenshot: boolean;
  is_active: boolean;
  usage_count: number;
  success_rate?: number | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CrawlerRuleListResponse {
  list: CrawlerRuleListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CrawlerRuleUsage {
  workflow_id: number;
  workflow_name: string;
  node_id: string;
  node_type: string;
  referenced_at: string;
}

export interface CrawlerRulePayload {
  name: string;
  description?: string | null;
  version?: string;
  url_pattern: string;
  url_pattern_type: 'regex' | 'glob' | 'exact';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, unknown>;
  params?: Record<string, unknown>;
  body?: unknown;
  selectors?: Record<string, unknown>;
  data_extraction?: Record<string, unknown>;
  pagination?: Record<string, unknown>;
  proxy_config?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  timeout: number;
  retry_count: number;
  retry_delay: number;
  user_agent?: string | null;
  follow_redirects: boolean;
  verify_ssl: boolean;
  wait_time: number;
  javascript_enabled: boolean;
  screenshot: boolean;
  is_active: boolean;
}

export interface CrawlerRuleTestResult {
  success: boolean;
  data?: unknown;
  raw_html?: string;
  error?: string;
  extracted?: Record<string, unknown>;
  status_code?: number;
  response_time?: number;
  url?: string;
  cookies?: Record<string, string>;
  pages?: Array<Record<string, unknown>>;
}
