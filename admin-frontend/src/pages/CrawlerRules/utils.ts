import type {
  CrawlerRuleDetail,
  CrawlerRulePayload,
} from '@/types/crawlerRules';

export type FilterStatus = 'all' | 'active' | 'inactive';

export interface RuleFormValues {
  name: string;
  description: string;
  version: string;
  url_pattern: string;
  url_pattern_type: 'regex' | 'glob' | 'exact';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers_json: string;
  params_json: string;
  body_json: string;
  selectors_json: string;
  data_extraction_json: string;
  pagination_json: string;
  proxy_config_json: string;
  cookies_json: string;
  timeout: number;
  retry_count: number;
  retry_delay: number;
  user_agent: string;
  follow_redirects: boolean;
  verify_ssl: boolean;
  wait_time: number;
  javascript_enabled: boolean;
  screenshot: boolean;
  is_active: boolean;
}

export interface TestFormValues {
  test_url: string;
  override_json: string;
}

export const DEFAULT_RULE_FORM: RuleFormValues = {
  name: '',
  description: '',
  version: '1.0.0',
  url_pattern: '',
  url_pattern_type: 'regex',
  method: 'GET',
  headers_json: '{}',
  params_json: '{}',
  body_json: '',
  selectors_json: '{\n  "primary": "",\n  "wait_for_selector": ""\n}',
  data_extraction_json: '{\n  "mode": "custom",\n  "extract_type": "text",\n  "extract_attr": ""\n}',
  pagination_json: '',
  proxy_config_json: '',
  cookies_json: '',
  timeout: 30,
  retry_count: 3,
  retry_delay: 1,
  user_agent: '',
  follow_redirects: true,
  verify_ssl: true,
  wait_time: 0,
  javascript_enabled: false,
  screenshot: false,
  is_active: true,
};

export const DEFAULT_TEST_FORM: TestFormValues = {
  test_url: '',
  override_json: '{\n  "timeout": 30\n}',
};

export function prettyJson(value: unknown, fallback = '{}') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

export function parseJsonField(label: string, raw: string, mode: 'object' | 'optional-object' | 'optional-any') {
  const text = raw.trim();
  if (!text) {
    if (mode === 'optional-object' || mode === 'optional-any') {
      return undefined;
    }
    return {};
  }

  const value = JSON.parse(text) as unknown;
  if (mode !== 'optional-any' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
  return value;
}

export function toRulePayload(values: RuleFormValues): CrawlerRulePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    version: values.version.trim() || '1.0.0',
    url_pattern: values.url_pattern.trim(),
    url_pattern_type: values.url_pattern_type,
    method: values.method,
    headers: (parseJsonField('请求头', values.headers_json, 'object') as Record<string, unknown>) ?? {},
    params: (parseJsonField('查询参数', values.params_json, 'object') as Record<string, unknown>) ?? {},
    body: parseJsonField('请求体', values.body_json, 'optional-any'),
    selectors: (parseJsonField('选择器配置', values.selectors_json, 'object') as Record<string, unknown>) ?? {},
    data_extraction: parseJsonField('提取配置', values.data_extraction_json, 'optional-object') as Record<string, unknown> | undefined,
    pagination: parseJsonField('分页配置', values.pagination_json, 'optional-object') as Record<string, unknown> | undefined,
    proxy_config: parseJsonField('代理配置', values.proxy_config_json, 'optional-object') as Record<string, unknown> | undefined,
    cookies: parseJsonField('Cookies', values.cookies_json, 'optional-object') as Record<string, unknown> | undefined,
    timeout: values.timeout,
    retry_count: values.retry_count,
    retry_delay: values.retry_delay,
    user_agent: values.user_agent.trim() || null,
    follow_redirects: values.follow_redirects,
    verify_ssl: values.verify_ssl,
    wait_time: values.wait_time,
    javascript_enabled: values.javascript_enabled,
    screenshot: values.screenshot,
    is_active: values.is_active,
  };
}

export function detailToFormValues(detail: CrawlerRuleDetail): RuleFormValues {
  return {
    name: detail.name ?? '',
    description: detail.description ?? '',
    version: detail.version ?? '1.0.0',
    url_pattern: detail.url_pattern ?? '',
    url_pattern_type: detail.url_pattern_type ?? 'regex',
    method: detail.method ?? 'GET',
    headers_json: prettyJson(detail.headers, '{}'),
    params_json: prettyJson(detail.params, '{}'),
    body_json: detail.body === null || detail.body === undefined ? '' : prettyJson(detail.body, ''),
    selectors_json: prettyJson(detail.selectors, '{}'),
    data_extraction_json: detail.data_extraction ? prettyJson(detail.data_extraction, '{}') : '',
    pagination_json: detail.pagination ? prettyJson(detail.pagination, '{}') : '',
    proxy_config_json: detail.proxy_config ? prettyJson(detail.proxy_config, '{}') : '',
    cookies_json: detail.cookies ? prettyJson(detail.cookies, '{}') : '',
    timeout: detail.timeout ?? 30,
    retry_count: detail.retry_count ?? 3,
    retry_delay: detail.retry_delay ?? 1,
    user_agent: detail.user_agent ?? '',
    follow_redirects: detail.follow_redirects ?? true,
    verify_ssl: detail.verify_ssl ?? true,
    wait_time: detail.wait_time ?? 0,
    javascript_enabled: detail.javascript_enabled ?? false,
    screenshot: detail.screenshot ?? false,
    is_active: detail.is_active ?? true,
  };
}

export function getStatusMeta(active: boolean) {
  return active ? { color: 'green', label: '启用中' } : { color: 'default', label: '已停用' };
}

export function formatSuccessRate(value?: number | null) {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${value.toFixed(2)}%`;
}
