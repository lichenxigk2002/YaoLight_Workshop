export type KnowledgeScope = 'system' | 'private';

export type KnowledgeCategory = 'node_usage' | 'error_repair' | 'best_practice' | 'scene_template';

export interface KnowledgeItem {
  id: number;
  user_id?: number | null;
  scope: KnowledgeScope;
  category: KnowledgeCategory;
  target: string;
  title: string;
  content_excerpt: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDetail {
  id: number;
  user_id?: number | null;
  scope: KnowledgeScope;
  category: KnowledgeCategory;
  target: string;
  title: string;
  content: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeListResponse {
  list: KnowledgeItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeSummary {
  total: number;
  active: number;
  system_count: number;
  private_count: number;
  category_counts: Record<string, number>;
}

export interface KnowledgePayload {
  user_id?: number | null;
  category: KnowledgeCategory;
  target?: string;
  title: string;
  content: string;
  tags: string[];
  is_active: boolean;
}

export interface KnowledgeSearchResult {
  id: number;
  user_id?: number | null;
  scope: KnowledgeScope;
  category: KnowledgeCategory;
  target: string;
  title: string;
  content_excerpt: string;
  tags: string[];
}

export interface KnowledgeSearchTestResult {
  query: string;
  total: number;
  list: KnowledgeSearchResult[];
}
