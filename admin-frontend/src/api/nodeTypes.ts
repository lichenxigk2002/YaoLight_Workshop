import http from '@/api/http';
import type {
  NodeTypeDetail,
  NodeTypeListResponse,
  NodeTypePayload,
  NodeTypeSummary,
} from '@/types/nodeTypes';

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

export interface ListNodeTypesParams {
  keyword?: string;
  category?: string;
  is_system?: boolean;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export function getNodeTypeSummary() {
  return unwrap<NodeTypeSummary>(http.get('/admin/node-types/summary'));
}

export function listNodeTypes(params: ListNodeTypesParams) {
  return unwrap<NodeTypeListResponse>(http.get('/admin/node-types', { params }));
}

export function getNodeType(id: number) {
  return unwrap<NodeTypeDetail>(http.get(`/admin/node-types/${id}`));
}

export function createNodeType(payload: NodeTypePayload) {
  return unwrap<NodeTypeDetail>(http.post('/admin/node-types', payload));
}

export function updateNodeType(id: number, payload: NodeTypePayload) {
  return unwrap<NodeTypeDetail>(http.put(`/admin/node-types/${id}`, payload));
}

export function setNodeTypeStatus(id: number, isActive: boolean) {
  return unwrap<{ id: number; is_active: boolean }>(
    http.patch(`/admin/node-types/${id}/status`, { is_active: isActive }),
  );
}

export function deleteNodeType(id: number) {
  return unwrap<{ id: number }>(http.delete(`/admin/node-types/${id}`));
}
