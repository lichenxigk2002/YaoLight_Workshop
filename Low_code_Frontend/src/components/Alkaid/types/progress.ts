/**
 * 瑶光星 Agentic 进度与事件类型（与后端、SSE 协议一致）
 * 见 ALKaid-Implementation-TaskList-And-Tech.md 第 1.1 节
 */

/** Agent 执行阶段 */
export type Phase =
  | 'idle'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'repairing'
  | 'running_trial'
  | 'summarizing'
  | 'waiting_approval'
  | 'error';

/** 工具步状态 */
export type ToolStepStatus = 'pending' | 'running' | 'success' | 'error';

/** 单次工具调用的进度记录 */
export interface AgentToolStep {
  stepId: string;
  userMessageId: number;           // 所属的用户消息ID（用于分组显示）
  userMessageContent?: string;     // 用户消息内容（用于展示标题）
  phase: Phase;
  toolName: string;
  toolInput?: Record<string, unknown>;
  status: ToolStepStatus;
  startedAt: string; // ISO8601
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}

/** SSE 事件：phase_changed */
export interface SSEPhaseChanged {
  phase: Phase;
  at: string;
}

/** SSE 事件：tool_step_started */
export interface SSEToolStepStarted {
  stepId: string;
  userMessageId: number;
  userMessageContent?: string;
  toolName: string;
  phase: Phase;
  at: string;
}

/** SSE 事件：tool_step_finished */
export interface SSEToolStepFinished {
  stepId: string;
  status: ToolStepStatus;
  resultSummary?: string;
  errorMessage?: string;
  at: string;
}

/** SSE 事件：content（assistant 流式文本） */
export interface SSEContent {
  delta: string;
}

/** SSE 事件：pending_workflow */
export interface SSEPendingWorkflow {
  summary: { nodeCount: number; edgeCount: number };
}

/** SSE 事件：pending_patch */
export interface SSEPendingPatch {
  patchCount: number;
}

/** SSE 事件：done */
export interface SSEDone { }

/** SSE 事件：error */
export interface SSEError {
  message: string;
}

/** 前端进度状态（与文档 5.1 建议一致） */
export interface AlkaidProgressState {
  phase: Phase;
  toolSteps: AgentToolStep[];
  assistantContent: string;
  pendingWorkflow: WorkflowExportData | null;
  pendingPatch: PatchItem[] | null;
  streaming: boolean;
  error: string | null;
}

/** 工作流导出结构（与现有导入/导出一致，仅类型引用） */
export interface WorkflowExportData {
  version: string;
  exportedAt?: string;
  name?: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  commentCards?: unknown[];
}

/** 补丁项（propose_patch 用） */
export interface PatchItem {
  op: 'set' | 'add' | 'remove' | 'set_edges';
  nodeId?: string;
  path?: string;
  value?: unknown;
  node?: unknown;
}
