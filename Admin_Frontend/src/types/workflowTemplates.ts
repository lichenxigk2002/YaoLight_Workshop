export type WorkflowTemplateStatus = 'draft' | 'published' | 'archived' | 'disabled';

export interface WorkflowTemplateSummary {
  total: number;
  published: number;
  public: number;
  draft: number;
  archived: number;
  disabled: number;
}

export interface WorkflowTemplateListItem {
  id: number;
  name: string;
  description?: string | null;
  status: WorkflowTemplateStatus;
  category?: string | null;
  tags: string[];
  is_public: boolean;
  source_workflow_id?: number | null;
  source_workflow_name?: string | null;
  source_username?: string | null;
  node_count: number;
  comment_card_count: number;
  usage_count: number;
  execution_count: number;
  last_executed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateNodeTypeStat {
  node_type: string;
  count: number;
}

export interface WorkflowTemplateDetail {
  id: number;
  name: string;
  description?: string | null;
  version: string;
  status: WorkflowTemplateStatus;
  category?: string | null;
  tags: string[];
  is_public: boolean;
  source_workflow_id?: number | null;
  source_workflow_name?: string | null;
  source_username?: string | null;
  node_count: number;
  edge_count: number;
  comment_card_count: number;
  usage_count: number;
  execution_count: number;
  last_executed_at?: string | null;
  node_type_stats: WorkflowTemplateNodeTypeStat[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateSourceWorkflowItem {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  user_id: number;
  username: string;
  project_id?: number | null;
  node_count: number;
  updated_at: string;
}

export interface WorkflowTemplateListResponse {
  list: WorkflowTemplateListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface WorkflowTemplateSourceWorkflowResponse {
  list: WorkflowTemplateSourceWorkflowItem[];
}

export interface WorkflowTemplatePayload {
  source_workflow_id?: number;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  status: WorkflowTemplateStatus;
  is_public: boolean;
}

export interface WorkflowTemplateCanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data?: {
    label?: string;
    type?: string;
    config?: Record<string, unknown>;
    connectionDirection?: string;
    text?: string;
    color?: string;
  };
}

export interface WorkflowTemplateCanvasEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowTemplateCanvasCommentCard {
  id: string;
  position: { x: number; y: number };
  data?: {
    text?: string;
    color?: string;
  };
}

export interface WorkflowTemplateCanvas {
  nodes?: WorkflowTemplateCanvasNode[];
  edges?: WorkflowTemplateCanvasEdge[];
  commentCards?: WorkflowTemplateCanvasCommentCard[];
}
