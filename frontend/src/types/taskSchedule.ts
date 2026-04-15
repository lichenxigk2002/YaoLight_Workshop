export type TaskScheduleTriggerType = 'cron' | 'webhook';

export interface RetryPolicy {
  mode: 'none' | 'fixed' | 'exponential';
  maxRetries: number;
  delaySeconds: number;
  maxDelaySeconds: number;
}

export interface TaskSchedule {
  id: number;
  workflowId: number;
  workflowName?: string;
  projectId?: number;
  userId: number;
  name: string;
  description?: string;
  triggerType: TaskScheduleTriggerType;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  maxRuns?: number;
  runCount: number;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  lastErrorMessage?: string;
  lastTriggerRequestId?: string;
  webhookToken?: string;
  webhookUrl?: string;
  config?: Record<string, any>;
  notificationConfig?: Record<string, any>;
  retryPolicy?: RetryPolicy;
  inputTemplate?: any;
  createdAt: string;
  updatedAt: string;
}

export interface TaskScheduleRun {
  id: number;
  scheduleId: number;
  workflowId: number;
  userId: number;
  triggerType: string;
  triggerKey: string;
  requestId?: string;
  status: string;
  taskId?: number;
  attemptCount: number;
  errorMessage?: string;
  inputPayload?: any;
  metadata?: Record<string, any>;
  triggeredAt: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSchedulePage {
  list: TaskSchedule[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskScheduleRunPage {
  list: TaskScheduleRun[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskScheduleMutationResult {
  schedule: TaskSchedule;
  webhookSecret?: string;
}
