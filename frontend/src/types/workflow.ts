/**
 * 工作流相关类型定义
 */

/**
 * 工作流信息
 */
export interface Workflow {
  id: number;
  name: string;
  description?: string;
  projectId: number;
  templateId?: number;
  status: string; // 'draft' | 'published' | 'archived'
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 工作流节点
 */
export interface WorkflowNode {
  id: string;
  type: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

/**
 * 工作流边
 */
export interface WorkflowEdge {
  source: string;
  target: string;
}

/**
 * 执行工作流请求
 */
export interface ExecuteWorkflowRequest {
  workflowId?: number;  // 如果提供 workflowId，则从数据库加载配置，nodes 和 edges 可选
  nodes?: WorkflowNode[];  // 如果 workflowId 为空，则必须提供 nodes
  edges?: WorkflowEdge[];  // 如果 workflowId 为空，则必须提供 edges
}

/**
 * 节点执行结果
 */
export interface NodeExecutionResult {
  node_id: string;
  type: string;
  success: boolean;
  data: any;
  error?: string;
}

/**
 * 执行工作流响应
 */
export interface ExecuteWorkflowResponse {
  success: boolean;
  results: NodeExecutionResult[];
  error?: string;
}

/**
 * 创建工作流请求
 */
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  projectId: number;
}

/**
 * 更新工作流请求
 */
export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowTemplateLibraryItem {
  id: number;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  nodeCount: number;
  usageCount: number;
  updatedAt: string;
}

export interface WorkflowCanvasNodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data?: {
    label?: string;
    type?: string;
    config?: Record<string, any>;
    connectionDirection?: string;
    text?: string;
    color?: string;
  };
}

export interface WorkflowCanvasEdgeData {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowCanvasCommentCardData {
  id: string;
  position: { x: number; y: number };
  data?: {
    text?: string;
    color?: string;
  };
}

export interface WorkflowCanvasData {
  nodes?: WorkflowCanvasNodeData[];
  edges?: WorkflowCanvasEdgeData[];
  commentCards?: WorkflowCanvasCommentCardData[];
  templateId?: number;
}

