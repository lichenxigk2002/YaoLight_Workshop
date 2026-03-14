import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Button, Card, Empty, Input, List, Modal, Segmented, Space, Spin, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'
import { alkaidApi } from '@/api'
import { AlkaidIcon } from '@/components/Icons'
import { MarkdownRenderer } from '@/components/WorkflowEditor/utils/MarkdownRenderer'
import ProcessLoader, { ProcessStep } from './ProcessLoader'
import { AlkaidPendingPatch, AlkaidPendingWorkflow, AlkaidProgress } from './components'
import type { Phase, AgentPlanStep, AgentToolStep, PatchItem, PendingPatchSummary } from './types'
import { extractWorkflowJSON, hasWorkflowJSONBlock, parseWorkflowJSON, stripWorkflowJSONFromText } from './utils'
import { useAssistantUIStore } from '@/store/assistantUi'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LayoutGrid,
  MessageSquare,
  PanelLeft,
  PencilLine,
  Search,
  Settings,
  StopCircle,
  Trash2,
  User,
} from 'lucide-react'
import styles from './AlkaidAssistant.module.scss'

const { TextArea } = Input

interface MessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface SessionItem {
  id: number
  title: string
  createdAt: string
  updatedAt: string
}

function summarizePatchList(patchList: PatchItem[]): PendingPatchSummary {
  const addedNodeIds = new Set<string>()
  const removedNodeIds = new Set<string>()
  const updatedNodeIds = new Set<string>()
  let edgesChanged = false

  for (const patch of patchList || []) {
    if (patch.op === 'add' && patch.node && typeof patch.node === 'object') {
      const nodeId = (patch.node as { id?: string }).id
      if (nodeId) addedNodeIds.add(nodeId)
    } else if (patch.op === 'remove' && patch.nodeId) {
      removedNodeIds.add(patch.nodeId)
    } else if (patch.op === 'set' && patch.nodeId) {
      updatedNodeIds.add(patch.nodeId)
    } else if (patch.op === 'set_edges') {
      edgesChanged = true
    }
  }

  return {
    addedNodeIds: [...addedNodeIds],
    removedNodeIds: [...removedNodeIds],
    updatedNodeIds: [...updatedNodeIds],
    edgesChanged,
  }
}

function summarizePendingWorkflow(workflow: any): { nodeCount: number; edgeCount: number } | null {
  const pendingWorkflow = workflow?.data ?? workflow
  if (!pendingWorkflow || typeof pendingWorkflow !== 'object') return null

  const nodes = Array.isArray((pendingWorkflow as { nodes?: unknown[] }).nodes)
    ? (pendingWorkflow as { nodes: unknown[] }).nodes
    : []
  const edges = Array.isArray((pendingWorkflow as { edges?: unknown[] }).edges)
    ? (pendingWorkflow as { edges: unknown[] }).edges
    : []

  if (nodes.length === 0 && edges.length === 0) return null
  return { nodeCount: nodes.length, edgeCount: edges.length }
}

export type AlkaidPanelView = 'chat' | 'conversations' | 'settings'
export type AlkaidPanelVariant = 'floating' | 'page'

export interface AlkaidPanelProps {
  workflowId?: string
  onWorkflowGenerated?: (workflow: any) => void
  onPatchGenerated?: (patchList: PatchItem[], onConfirm: () => Promise<void>) => void
  hasExistingNodes?: boolean
  useAgentic?: boolean
  onWorkflowApplied?: () => void
  getCurrentWorkflow?: () => Promise<any>
  variant?: AlkaidPanelVariant
  defaultView?: AlkaidPanelView
  initialSessionId?: number | null
  onClose?: () => void
}

const formatSessionTime = (time: string) => {
    const d = new Date(time)
    // 根据当前语言环境格式化，这里暂时保持 zh-CN 以匹配原逻辑，实际应根据 i18n.language
    return d.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

export default function AlkaidPanel({
  workflowId,
  onWorkflowGenerated,
  onPatchGenerated,
  hasExistingNodes = false,
  useAgentic = true,
  onWorkflowApplied,
  getCurrentWorkflow,
  variant = 'floating',
  defaultView = 'chat',
  initialSessionId = null,
  onClose,
}: AlkaidPanelProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { density, accent, reduceMotion } = useAssistantUIStore()

  const getUserAvatar = () => {
    if (!user) return undefined
    if (user.avatar_url) {
      if (user.avatar_url.startsWith('http')) return user.avatar_url
      const baseURL = import.meta.env.VITE_BASE_URL || '/api'
      if (user.avatar_url.startsWith('uploads/') || user.avatar_url.startsWith('/uploads/')) {
        const cleanPath = user.avatar_url.startsWith('/') ? user.avatar_url.substring(1) : user.avatar_url
        return `${baseURL}/${cleanPath}`
      }
      return `${baseURL}/uploads/${user.avatar_url}`
    }
    return undefined
  }

  const [view, setView] = useState<AlkaidPanelView>(defaultView)
  const [sessionId, setSessionId] = useState<number | null>(initialSessionId)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [showSessionList, setShowSessionList] = useState(variant === 'page')

  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([])
  const [cancelStream, setCancelStream] = useState<(() => void) | null>(null)
  const [currentLoadingMessageId, setCurrentLoadingMessageId] = useState<string | null>(null)
  const needsWorkflowRef = useRef<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)
  const isSendingFirstMessage = useRef(false)
  const accumulatedContentRef = useRef('')
  const isSendingMessage = useRef(false)

  const [agenticPhase, setAgenticPhase] = useState<Phase>('idle')
  const [agenticPlanSteps, setAgenticPlanSteps] = useState<AgentPlanStep[]>([])
  const [agenticToolSteps, setAgenticToolSteps] = useState<AgentToolStep[]>([])
  const [agenticPendingSummary, setAgenticPendingSummary] = useState<{ nodeCount: number; edgeCount: number } | null>(null)
  const [agenticPendingPatchCount, setAgenticPendingPatchCount] = useState<number | null>(null)
  const [agenticPendingPatchSummary, setAgenticPendingPatchSummary] = useState<PendingPatchSummary | null>(null)
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyPatchLoading, setApplyPatchLoading] = useState(false)

  const [convQuery, setConvQuery] = useState('')
  const [convSelected, setConvSelected] = useState<Record<number, boolean>>({})
  const [convBulkMode, setConvBulkMode] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const extractPendingPatchList = (session: any): PatchItem[] => {
    const pendingPatch = session?.pendingPatch
    if (pendingPatch && Array.isArray(pendingPatch)) return pendingPatch
    if (pendingPatch && pendingPatch.data && Array.isArray(pendingPatch.data)) return pendingPatch.data
    return []
  }

  useEffect(() => {
    scrollToBottom()
    setTimeout(() => {
      inputRef.current?.focus()
    }, 120)
    loadSessions()
    return () => {
      if (cancelStream) cancelStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setView(defaultView)
  }, [defaultView])

  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId)
  }, [initialSessionId])

  useEffect(() => {
    if (isSendingMessage.current) return
    if (sessionId) {
      loadMessages(sessionId)
      setAgenticPlanSteps([])
      setAgenticPendingSummary(null)
      setAgenticPendingPatchCount(null)
      setAgenticPendingPatchSummary(null)
    } else {
      setMessages([])
      setAgenticPlanSteps([])
      setAgenticPendingSummary(null)
      setAgenticPendingPatchCount(null)
      setAgenticPendingPatchSummary(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, agenticPhase])

  const createSession = async () => {
    const session = await alkaidApi.createSession({
      title: '新对话',
      workflowId: workflowId ? parseInt(workflowId, 10) : undefined,
    })
    setSessionId(session.id)
    return session.id
  }

  const loadSessions = async () => {
    try {
      setLoadingSessions(true)
      const result = await alkaidApi.getSessions(1, 50)
      setSessions(result.list || [])
    } catch (e) {
      console.error('Load sessions error:', e)
    } finally {
      setLoadingSessions(false)
    }
  }

  const loadMessages = async (sid: number) => {
    try {
      const [response, session] = await Promise.all([
        alkaidApi.getMessages(sid),
        alkaidApi.getSession(sid),
      ])
      const msgs = response.messages || []
      const planSteps = response.planSteps || []
      const toolSteps = response.toolSteps || []
      const formatted: MessageItem[] = msgs.map((msg: any) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      }))
      setMessages(formatted)
      setAgenticPhase((session.currentPhase as Phase) || 'idle')
      setAgenticPlanSteps(planSteps)
      setAgenticToolSteps(toolSteps)
      setAgenticPendingSummary(summarizePendingWorkflow(session?.pendingWorkflow))
      const patchList = extractPendingPatchList(session)
      if (patchList.length > 0) {
        setAgenticPendingPatchCount(patchList.length)
        setAgenticPendingPatchSummary(summarizePatchList(patchList))
      } else {
        setAgenticPendingPatchCount(null)
        setAgenticPendingPatchSummary(null)
      }
    } catch (e) {
      console.error('Load messages error:', e)
    }
  }

  const handleSelectSession = async (sid: number) => {
    setSessionId(sid)
    if (variant === 'floating') setShowSessionList(false)
    await loadMessages(sid)
  }

  const handleDeleteSession = async (sid: number) => {
    Modal.confirm({
      title: t('common.deleteConfirm', '删除确认'),
      content: t('alkaid.deleteSessionConfirm', '此操作不可恢复，确定删除该会话吗？'),
      okText: t('common.delete', '删除'),
      cancelText: t('common.cancel', '取消'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await alkaidApi.deleteSession(sid)
        if (sessionId === sid) {
          setSessionId(null)
          setMessages([])
        }
        await loadSessions()
      },
    })
  }

  const handleRenameSession = async (sid: number, currentTitle: string) => {
    const input = document.createElement('input')
    input.value = currentTitle
    Modal.confirm({
      title: t('alkaid.renameSession', '重命名会话'),
      content: (
        <Input
          autoFocus
          defaultValue={currentTitle}
          onChange={(e) => {
            input.value = e.target.value
          }}
          onPressEnter={() => {
            const ok = (document.querySelector('.ant-modal-confirm .ant-btn-primary') as HTMLButtonElement | null)
            ok?.click()
          }}
        />
      ),
      okText: t('common.confirm', '确定'),
      cancelText: t('common.cancel', '取消'),
      onOk: async () => {
        const title = input.value.trim()
        if (!title) return
        await alkaidApi.updateSessionTitle(sid, title)
        await loadSessions()
      },
    })
  }

  const handleNewChat = () => {
    setSessionId(null)
    setMessages([])
    if (variant === 'floating') setShowSessionList(false)
    setAgenticPlanSteps([])
    setAgenticToolSteps([])
    setAgenticPendingSummary(null)
    setAgenticPendingPatchCount(null)
    setAgenticPendingPatchSummary(null)
  }

  const updateProcessStep = (stepId: string, status: 'loading' | 'completed') => {
    setProcessSteps((prev) => {
      const next = [...prev]
      const idx = next.findIndex((s) => s.id === stepId)
      if (idx === -1) return prev
      next[idx] = { ...next[idx], status }
      if (status === 'completed' && idx < next.length - 1) {
        next[idx + 1] = { ...next[idx + 1], status: 'loading' }
      }
      return next
    })
  }

  const handleStop = () => {
    if (!loading) return
    if (cancelStream) {
      cancelStream()
      setCancelStream(null)
    }
    setLoading(false)
    setCurrentLoadingMessageId(null)
    isSendingFirstMessage.current = false
    isSendingMessage.current = false
    accumulatedContentRef.current = ''
    if (useAgentic) {
      setAgenticPhase('idle')
      setAgenticPlanSteps([])
      setAgenticToolSteps([])
      setAgenticPendingSummary(null)
      setAgenticPendingPatchCount(null)
      setAgenticPendingPatchSummary(null)
    } else {
      setProcessSteps([])
      needsWorkflowRef.current = null
    }
  }

  const handleSend = async () => {
    if (!inputValue.trim()) return
    if (loading && useAgentic) {
      if (cancelStream) cancelStream()
      setCancelStream(null)
      setLoading(false)
      setCurrentLoadingMessageId(null)
      setAgenticPhase('idle')
      setAgenticPlanSteps([])
      setAgenticToolSteps([])
      setAgenticPendingSummary(null)
      setAgenticPendingPatchCount(null)
      setAgenticPendingPatchSummary(null)
    } else if (loading && !useAgentic) {
      return
    }

    isSendingMessage.current = true

    const now = Date.now()
    const userMessage: MessageItem = {
      id: `user-${now}-${Math.random().toString(36).slice(2, 11)}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    const messageContent = inputValue.trim()
    setInputValue('')
    setLoading(true)
    needsWorkflowRef.current = null
    setProcessSteps([])
    if (useAgentic) {
      setAgenticPlanSteps([])
      setAgenticToolSteps([])
      setAgenticPendingSummary(null)
      setAgenticPendingPatchCount(null)
      setAgenticPendingPatchSummary(null)
      setAgenticPhase('planning')
    }

    try {
      let currentSessionId = sessionId
      if (!currentSessionId) {
        isSendingFirstMessage.current = true
        currentSessionId = await createSession()
        await loadSessions()
      }

      const assistantMsgId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      setCurrentLoadingMessageId(assistantMsgId)
      accumulatedContentRef.current = ''
      setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() }])

      if (useAgentic) {
        let context: any = {}
        if (getCurrentWorkflow) {
          try {
            const workflowData = await getCurrentWorkflow()
            if (workflowData) context.currentWorkflow = workflowData
          } catch (e) {
            console.error('Failed to get current workflow context:', e)
          }
        }
        const cancel = alkaidApi.sessionStreamAgentic(
          currentSessionId,
          messageContent,
          {
            onContent: (delta) => {
              accumulatedContentRef.current += delta
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, role: 'assistant' as const, content: accumulatedContentRef.current }
                    : msg,
                ),
              )
            },
            onPhaseChanged: (phase) => setAgenticPhase(phase as Phase),
            onPlanCreated: (data: any) => {
              setAgenticPlanSteps(Array.isArray(data?.steps) ? data.steps : [])
            },
            onPlanStepStarted: (data: any) => {
              setAgenticPlanSteps((prev) => {
                const next = [...prev]
                const idx = next.findIndex((s) => s.planStepId === data.planStepId)
                const step: AgentPlanStep = {
                  planStepId: data.planStepId,
                  userMessageId: data.userMessageId ?? 0,
                  userMessageContent: data.userMessageContent,
                  phase: (data.phase as Phase) || 'planning',
                  title: data.title,
                  reason: data.reason,
                  expectedOutput: data.expectedOutput,
                  toolHints: data.toolHints,
                  status: data.status || 'running',
                  startedAt: data.at || new Date().toISOString(),
                  resultSummary: data.resultSummary,
                  errorMessage: data.errorMessage,
                }
                if (idx === -1) next.push(step)
                else next[idx] = { ...next[idx], ...step }
                return next
              })
            },
            onPlanStepUpdated: (data: any) => {
              setAgenticPlanSteps((prev) => {
                const idx = prev.findIndex((s) => s.planStepId === data.planStepId)
                if (idx === -1) {
                  return [
                    ...prev,
                    {
                      planStepId: data.planStepId,
                      userMessageId: data.userMessageId ?? 0,
                      userMessageContent: data.userMessageContent,
                      phase: (data.phase as Phase) || 'planning',
                      title: data.title || t('workflowEditor.alkaid.progressGenerating', '生成工作流'),
                      reason: data.reason || '',
                      expectedOutput: data.expectedOutput,
                      toolHints: data.toolHints,
                      status: data.status || 'running',
                      startedAt: data.at || new Date().toISOString(),
                      resultSummary: data.resultSummary,
                      errorMessage: data.errorMessage,
                    },
                  ]
                }

                const next = [...prev]
                next[idx] = {
                  ...next[idx],
                  phase: (data.phase as Phase) || next[idx].phase,
                  title: data.title || next[idx].title,
                  reason: data.reason || next[idx].reason,
                  expectedOutput: data.expectedOutput ?? next[idx].expectedOutput,
                  toolHints: data.toolHints ?? next[idx].toolHints,
                  status: data.status || next[idx].status,
                  resultSummary: data.resultSummary ?? next[idx].resultSummary,
                  errorMessage: data.errorMessage ?? next[idx].errorMessage,
                }
                return next
              })
            },
            onPlanStepFinished: (data: any) => {
              setAgenticPlanSteps((prev) =>
                prev.map((s) =>
                  s.planStepId === data.planStepId
                    ? {
                        ...s,
                        status: data.status || s.status,
                        finishedAt: data.at || new Date().toISOString(),
                        resultSummary: data.resultSummary,
                        errorMessage: data.errorMessage,
                      }
                    : s,
                ),
              )
            },
            onToolStepStarted: (data: any) => {
              setAgenticToolSteps((prev) => [
                ...prev,
                {
                  stepId: data.stepId,
                  planStepId: data.planStepId,
                  userMessageId: data.userMessageId ?? 0,
                  userMessageContent: data.userMessageContent,
                  phase: (data.phase as Phase) || 'planning',
                  toolName: data.toolName,
                  toolInput: {},
                  status: 'running',
                  startedAt: new Date().toISOString(),
                },
              ])
            },
            onToolStepFinished: (data: any) => {
              setAgenticToolSteps((prev) =>
                prev.map((s) =>
                  s.stepId === data.stepId
                    ? {
                        ...s,
                        status: data.status as AgentToolStep['status'],
                        finishedAt: new Date().toISOString(),
                        resultSummary: data.resultSummary,
                        errorMessage: data.errorMessage,
                      }
                    : s,
                ),
              )
            },
            onPendingWorkflow: (data: any) => setAgenticPendingSummary(data.summary ?? null),
            onPendingPatch: (data: any) => {
              setAgenticPendingPatchCount(data.patchCount ?? 0)
              setAgenticPendingPatchSummary(data.summary ?? null)
            },
            onDone: () => {
              setLoading(false)
              setCancelStream(null)
              setCurrentLoadingMessageId(null)
              isSendingFirstMessage.current = false
              isSendingMessage.current = false
              accumulatedContentRef.current = ''
              setAgenticPhase('idle')
            },
            onError: (errMsg) => {
              message.error((t('alkaid.sendMessageFailed') || '发送消息失败: ') + errMsg)
              setLoading(false)
              setCancelStream(null)
              setCurrentLoadingMessageId(null)
              isSendingFirstMessage.current = false
              isSendingMessage.current = false
              setAgenticPhase('idle')
            },
          },
          context,
        )
        setCancelStream(() => cancel)
        return
      }

      const cancel = alkaidApi.sendMessageStream(
        currentSessionId,
        messageContent,
        (content, step, done) => {
          if (step === 'understanding' && processSteps.length === 0) {
            setProcessSteps([
              { id: 'understanding', label: '正在努力理解您的需求呢~ ', status: 'loading' },
              { id: 'retrieving', label: '正在知识库里寻找答案呢 ', status: 'pending' },
              { id: 'generating', label: '正在为您精心编织工作流呢 ', status: 'pending' },
              { id: 'completed', label: '完成啦！快来看看吧~ ', status: 'pending' },
            ])
          }

          if (step === 'replying') {
            needsWorkflowRef.current = false
            setProcessSteps([
              { id: 'understanding', label: '正在努力理解您的需求呢~ ', status: 'completed' },
              { id: 'replying', label: '正在为您回复呢 ', status: 'loading' },
              { id: 'completed', label: '完成啦！快来看看吧~ ', status: 'pending' },
            ])
          }

          if (content) {
            accumulatedContentRef.current += content
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, role: 'assistant' as const, content: accumulatedContentRef.current }
                  : msg,
              ),
            )
          }

          if (step) {
            if (step === 'retrieving') {
              updateProcessStep('understanding', 'completed')
              needsWorkflowRef.current = true
            } else if (step === 'generating') {
              updateProcessStep('retrieving', 'completed')
            } else if (step === 'replying') {
              updateProcessStep('understanding', 'completed')
            } else if (step === 'completed') {
              if (needsWorkflowRef.current !== false) updateProcessStep('generating', 'completed')
              updateProcessStep('completed', 'completed')
            }
          }

          if (done) {
            setLoading(false)
            setCancelStream(null)
            setCurrentLoadingMessageId(null)
            isSendingFirstMessage.current = false
            isSendingMessage.current = false
            accumulatedContentRef.current = ''
            setTimeout(() => {
              setProcessSteps([])
              needsWorkflowRef.current = null
            }, 1200)
          }
        },
        (error) => {
          message.error((t('alkaid.sendMessageFailed') || '发送消息失败: ') + error)
          setLoading(false)
          setCancelStream(null)
          setCurrentLoadingMessageId(null)
          isSendingFirstMessage.current = false
          isSendingMessage.current = false
          setProcessSteps([])
        },
      )

      setCancelStream(() => cancel)
    } catch (error: any) {
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id))
      message.error((t('alkaid.sendMessageFailed') || '发送消息失败: ') + (error.message || '未知错误'))
      console.error('Send message error:', error)
      isSendingFirstMessage.current = false
      isSendingMessage.current = false
      setLoading(false)
      setCurrentLoadingMessageId(null)
      setProcessSteps([])
    }
  }

  const parseMessageContent = (content: string, isGenerating: boolean) => {
    const hasJSONBlock = hasWorkflowJSONBlock(content)
    const workflowJSON = hasJSONBlock ? extractWorkflowJSON(content) : null
    const textWithoutJson = hasJSONBlock ? stripWorkflowJSONFromText(content) : content
    if (hasJSONBlock || isGenerating) {
      return {
        hasWorkflow: true,
        text: textWithoutJson,
        workflowJSON: workflowJSON || null,
        isGenerating: isGenerating && !workflowJSON,
      }
    }
    return { hasWorkflow: false, text: content, workflowJSON: null, isGenerating: false }
  }

  const handleImportWorkflow = (workflowJSON: string) => {
    const workflow = parseWorkflowJSON(workflowJSON)
    if (!workflow) {
      message.error(t('alkaid.importFailed') || '导入失败：工作流格式无效')
      return
    }

    const doImport = () => {
      if (onWorkflowGenerated) {
        onWorkflowGenerated(workflow)
        message.success(t('alkaid.workflowImported') || '工作流已导入')
      }
    }

    if (hasExistingNodes) {
      Modal.confirm({
        title: t('alkaid.confirmReplaceTitle', '确认替换当前工作流？') || '确认替换当前工作流？',
        content:
          t('alkaid.confirmReplaceContent', '当前画布已有节点，导入将进入预览模式，确认后将覆盖现有内容。是否继续？') ||
          '当前画布已有节点，导入将进入预览模式，确认后将覆盖现有内容。是否继续？',
        okText: t('common.confirm', '确认') || '确认',
        cancelText: t('common.cancel', '取消') || '取消',
        onOk: doImport,
      })
      return
    }

    doImport()
  }

  const handleDownloadWorkflow = (workflowJSON: string) => {
    try {
      const workflow = parseWorkflowJSON(workflowJSON)
      if (!workflow) {
        message.error(t('alkaid.downloadFailed') || '下载失败：工作流格式无效')
        return
      }
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        nodes: workflow.nodes || [],
        edges: workflow.edges || [],
      }
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `workflow_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      message.success(t('alkaid.workflowDownloaded') || '工作流已下载')
    } catch (e: any) {
      message.error((t('alkaid.downloadFailed') || '下载失败: ') + (e.message || '未知错误'))
    }
  }

  const handleApplyWorkflow = async () => {
    if (!sessionId || applyLoading) return
    setApplyLoading(true)
    try {
      let previewHandled = false
      if (onWorkflowGenerated) {
        const session = await alkaidApi.getSession(sessionId)
        const pendingWorkflow = (session as any).pendingWorkflow
        if (pendingWorkflow && typeof pendingWorkflow === 'object') {
          onWorkflowGenerated(pendingWorkflow)
          message.success(t('alkaid.workflowImported') || '工作流已载入预览，请在画布中确认是否保存')
          setAgenticPendingSummary(null)
          previewHandled = true
        }
      }
      if (!previewHandled) {
        await alkaidApi.applyWorkflow(sessionId, workflowId ? parseInt(workflowId, 10) : undefined)
        message.success(t('alkaid.workflowImported') || '工作流已应用到画布')
        setAgenticPendingSummary(null)
        onWorkflowApplied?.()
      }
    } catch (e: any) {
      message.error(e?.message || t('alkaid.importFailed') || '应用失败')
    } finally {
      setApplyLoading(false)
    }
  }

  const handleApplyPatch = async () => {
    if (!sessionId || applyPatchLoading) return
    setApplyPatchLoading(true)
    try {
      let previewHandled = false
      if (onPatchGenerated) {
        const session = await alkaidApi.getSession(sessionId)
        const pendingPatch = (session as any).pendingPatch
        let patchList: PatchItem[] = []
        if (pendingPatch && Array.isArray(pendingPatch)) patchList = pendingPatch
        else if (pendingPatch && pendingPatch.data && Array.isArray(pendingPatch.data)) patchList = pendingPatch.data
        if (patchList.length > 0) {
          onPatchGenerated(patchList, async () => {
            try {
              await alkaidApi.discardPending(sessionId, 'patch')
              setAgenticPendingPatchCount(null)
              setAgenticPendingPatchSummary(null)
            } catch (err) {
              console.error('Failed to discard pending patch:', err)
            }
          })
          message.success(t('alkaid.patchPreview', '已进入补丁预览模式') || '已进入补丁预览模式')
          setAgenticPendingPatchCount(null)
          setAgenticPendingPatchSummary(null)
          previewHandled = true
        }
      }
      if (!previewHandled) {
        await alkaidApi.applyPatch(sessionId, workflowId ? parseInt(workflowId, 10) : undefined)
        message.success(t('alkaid.patchApplied', '补丁已应用') || '补丁已应用')
        setAgenticPendingPatchCount(null)
        setAgenticPendingPatchSummary(null)
        onWorkflowApplied?.()
      }
    } catch (e: any) {
      message.error(e?.message || t('alkaid.importFailed') || '应用失败')
    } finally {
      setApplyPatchLoading(false)
    }
  }

  const filteredSessions = useMemo(() => {
    const q = convQuery.trim().toLowerCase()
    const list = sessions
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    if (!q) return list
    return list.filter((s) => s.title.toLowerCase().includes(q))
  }, [convQuery, sessions])

  const convSelectedCount = useMemo(() => {
    return Object.entries(convSelected).reduce((acc, [, checked]) => (checked ? acc + 1 : acc), 0)
  }, [convSelected])

  const handleBulkDelete = async () => {
    const ids = Object.entries(convSelected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k))
    if (ids.length === 0) return
    Modal.confirm({
      title: t('common.deleteConfirm', '删除确认'),
      content: t('alkaid.bulkDeleteConfirm', { count: ids.length, defaultValue: `将删除 ${ids.length} 个会话，此操作不可恢复。是否继续？` }),
      okText: t('common.delete', '删除'),
      cancelText: t('common.cancel', '取消'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await Promise.all(ids.map((id) => alkaidApi.deleteSession(id)))
        setConvSelected({})
        setConvBulkMode(false)
        await loadSessions()
        if (sessionId && ids.includes(sessionId)) {
          setSessionId(null)
          setMessages([])
        }
      },
    })
  }

  const rootClassName = useMemo(() => {
    return [
      styles.alkaidPanel,
      variant === 'page' ? styles.page : styles.floating,
      density === 'compact' ? styles.compact : styles.comfortable,
      accent ? styles.accentOn : styles.accentOff,
      reduceMotion ? styles.reduceMotion : '',
    ]
      .filter(Boolean)
      .join(' ')
  }, [variant, density, accent, reduceMotion])

  const renderTopRight = () => (
    <Space size={6} className={styles.topRight}>
      {variant === 'floating' && (
        <Button
          type={view === 'chat' && showSessionList ? 'text' : 'text'}
          style={view === 'chat' && showSessionList ? { color: 'var(--alkaid-accent-0)' } : {}}
          size="small"
          className={styles.iconBtn}
          icon={<PanelLeft size={16} />}
          onClick={() => {
            if (view !== 'chat') {
              setView('chat')
              setShowSessionList(true)
            } else {
              setShowSessionList((v) => !v)
            }
          }}
          title={t('alkaid.sessionHistory', '会话历史')}
        />
      )}
      <Button
        type={view === 'chat' && !showSessionList ? 'text' : 'text'}
        style={view === 'chat' && !showSessionList ? { color: 'var(--alkaid-accent-0)' } : {}}
        size="small"
        className={styles.iconBtn}
        icon={<MessageSquare size={16} />}
        onClick={() => {
          setView('chat')
          setShowSessionList(false)
        }}
        title={t('alkaid.chat', '对话')}
      />
      <Button
        type={view === 'conversations' ? 'text' : 'text'}
        style={view === 'conversations' ? { color: 'var(--alkaid-accent-0)' } : {}}
        size="small"
        className={styles.iconBtn}
        icon={<LayoutGrid size={16} />}
        onClick={() => {
          setView('conversations')
          setShowSessionList(false)
        }}
        title={t('alkaid.conversations', '会话管理')}
      />
      <Button
        type={view === 'settings' ? 'text' : 'text'}
        style={view === 'settings' ? { color: 'var(--alkaid-accent-0)' } : {}}
        size="small"
        className={styles.iconBtn}
        icon={<Settings size={16} />}
        onClick={() => {
          setView('settings')
          setShowSessionList(false)
        }}
        title={t('alkaid.settings', '设置')}
      />
      {variant === 'floating' && (
        <Button
          type="text"
          size="small"
          className={styles.iconBtn}
          icon={<ChevronLeft size={18} />}
          onClick={onClose}
          title={t('common.close', '关闭')}
        />
      )}
    </Space>
  )

  const renderSidebar = () => (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>{t('alkaid.conversations', '会话')}</div>
        <Button type="text" size="small" className={styles.newBtn} onClick={handleNewChat}>
          {t('alkaid.newChat', '新建')}
        </Button>
      </div>
      <div className={styles.sidebarSearch}>
        <Input
          value={convQuery}
          onChange={(e) => setConvQuery(e.target.value)}
          allowClear
          placeholder={t('common.search', '搜索')}
          prefix={<Search size={14} />}
          size="middle"
        />
      </div>
      <div className={styles.sidebarBody}>
        {loadingSessions ? (
          <div className={styles.centerPad}>
            <Spin size="small" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <Empty
            description={t('alkaid.noSessions', '暂无会话')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 24 }}
          />
        ) : (
          <List
            dataSource={filteredSessions}
            renderItem={(session) => {
              const active = sessionId === session.id
              const checked = !!convSelected[session.id]
              return (
                <List.Item
                  key={session.id}
                  className={[styles.sessionRow, active ? styles.active : ''].filter(Boolean).join(' ')}
                  onClick={() => {
                    if (convBulkMode) {
                      setConvSelected((prev) => ({ ...prev, [session.id]: !checked }))
                      return
                    }
                    handleSelectSession(session.id)
                  }}
                >
                  <div className={styles.sessionRowLeft}>
                    {convBulkMode && (
                      <span className={styles.checkbox} data-checked={checked ? 'true' : 'false'}>
                        {checked ? <Check size={14} /> : null}
                      </span>
                    )}
                    <div className={styles.sessionMeta}>
                      <div className={styles.sessionTitle} title={session.title}>
                        {session.title}
                      </div>
                      <div className={styles.sessionTime}>{formatSessionTime(session.updatedAt)}</div>
                    </div>
                  </div>
                  {!convBulkMode && (
                    <div className={styles.sessionRowRight}>
                      <button
                        type="button"
                        className={styles.rowIcon}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRenameSession(session.id, session.title)
                        }}
                        aria-label="rename"
                      >
                        <PencilLine size={16} />
                      </button>
                      <button
                        type="button"
                        className={styles.rowIconDanger}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(session.id)
                        }}
                        aria-label="delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </List.Item>
              )
            }}
          />
        )}
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.bulkRow}>
          <Button
            size="small"
            type={convBulkMode ? 'primary' : 'default'}
            className={styles.bulkBtn}
            onClick={() => {
              setConvBulkMode((v) => !v)
              setConvSelected({})
            }}
          >
            {t('alkaid.bulk', '批量')}
          </Button>
          <Button
            size="small"
            danger
            className={styles.bulkBtn}
            disabled={!convBulkMode || convSelectedCount === 0}
            onClick={handleBulkDelete}
          >
            {t('alkaid.deleteCount', { count: convSelectedCount, defaultValue: `删除(${convSelectedCount})` })}
          </Button>
        </div>
      </div>
    </div>
  )

  const renderEmptyChat = () => (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <AlkaidIcon size={40} />
      </div>
      <div className={styles.emptyTitle}>{t('alkaid.hello', '你好，我是瑶光星')}</div>
      <div className={styles.emptyDesc}>{t('alkaid.helloDesc', '告诉我你想要的工作流或问题，我会一步步帮你完成。')}</div>
      <div className={styles.emptyChips}>
        <button type="button" className={styles.chip} onClick={() => setInputValue(t('alkaid.prompt1', '帮我生成一个抓取网页并总结的工作流'))}>{t('alkaid.prompt1Label', '抓取网页并总结')}</button>
        <button type="button" className={styles.chip} onClick={() => setInputValue(t('alkaid.prompt2', '帮我把工作流节点做一次结构化优化'))}>{t('alkaid.prompt2Label', '结构化优化')}</button>
        <button type="button" className={styles.chip} onClick={() => setInputValue(t('alkaid.prompt3', '如何排查工作流执行失败？'))}>{t('alkaid.prompt3Label', '排查执行失败')}</button>
      </div>
    </div>
  )

  const renderMessageBubble = (msg: MessageItem) => {
    const isCurrentLoadingMessage = msg.role === 'assistant' && msg.id === currentLoadingMessageId && loading
    const showAgenticProgress = useAgentic && isCurrentLoadingMessage
    const showLegacySteps = !useAgentic && isCurrentLoadingMessage && processSteps.length > 0

    const isAgenticGeneratingPhase =
      useAgentic &&
      ['generating', 'validating', 'repairing', 'running_trial', 'waiting_approval', 'summarizing'].includes(agenticPhase)
    const shouldShowGeneratingPlaceholder =
      isCurrentLoadingMessage && loading && (isAgenticGeneratingPhase || (!useAgentic && needsWorkflowRef.current === true))

    const parsed = parseMessageContent(msg.content, shouldShowGeneratingPlaceholder)
    const canCopy = !!parsed.text

    return (
      <div key={msg.id} className={[styles.messageRow, styles[msg.role]].join(' ')}>
        {msg.role === 'assistant' ? (
          <div className={styles.assistantMark}>
            <AlkaidIcon size={18} />
          </div>
        ) : (
          <div />
        )}
        <div className={styles.bubbleWrap}>
          <div className={styles.bubble}>
            {showAgenticProgress && (
              <div className={styles.progressArea}>
                <AlkaidProgress phase={agenticPhase} planSteps={agenticPlanSteps} toolSteps={agenticToolSteps} maxSteps={10} />
              </div>
            )}
            {showLegacySteps && (
              <div className={styles.progressArea}>
                <ProcessLoader steps={processSteps} visible={true} />
              </div>
            )}

            {parsed.text && (
              <div className={styles.markdownContent}>
                <MarkdownRenderer content={parsed.text} className={styles.alkaidMarkdown} />
              </div>
            )}

            {parsed.hasWorkflow && (
              <div className={styles.workflowCard}>
                <div className={styles.workflowLeft}>
                  <div className={styles.workflowBadge} />
                  <div className={styles.workflowMeta}>
                    <div className={styles.workflowTitle}>{t('alkaid.workflowFile', '工作流文件')}</div>
                    <div className={styles.workflowSub}>
                      {parsed.isGenerating ? (
                        <span className={styles.workflowState}>{t('alkaid.generating', '生成中')}</span>
                      ) : (
                        <span className={styles.workflowStateOk}>{t('alkaid.generated', '已生成')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={styles.workflowActions}>
                  {parsed.isGenerating ? (
                    <Spin size="small" />
                  ) : parsed.workflowJSON ? (
                    <>
                      <Button size="small" type="primary" onClick={() => handleImportWorkflow(parsed.workflowJSON!)}>{t('common.import', '导入')}</Button>
                      <Button size="small" onClick={() => handleDownloadWorkflow(parsed.workflowJSON!)}>{t('common.download', '下载')}</Button>
                    </>
                  ) : (
                    <Spin size="small" />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={styles.bubbleTools}>
            {canCopy && (
              <button
                type="button"
                className={styles.toolBtn}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(parsed.text)
                    message.success(t('alkaid.copySuccess', '已复制'))
                  } catch (_) {
                    message.error(t('alkaid.copyFailed', '复制失败'))
                  }
                }}
                aria-label="copy"
              >
                <Copy size={15} />
              </button>
            )}
          </div>
        </div>

        {msg.role === 'user' ? (
          <div className={styles.userAvatarWrap}>
            <Avatar src={getUserAvatar()} icon={<User size={16} />} size={28} />
          </div>
        ) : (
          <div />
        )}
      </div>
    )
  }

  const renderChatView = () => (
    <div className={styles.chatMain}>
      <div className={styles.messages}>
        {messages.length === 0 ? renderEmptyChat() : messages.map((m) => renderMessageBubble(m))}
        <div ref={messagesEndRef} />
      </div>

      {useAgentic && (agenticPendingSummary || agenticPendingPatchCount != null) && (
        <div className={styles.pendingBar}>
          {agenticPendingSummary && (
            <AlkaidPendingWorkflow
              summary={agenticPendingSummary}
              onApply={handleApplyWorkflow}
              onDiscard={() => setAgenticPendingSummary(null)}
              loading={applyLoading}
            />
          )}
          {agenticPendingPatchCount != null && agenticPendingPatchCount > 0 && (
            <AlkaidPendingPatch
              patchCount={agenticPendingPatchCount}
              summary={agenticPendingPatchSummary}
              onApply={handleApplyPatch}
              onDiscard={() => {
                setAgenticPendingPatchCount(null)
                setAgenticPendingPatchSummary(null)
              }}
              loading={applyPatchLoading}
            />
          )}
        </div>
      )}

      <div className={styles.composer}>
        <div className={styles.composerInner}>
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={t('alkaid.inputPlaceholder', '输入你的需求...')}
            autoSize={{ minRows: 1, maxRows: 8 }}
            disabled={loading}
            className={styles.input}
          />
          <div className={styles.composerRight}>
            <button
              className={styles.sendBtn}
              onClick={loading ? handleStop : handleSend}
              disabled={!loading && !inputValue.trim()}
              type="button"
              aria-label={loading ? t('alkaid.stop', '中止') : t('alkaid.send', '发送')}
            >
              {loading ? <StopCircle size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>
        <div className={styles.composerHint}>
          <span>{t('alkaid.enterSend', 'Enter 发送')}</span>
          <span>{t('alkaid.shiftEnterLine', 'Shift+Enter 换行')}</span>
          {loading ? (
            <button type="button" className={styles.linkBtn} onClick={handleStop}>
              {t('alkaid.stopGenerating', '停止生成')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderConversationsView = () => (
    <div className={styles.convMain}>
      <div className={styles.convTop}>
        <div className={styles.convTitle}>会话管理</div>
        <div className={styles.convActions}>
          <Segmented
            size="small"
            value={convBulkMode ? 'bulk' : 'single'}
            onChange={(v) => {
              const next = v === 'bulk'
              setConvBulkMode(next)
              setConvSelected({})
            }}
            options={[
              { label: '单选', value: 'single' },
              { label: '批量', value: 'bulk' },
            ]}
          />
          <Button size="small" onClick={handleNewChat}>新建对话</Button>
          <Button size="small" danger disabled={!convBulkMode || convSelectedCount === 0} onClick={handleBulkDelete}>
            删除({convSelectedCount})
          </Button>
        </div>
      </div>

      <div className={styles.convFilter}>
        <Input
          value={convQuery}
          onChange={(e) => setConvQuery(e.target.value)}
          allowClear
          placeholder="搜索会话标题"
          prefix={<Search size={14} />}
        />
      </div>

      <div className={styles.convList}>
        {loadingSessions ? (
          <div className={styles.centerPad}>
            <Spin />
          </div>
        ) : filteredSessions.length === 0 ? (
          <Empty description="暂无会话" />
        ) : (
          <div className={styles.convGrid}>
            {filteredSessions.map((s) => {
              const checked = !!convSelected[s.id]
              return (
                <div
                  key={s.id}
                  className={styles.convCard}
                  onClick={() => {
                    if (convBulkMode) {
                      setConvSelected((prev) => ({ ...prev, [s.id]: !checked }))
                      return
                    }
                    setView('chat')
                    handleSelectSession(s.id)
                  }}
                >
                  <div className={styles.convCardTop}>
                    <div className={styles.convCardTitle}>{s.title}</div>
                    {convBulkMode ? (
                      <span className={styles.checkbox} data-checked={checked ? 'true' : 'false'}>
                        {checked ? <Check size={14} /> : null}
                      </span>
                    ) : (
                      <div className={styles.convCardBtns}>
                        <button
                          type="button"
                          className={styles.rowIcon}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRenameSession(s.id, s.title)
                          }}
                          aria-label="rename"
                        >
                          <PencilLine size={16} />
                        </button>
                        <button
                          type="button"
                          className={styles.rowIconDanger}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSession(s.id)
                          }}
                          aria-label="delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.convCardBottom}>
                    <span className={styles.convTime}>{formatSessionTime(s.updatedAt)}</span>
                    <span className={styles.convHint}>点击打开</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const renderSettingsView = () => (
    <div className={styles.settingsMain}>
      <div className={styles.settingsTitle}>{t('alkaid.appearance', '外观与交互')}</div>
      <div className={styles.settingsGrid}>
        <div className={styles.settingCard}>
          <div className={styles.settingLabel}>{t('alkaid.density', '信息密度')}</div>
          <div className={styles.settingDesc}>{t('alkaid.densityDesc', '控制会话列表行高、消息间距与输入区紧凑度。')}</div>
          <Segmented
            value={density}
            onChange={(v) => useAssistantUIStore.getState().setDensity(v as any)}
            options={[
              { label: t('alkaid.densityComfortable', '舒适'), value: 'comfortable' },
              { label: t('alkaid.densityCompact', '紧凑'), value: 'compact' },
            ]}
          />
        </div>
        <div className={styles.settingCard}>
          <div className={styles.settingLabel}>{t('alkaid.accent', '强调色')}</div>
          <div className={styles.settingDesc}>{t('alkaid.accentDesc', '仅用于少量关键交互点缀（边框、焦点、徽标）。')}</div>
          <Segmented
            value={accent ? 'on' : 'off'}
            onChange={(v) => useAssistantUIStore.getState().setAccent(v === 'on')}
            options={[
              { label: t('alkaid.accentOn', '开启'), value: 'on' },
              { label: t('alkaid.accentOff', '关闭'), value: 'off' },
            ]}
          />
        </div>
        <div className={styles.settingCard}>
          <div className={styles.settingLabel}>{t('alkaid.reduceMotion', '减少动效')}</div>
          <div className={styles.settingDesc}>{t('alkaid.reduceMotionDesc', '关闭平滑滚动与过渡位移，仅保留必要渐变。')}</div>
          <Segmented
            value={reduceMotion ? 'on' : 'off'}
            onChange={(v) => useAssistantUIStore.getState().setReduceMotion(v === 'on')}
            options={[
              { label: t('alkaid.accentOn', '开启'), value: 'on' },
              { label: t('alkaid.accentOff', '关闭'), value: 'off' },
            ]}
          />
        </div>
      </div>

      <div className={styles.settingsFooter}>
        <Button
          danger
          onClick={() => {
            useAssistantUIStore.getState().reset()
            message.success(t('alkaid.restored', '已恢复默认'))
          }}
        >
          {t('alkaid.restoreDefault', '恢复默认')}
        </Button>
      </div>
    </div>
  )

  const renderBody = () => {
    if (view === 'conversations') return renderConversationsView()
    if (view === 'settings') return renderSettingsView()
    return renderChatView()
  }

  const title = (
    <div className={styles.topBar}>
      <div className={styles.topLeft}>
        {variant === 'page' && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              if (view !== 'chat') {
                setView('chat')
                setShowSessionList(true)
              } else {
                setShowSessionList((v) => !v)
              }
            }}
            aria-label="toggle-sidebar"
          >
            {showSessionList ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        )}
        <span className={styles.brandMark}>
          <AlkaidIcon size={18} />
        </span>
        <span className={styles.brandText}>{t('alkaid.title') || '瑶光星AI助手'}</span>
        <span className={styles.topDivider} />
        <span className={styles.viewLabel}>
          {view === 'chat'
            ? t('alkaid.chatWorkbench', '对话工作台')
            : view === 'conversations'
            ? t('alkaid.conversations', '会话管理')
            : t('alkaid.settings', '设置')}
        </span>
      </div>
      {renderTopRight()}
    </div>
  )

  const panelBody = (
    <div className={[styles.shell, !showSessionList ? styles.shellNoSidebar : ''].filter(Boolean).join(' ')}>
      {showSessionList && renderSidebar()}
      <div className={styles.main}>
        <div className={styles.mainInner}>
          {renderBody()}
        </div>
      </div>
    </div>
  )


  const main = (
    <div className={rootClassName}>
      {variant === 'page' && <div className={styles.pageHeader}>{title}</div>}
      <div className={styles.shellBody}>{panelBody}</div>
      {variant === 'floating' && showSessionList && <div className={styles.overlay} onClick={() => setShowSessionList(false)} />}
    </div>
  )

  if (variant === 'page') return main

  return (
    <Card className={styles.chatCard} title={title} extra={null} bodyStyle={{ padding: 0 }}>
      {main}
    </Card>
  )
}
