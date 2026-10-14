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

export type TaskMode = 'chat' | 'explain' | 'generate' | 'repair' | 'trial_debug';
export type InteractionMode = TaskMode | 'analyze' | 'act';

export type ToolStepStatus = 'pending' | 'running' | 'success' | 'error';
export type PlanStepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';
export type PlanStepSource = 'planned' | 'synthetic';

export interface AgentPlanStep {
  planStepId: string;
  userMessageId: number;
  userMessageContent?: string;
  phase: Phase;
  source?: PlanStepSource;
  title: string;
  reason: string;
  expectedOutput?: string;
  toolHints?: string[];
  status: PlanStepStatus;
  startedAt: string;
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}

export interface AgentToolStep {
  stepId: string;
  planStepId?: string;
  userMessageId: number;
  userMessageContent?: string;
  phase: Phase;
  toolName: string;
  toolInput?: Record<string, unknown>;
  status: ToolStepStatus;
  startedAt: string;
  finishedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}

export interface SSEPhaseChanged {
  phase: Phase;
  at: string;
}

export interface SSEInteractionMode {
  mode: InteractionMode;
  reason?: string;
  showProgress: boolean;
  at: string;
}

export interface SSEPlanCreated {
  steps: AgentPlanStep[];
}

export interface SSEPlanStepStarted {
  planStepId: string;
  userMessageId: number;
  userMessageContent?: string;
  phase: Phase;
  source?: PlanStepSource;
  title: string;
  reason: string;
  expectedOutput?: string;
  toolHints?: string[];
  status: PlanStepStatus;
  at: string;
}

export interface SSEPlanStepUpdated {
  planStepId: string;
  phase?: Phase;
  source?: PlanStepSource;
  title?: string;
  reason?: string;
  expectedOutput?: string;
  toolHints?: string[];
  status?: PlanStepStatus;
  resultSummary?: string;
  errorMessage?: string;
  at: string;
}

export interface SSEPlanStepFinished {
  planStepId: string;
  status: PlanStepStatus;
  resultSummary?: string;
  errorMessage?: string;
  at: string;
}

export interface SSEToolStepStarted {
  stepId: string;
  planStepId?: string;
  userMessageId: number;
  userMessageContent?: string;
  toolName: string;
  phase: Phase;
  at: string;
}

export interface SSEToolStepFinished {
  stepId: string;
  status: ToolStepStatus;
  resultSummary?: string;
  errorMessage?: string;
  at: string;
}

export interface SSEContent {
  delta: string;
}

export interface SSEPendingWorkflow {
  summary: { nodeCount: number; edgeCount: number };
}

export interface PendingPatchSummary {
  addedNodeIds?: string[];
  removedNodeIds?: string[];
  updatedNodeIds?: string[];
  edgesChanged?: boolean;
}

export interface SSEPendingPatch {
  patchCount: number;
  summary?: PendingPatchSummary;
}

export interface DebugReport {
  success: boolean;
  failedNodeId?: string;
  failedNodeLabel?: string;
  observations?: string[];
  summary?: string;
}

export interface ExplainReport {
  summary?: string;
  nodeCount?: number;
  edgeCount?: number;
  risks?: string[];
  suggestions?: string[];
  variableFlow?: string[];
}

export interface SSEDone {}

export interface SSEError {
  message: string;
}

export interface AlkaidProgressState {
  phase: Phase;
  planSteps: AgentPlanStep[];
  toolSteps: AgentToolStep[];
  assistantContent: string;
  pendingWorkflow: WorkflowExportData | null;
  pendingPatch: PatchItem[] | null;
  streaming: boolean;
  error: string | null;
}

export interface WorkflowExportData {
  version: string;
  exportedAt?: string;
  name?: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  commentCards?: unknown[];
}

export interface PatchItem {
  op: 'set' | 'add' | 'remove' | 'set_edges';
  nodeId?: string;
  path?: string;
  value?: unknown;
  node?: unknown;
}
