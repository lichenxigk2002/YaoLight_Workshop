import http from '@/api/http';
import type {
  KnowledgeDetail,
  KnowledgeListResponse,
  KnowledgePayload,
  KnowledgeSearchTestResult,
  KnowledgeSummary,
} from '@/types/knowledgeBase';

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

export interface ListKnowledgeParams {
  keyword?: string;
  category?: string;
  scope?: 'all' | 'system' | 'private';
  is_active?: boolean;
  user_id?: number;
  page?: number;
  page_size?: number;
}

export function getKnowledgeSummary() {
  return unwrap<KnowledgeSummary>(http.get('/admin/alkaid/knowledge/summary'));
}

export function listKnowledge(params: ListKnowledgeParams) {
  return unwrap<KnowledgeListResponse>(http.get('/admin/alkaid/knowledge', { params }));
}

export function getKnowledge(id: number) {
  return unwrap<KnowledgeDetail>(http.get(`/admin/alkaid/knowledge/${id}`));
}

export function createKnowledge(payload: KnowledgePayload) {
  return unwrap<KnowledgeDetail>(http.post('/admin/alkaid/knowledge', payload));
}

export function updateKnowledge(id: number, payload: KnowledgePayload) {
  return unwrap<KnowledgeDetail>(http.put(`/admin/alkaid/knowledge/${id}`, payload));
}

export function deleteKnowledge(id: number) {
  return unwrap<{ id: number }>(http.delete(`/admin/alkaid/knowledge/${id}`));
}

export function setKnowledgeStatus(id: number, isActive: boolean) {
  return unwrap<{ id: number; is_active: boolean }>(
    http.patch(`/admin/alkaid/knowledge/${id}/status`, { is_active: isActive }),
  );
}

export function runKnowledgeSearchTest(payload: { query: string; user_id?: number; limit?: number }) {
  return unwrap<KnowledgeSearchTestResult>(http.post('/admin/alkaid/knowledge/search-test', payload));
}
