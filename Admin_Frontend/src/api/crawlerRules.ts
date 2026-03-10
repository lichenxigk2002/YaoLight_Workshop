import http from '@/api/http';
import type {
  CrawlerRuleDetail,
  CrawlerRuleListResponse,
  CrawlerRulePayload,
  CrawlerRuleTestResult,
  CrawlerRuleUsage,
} from '@/types/crawlerRules';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  if (response.data.code !== 200) {
    throw new Error(response.data.message || '请求失败');
  }
  return response.data.data;
}

export interface ListCrawlerRulesParams {
  keyword?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export function listCrawlerRules(params: ListCrawlerRulesParams) {
  return unwrap<CrawlerRuleListResponse>(
    http.get('/admin/crawler-rules', {
      params,
    }),
  );
}

export function getCrawlerRule(id: number) {
  return unwrap<CrawlerRuleDetail>(http.get(`/admin/crawler-rules/${id}`));
}

export function createCrawlerRule(payload: CrawlerRulePayload) {
  return unwrap<CrawlerRuleDetail>(http.post('/admin/crawler-rules', payload));
}

export function updateCrawlerRule(id: number, payload: CrawlerRulePayload) {
  return unwrap<CrawlerRuleDetail>(http.put(`/admin/crawler-rules/${id}`, payload));
}

export function deleteCrawlerRule(id: number) {
  return unwrap<{ id: number }>(http.delete(`/admin/crawler-rules/${id}`));
}

export function setCrawlerRuleStatus(id: number, isActive: boolean) {
  return unwrap<{ id: number; is_active: boolean }>(
    http.patch(`/admin/crawler-rules/${id}/status`, { is_active: isActive }),
  );
}

export function cloneCrawlerRule(id: number) {
  return unwrap<CrawlerRuleDetail>(http.post(`/admin/crawler-rules/${id}/clone`));
}

export function getCrawlerRuleUsages(id: number) {
  return unwrap<{ list: CrawlerRuleUsage[]; total: number }>(
    http.get(`/admin/crawler-rules/${id}/usages`),
  );
}

export function testCrawlerRule(payload: { rule_id?: number; test_url: string; override?: Record<string, unknown> } & Partial<CrawlerRulePayload>) {
  return unwrap<CrawlerRuleTestResult>(http.post('/admin/crawler-rules/test', payload));
}
