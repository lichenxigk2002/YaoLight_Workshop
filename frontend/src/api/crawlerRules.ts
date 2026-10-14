import http from '@/http';

export interface WorkflowCrawlerRuleListItem {
  id: number;
  name: string;
  description?: string | null;
  version: string;
  url_pattern?: string | null;
  url_pattern_type: string;
  is_active: boolean;
  usage_count: number;
  success_rate?: number | null;
  updated_at: string;
  created_by?: number | null;
}

interface WorkflowCrawlerRuleListResponse {
  list: WorkflowCrawlerRuleListItem[];
  total: number;
  page: number;
  page_size: number;
}

export const crawlerRulesApi = {
  list: (params?: { keyword?: string; is_active?: boolean; page?: number; page_size?: number }) =>
    http.get<WorkflowCrawlerRuleListResponse>('/crawler-rules/options', {
      keyword: params?.keyword,
      is_active: params?.is_active,
      page: params?.page || 1,
      page_size: params?.page_size || 50,
    }),
};
