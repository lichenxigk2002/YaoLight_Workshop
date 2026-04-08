export type ProjectKnowledgeCategory =
  | 'node_usage'
  | 'error_repair'
  | 'best_practice'
  | 'scene_template'
  | 'business_rule';

export interface ProjectKnowledgeItem {
  id: number;
  projectId?: number;
  workflowId?: number;
  sourceType: string;
  category: ProjectKnowledgeCategory;
  target: string;
  title: string;
  contentExcerpt: string;
  sourceName?: string;
  sourceMimeType?: string;
  sourceSize?: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectKnowledgeDetail {
  id: number;
  projectId?: number;
  workflowId?: number;
  sourceType: string;
  category: ProjectKnowledgeCategory;
  target: string;
  title: string;
  content: string;
  sourceName?: string;
  sourceMimeType?: string;
  sourceSize?: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectKnowledgePayload {
  category: ProjectKnowledgeCategory;
  target?: string;
  title: string;
  content: string;
  sourceName?: string;
  sourceMimeType?: string;
  sourceSize?: number;
  tags: string[];
  isActive: boolean;
  workflowId?: number;
}

export interface ProjectKnowledgeListResponse {
  list: ProjectKnowledgeItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectKnowledgeSearchResult {
  id: number;
  scope: string;
  sourceType: string;
  category: ProjectKnowledgeCategory;
  target: string;
  title: string;
  contentExcerpt: string;
  tags: string[];
}

export interface ProjectKnowledgeSearchTestResult {
  query: string;
  total: number;
  list: ProjectKnowledgeSearchResult[];
}

export interface WebsiteSourceItem {
  id: number;
  projectId: number;
  name: string;
  baseUrl: string;
  entryUrl?: string;
  tags: string[];
  status: 'active' | 'disabled' | 'invalid';
  lastCheckedAt?: string;
  lastCheckStatus?: string;
  lastCheckMessage?: string;
  listUrlExamples: string[];
  detailUrlExamples: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteSourceDetail extends WebsiteSourceItem {
  allowedPatterns: string[];
  blockedPatterns: string[];
  crawlTips?: string;
  authHint?: string;
  contentHint?: string;
}

export interface WebsiteSourcePayload {
  name: string;
  baseUrl: string;
  entryUrl?: string;
  listUrlExamples: string[];
  detailUrlExamples: string[];
  allowedPatterns: string[];
  blockedPatterns: string[];
  crawlTips?: string;
  authHint?: string;
  contentHint?: string;
  tags: string[];
  status: 'active' | 'disabled' | 'invalid';
}

export interface WebsiteSourceListResponse {
  list: WebsiteSourceItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WebsiteSourceCheckResult {
  id: number;
  checkedAt: string;
  result: Record<string, any>;
}

export interface ProjectArtifactItem {
  id: number;
  workflowId?: number;
  taskId?: number;
  nodeId: string;
  name: string;
  kind: string;
  mimeType: string;
  size: number;
  workflowName?: string;
  taskName?: string;
  createdAt: string;
  downloadUrl: string;
}

export interface ProjectArtifactListResponse {
  list: ProjectArtifactItem[];
  total: number;
  page: number;
  pageSize: number;
}
