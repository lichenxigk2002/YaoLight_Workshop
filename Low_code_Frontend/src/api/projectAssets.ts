import http from '@/http';
import type {
  ProjectArtifactListResponse,
  ProjectKnowledgeDetail,
  ProjectKnowledgeListResponse,
  ProjectKnowledgePayload,
  ProjectKnowledgeSearchTestResult,
  WebsiteSourceCheckResult,
  WebsiteSourceDetail,
  WebsiteSourceListResponse,
  WebsiteSourcePayload,
} from '@/types/projectAssets';

export const projectAssetsApi = {
  listKnowledge: (projectId: number, params?: Record<string, any>) =>
    http.get<ProjectKnowledgeListResponse>(`/projects/${projectId}/knowledge`, params),

  getKnowledge: (projectId: number, id: number) =>
    http.get<ProjectKnowledgeDetail>(`/projects/${projectId}/knowledge/${id}`),

  createKnowledge: (projectId: number, payload: ProjectKnowledgePayload) =>
    http.post<ProjectKnowledgeDetail>(`/projects/${projectId}/knowledge`, payload),

  updateKnowledge: (projectId: number, id: number, payload: ProjectKnowledgePayload) =>
    http.put<ProjectKnowledgeDetail>(`/projects/${projectId}/knowledge/${id}`, payload),

  deleteKnowledge: (projectId: number, id: number) =>
    http.delete(`/projects/${projectId}/knowledge/${id}`),

  setKnowledgeStatus: (projectId: number, id: number, isActive: boolean) =>
    http.patch(`/projects/${projectId}/knowledge/${id}/status`, { isActive }),

  searchKnowledgeTest: (projectId: number, query: string, limit = 5) =>
    http.post<ProjectKnowledgeSearchTestResult>(`/projects/${projectId}/knowledge/search-test`, { query, limit }),

  listSources: (projectId: number, params?: Record<string, any>) =>
    http.get<WebsiteSourceListResponse>(`/projects/${projectId}/sources`, params),

  getSource: (projectId: number, id: number) =>
    http.get<WebsiteSourceDetail>(`/projects/${projectId}/sources/${id}`),

  createSource: (projectId: number, payload: WebsiteSourcePayload) =>
    http.post<WebsiteSourceDetail>(`/projects/${projectId}/sources`, payload),

  updateSource: (projectId: number, id: number, payload: WebsiteSourcePayload) =>
    http.put<WebsiteSourceDetail>(`/projects/${projectId}/sources/${id}`, payload),

  deleteSource: (projectId: number, id: number) =>
    http.delete(`/projects/${projectId}/sources/${id}`),

  setSourceStatus: (projectId: number, id: number, status: string) =>
    http.patch(`/projects/${projectId}/sources/${id}/status`, { status }),

  checkSource: (projectId: number, id: number) =>
    http.post<WebsiteSourceCheckResult>(`/projects/${projectId}/sources/${id}/check`),

  listArtifacts: (projectId: number, params?: Record<string, any>) =>
    http.get<ProjectArtifactListResponse>(`/projects/${projectId}/artifacts`, params),
};
