import http from '@/api/http';
import type {
  WorkflowTemplateCanvas,
  WorkflowTemplateDetail,
  WorkflowTemplateListItem,
  WorkflowTemplateListResponse,
  WorkflowTemplatePayload,
  WorkflowTemplateSourceWorkflowResponse,
  WorkflowTemplateSummary,
} from '@/types/workflowTemplates';

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

function normalizeTemplateItem<T extends { tags?: string[] | null; consent_status?: string | null }>(item: T): T {
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    consent_status: item.consent_status || 'none',
  };
}

function normalizeTemplateDetail(detail: WorkflowTemplateDetail): WorkflowTemplateDetail {
  return {
    ...normalizeTemplateItem(detail),
    node_type_stats: Array.isArray(detail.node_type_stats) ? detail.node_type_stats : [],
  };
}

function normalizeTemplateListResponse(payload: WorkflowTemplateListResponse): WorkflowTemplateListResponse {
  return {
    ...payload,
    list: Array.isArray(payload.list) ? payload.list.map((item: WorkflowTemplateListItem) => normalizeTemplateItem(item)) : [],
  };
}

function normalizeCanvas(canvas: WorkflowTemplateCanvas): WorkflowTemplateCanvas {
  return {
    ...canvas,
    nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
    edges: Array.isArray(canvas.edges) ? canvas.edges : [],
    commentCards: Array.isArray(canvas.commentCards) ? canvas.commentCards : [],
  };
}

export interface ListWorkflowTemplatesParams {
  keyword?: string;
  status?: string;
  category?: string;
  is_public?: boolean;
  page?: number;
  page_size?: number;
}

export function getWorkflowTemplateSummary() {
  return unwrap<WorkflowTemplateSummary>(http.get('/admin/workflow-templates/summary'));
}

export function listWorkflowTemplates(params: ListWorkflowTemplatesParams) {
  return unwrap<WorkflowTemplateListResponse>(http.get('/admin/workflow-templates', { params })).then(normalizeTemplateListResponse);
}

export function searchSourceWorkflows(keyword: string, pageSize = 20) {
  return unwrap<WorkflowTemplateSourceWorkflowResponse>(
    http.get('/admin/workflow-templates/source-workflows', {
      params: {
        keyword,
        page_size: pageSize,
      },
    }),
  );
}

export function getWorkflowTemplate(id: number) {
  return unwrap<WorkflowTemplateDetail>(http.get(`/admin/workflow-templates/${id}`)).then(normalizeTemplateDetail);
}

export function getWorkflowTemplateCanvas(id: number) {
  return unwrap<WorkflowTemplateCanvas>(http.get(`/admin/workflow-templates/${id}/canvas`)).then(normalizeCanvas);
}

export function getSourceWorkflowCanvas(id: number) {
  return unwrap<WorkflowTemplateCanvas>(http.get(`/workflows/${id}/nodes`)).then(normalizeCanvas);
}

export function createWorkflowTemplate(payload: WorkflowTemplatePayload) {
  return unwrap<WorkflowTemplateDetail>(http.post('/admin/workflow-templates', payload)).then(normalizeTemplateDetail);
}

export function updateWorkflowTemplate(id: number, payload: WorkflowTemplatePayload) {
  return unwrap<WorkflowTemplateDetail>(http.put(`/admin/workflow-templates/${id}`, payload)).then(normalizeTemplateDetail);
}

export function syncWorkflowTemplate(id: number, sourceWorkflowId?: number) {
  return unwrap<WorkflowTemplateDetail>(
    http.post(`/admin/workflow-templates/${id}/sync`, sourceWorkflowId ? { source_workflow_id: sourceWorkflowId } : {}),
  ).then(normalizeTemplateDetail);
}

export function saveWorkflowTemplateCanvas(id: number, payload: WorkflowTemplateCanvas) {
  return unwrap<{ id: number }>(http.put(`/admin/workflow-templates/${id}/canvas`, payload));
}

export function deleteWorkflowTemplate(id: number) {
  return unwrap<{ id: number }>(http.delete(`/admin/workflow-templates/${id}`));
}
