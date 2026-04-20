export interface AdminTaskListItem {
  id: number;
  workflow_id: number;
  workflow_name: string;
  user_id: number;
  username: string;
  user_no: number;
  name?: string | null;
  status: string;
  progress: number;
  priority: number;
  actual_duration?: number | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface AdminTaskListResponse {
  list: AdminTaskListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminTaskSummary {
  total: number;
  running: number;
  failed: number;
  completed_today: number;
  avg_duration_ms: number;
  failure_rate_24h: number;
}

export interface AdminTaskDetailTask {
  id: number;
  workflowId: number;
  userId: number;
  name?: string | null;
  status: string;
  priority: number;
  progress: number;
  inputData?: { Data?: unknown } | null;
  result?: { Data?: unknown } | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  retryCount: number;
  maxRetries: number;
  timeout?: number | null;
  estimatedDuration?: number | null;
  actualDuration?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTaskDetail {
  task: AdminTaskDetailTask;
  workflow: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    username: string;
    email: string;
    user_no: number;
  };
  node_execution_count: number;
  log_count: number;
  artifact_count: number;
}

export interface AdminTaskActionResponse {
  task_id: number;
  status: string;
  message: string;
}

export interface AdminTaskNodeExecution {
  id: number;
  taskId: number;
  nodeId: string;
  nodeType: string;
  status: string;
  hasInputData?: boolean;
  hasOutputData?: boolean;
  hasErrorStack?: boolean;
  hasResourceUsage?: boolean;
  inputData?: { Data?: unknown } | null;
  outputData?: { Data?: unknown } | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  executionTime?: number | null;
  retryCount: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface AdminTaskNodeExecutionResponse {
  executions: AdminTaskNodeExecution[];
  total: number;
}

export interface AdminTaskNodeExecutionDetailResponse {
  execution: AdminTaskNodeExecution;
}

export interface AdminTaskLog {
  id: number;
  taskId: number;
  nodeId?: string | null;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  metadata?: { Data?: unknown } | null;
  stackTrace?: string | null;
  createdAt: string;
}

export interface AdminTaskLogResponse {
  logs: AdminTaskLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminTaskArtifact {
  id: number;
  user_id: number;
  workflow_id?: number | null;
  task_id?: number | null;
  node_id: string;
  name: string;
  description?: string | null;
  kind: string;
  mime_type: string;
  size: number;
  storage: string;
  path: string;
  metadata?: unknown;
  created_at: string;
  download_url: string;
}

export interface AdminTaskArtifactListResponse {
  list: AdminTaskArtifact[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminTaskFailureCountItem {
  label: string;
  count: number;
}

export interface AdminTaskWorkflowFailureItem {
  workflow_id: number;
  workflow_name: string;
  count: number;
}

export interface AdminTaskFailureTrendPoint {
  day: string;
  count: number;
}

export interface AdminTaskFailureStats {
  total_failures: number;
  timeout_count: number;
  unique_workflows: number;
  unique_users: number;
  top_node_types: AdminTaskFailureCountItem[];
  top_workflows: AdminTaskWorkflowFailureItem[];
  top_errors: AdminTaskFailureCountItem[];
  daily_trend: AdminTaskFailureTrendPoint[];
}
