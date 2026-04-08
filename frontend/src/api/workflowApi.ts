import http from '@/http'
import type {
  CreatedWorkflowAPIKey,
  WorkflowAPIEndpoint,
  WorkflowAPIInvocationPage,
  WorkflowAPIKeySummary,
  WorkflowPublicDocs,
} from '@/types/workflowApi'

const apiBase = import.meta.env.VITE_BASE_URL || '/api'
const openApiBase = apiBase.replace(/\/api\/?$/, '') + '/open-api/v1'

export const workflowPublishApi = {
  getEndpoint: (workflowId: number) =>
    http.get<WorkflowAPIEndpoint>(`/workflows/${workflowId}/api`),

  saveEndpoint: (workflowId: number, data: Partial<WorkflowAPIEndpoint>) =>
    http.post<WorkflowAPIEndpoint>(`/workflows/${workflowId}/api`, data),

  listKeys: (workflowId: number) =>
    http.get<WorkflowAPIKeySummary[]>(`/workflows/${workflowId}/api/keys`),

  createKey: (workflowId: number, data: { name: string }) =>
    http.post<CreatedWorkflowAPIKey>(`/workflows/${workflowId}/api/keys`, data),

  listInvocations: (workflowId: number, params?: { page?: number; pageSize?: number }) =>
    http.get<WorkflowAPIInvocationPage>(`/workflows/${workflowId}/api/invocations`, params),
}

export async function getPublicWorkflowDocs(slug: string): Promise<WorkflowPublicDocs> {
  const response = await fetch(`${openApiBase}/workflows/${slug}/docs`)
  const rawText = await response.text()

  let payload: any
  try {
    payload = JSON.parse(rawText)
  } catch {
    throw new Error('workflowApi.publicNonJson')
  }

  if (!response.ok || payload?.code !== 200) {
    throw new Error(payload?.message || 'workflowApi.publicLoadFailed')
  }

  return payload.data
}

export function getOpenApiBase() {
  return openApiBase
}
