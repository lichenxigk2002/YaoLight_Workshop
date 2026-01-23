/**
 * 任务相关类型定义
 */

/**
 * 任务状态枚举
 */
export type TaskStatus =
  | 'pending'    // 等待中
  | 'queued'     // 队列中
  | 'running'    // 执行中
  | 'paused'     // 已暂停
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'cancelled'  // 已取消
  | 'timeout';   // 超时

/**
 * 节点执行状态枚举
 */
export type NodeExecutionStatus =
  | 'pending'    // 等待执行
  | 'running'    // 执行中
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'skipped'    // 跳过
  | 'timeout'    // 超时
  | 'cancelled'; // 已中止

/**
 * 日志级别枚举
 */
export type LogLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal';

/**
 * 任务信息
 */
export interface Task {
  id: number;
  workflowId: number;
  userId: number;
  scheduleId?: number;
  name?: string;
  status: TaskStatus;
  priority: number;           // 优先级 1-10
  progress: number;           // 进度 0-100
  inputData?: Record<string, any>;
  result?: Record<string, any>;
  errorMessage?: string;
  errorStack?: string;
  retryCount: number;
  maxRetries: number;
  retryConfig?: Record<string, any>;
  timeout?: number;           // 超时时间（毫秒）
  estimatedDuration?: number; // 预计耗时（毫秒）
  actualDuration?: number;    // 实际耗时（毫秒）
  resourceUsage?: Record<string, any>;
  executionContext?: Record<string, any>;
  tags: string[];
  metadata?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 任务节点执行记录
 */
export interface TaskNodeExecution {
  id: number;
  taskId: number;
  nodeId: string;
  nodeType: string;
  status: NodeExecutionStatus;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  errorMessage?: string;
  errorStack?: string;
  executionTime?: number;     // 执行时长（毫秒）
  retryCount: number;
  resourceUsage?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

/**
 * 任务日志
 */
export interface TaskLog {
  id: number;
  taskId: number;
  nodeId?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  createdAt: string;
}

/**
 * 任务列表响应
 */
export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 节点执行列表响应
 */
export interface TaskNodeExecutionListResponse {
  executions: TaskNodeExecution[];
  total: number;
}

/**
 * 任务日志列表响应
 */
export interface TaskLogListResponse {
  logs: TaskLog[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 正在运行的任务响应
 */
export interface RunningTasksResponse {
  tasks: Task[];
  hasTasks: boolean;
  count: number;
}

/**
 * 获取任务列表请求参数
 */
export interface GetTaskListParams {
  page?: number;
  limit?: number;
}

/**
 * 获取任务日志请求参数
 */
export interface GetTaskLogsParams {
  level?: LogLevel;
  page?: number;
  limit?: number;
}

