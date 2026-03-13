export interface NodeTypeSummary {
  total: number;
  active: number;
  system: number;
  custom: number;
  inactive: number;
  workflow_usages: number;
}

export interface NodeTypeListItem {
  id: number;
  name: string;
  category: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  is_system: boolean;
  is_active: boolean;
  version: string;
  usage_count: number;
  workflow_count: number;
  created_at: string;
  updated_at: string;
}

export interface NodeTypeDetail extends NodeTypeListItem {
  config_schema?: unknown;
  default_config?: unknown;
  documentation?: string | null;
  examples?: unknown;
}

export interface NodeTypeListResponse {
  list: NodeTypeListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface NodeTypePayload {
  name: string;
  category: string;
  icon?: string | null;
  color?: string | null;
  config_schema?: unknown;
  default_config?: unknown;
  description?: string | null;
  documentation?: string | null;
  examples?: unknown;
  is_active: boolean;
  version?: string;
}
