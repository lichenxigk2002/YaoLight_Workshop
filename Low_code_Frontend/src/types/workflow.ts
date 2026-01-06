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
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
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

