export interface WorkflowAPIEndpoint {
  id: number
  workflowId: number
  name: string
  slug: string
  description?: string
  status: string
  responseMode: 'wait' | 'async'
  resultMode: 'json' | 'artifact'
  waitTimeoutSeconds: number
  requestExample?: any
  responseExample?: any
  publishedAt?: string
  invokePath: string
  docsPath: string
}

export interface WorkflowAPIKeySummary {
  id: number
  name: string
  keyPrefix: string
  status: string
  expiresAt?: string
  lastUsedAt?: string
  createdAt: string
}

export interface CreatedWorkflowAPIKey {
  id: number
  name: string
  key: string
  keyPrefix: string
  expiresAt?: string
  createdAt: string
}

export interface WorkflowAPIInvocationItem {
  requestId: string
  status: string
  taskId?: number
  errorMessage?: string
  response?: any
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export interface WorkflowAPIInvocationPage {
  list: WorkflowAPIInvocationItem[]
  total: number
}

export interface WorkflowPublicDocs {
  name: string
  slug: string
  description?: string
  status: string
  responseMode: 'wait' | 'async'
  resultMode: 'json' | 'artifact'
  waitTimeoutSeconds: number
  auth: Record<string, string>
  endpoints: Record<string, string>
  requestExample: any
  responseExamples: Record<string, any>
  errors: Array<{ code: string; message: string }>
}
