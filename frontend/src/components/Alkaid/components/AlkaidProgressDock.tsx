import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ProcessLoader, { type ProcessStep } from '../ProcessLoader'
import AlkaidProgress from './AlkaidProgress'
import type { InteractionMode, Phase, AgentPlanStep, AgentToolStep } from '../types'
import styles from '../AlkaidAssistant.module.scss'

interface AlkaidProgressDockProps {
  useAgentic: boolean
  loading: boolean
  currentLoadingMessageId: string | null
  agenticMode: InteractionMode | null
  agenticPhase: Phase
  agenticPlanSteps: AgentPlanStep[]
  agenticToolSteps: AgentToolStep[]
  agenticPendingSummary: { nodeCount: number; edgeCount: number } | null
  agenticPendingPatchCount: number | null
  processSteps: ProcessStep[]
  progressDockCollapsed: boolean
  onToggleCollapsed: () => void
}

const ACT_LIKE_PHASES: Phase[] = ['generating', 'validating', 'repairing', 'running_trial', 'waiting_approval', 'summarizing', 'error']

const AlkaidProgressDock = ({
  useAgentic,
  loading,
  currentLoadingMessageId,
  agenticMode,
  agenticPhase,
  agenticPlanSteps,
  agenticToolSteps,
  agenticPendingSummary,
  agenticPendingPatchCount,
  processSteps,
  progressDockCollapsed,
  onToggleCollapsed,
}: AlkaidProgressDockProps) => {
  const { t } = useTranslation()

  const showAgenticProgress = useMemo(() => {
    const hasActLikePhase = ACT_LIKE_PHASES.includes(agenticPhase)
    const hasActLikePlanStep = agenticPlanSteps.some((step) => ACT_LIKE_PHASES.includes(step.phase))
    const hasActLikeToolStep = agenticToolSteps.some((step) => ACT_LIKE_PHASES.includes(step.phase))
    const hasPendingAgenticOutput = !!agenticPendingSummary || agenticPendingPatchCount != null

    return (
      useAgentic &&
      loading &&
      !!currentLoadingMessageId &&
      agenticMode === 'act' &&
      (hasActLikePhase || hasActLikePlanStep || hasActLikeToolStep || hasPendingAgenticOutput)
    )
  }, [
    agenticMode,
    agenticPendingPatchCount,
    agenticPendingSummary,
    agenticPhase,
    agenticPlanSteps,
    agenticToolSteps,
    currentLoadingMessageId,
    loading,
    useAgentic,
  ])

  const showLegacySteps = !useAgentic && loading && processSteps.length > 0

  if (!showAgenticProgress && !showLegacySteps) {
    return null
  }

  const agenticPhaseLabelMap: Record<Phase, string> = {
    idle: t('workflowEditor.alkaid.pending', '待处理'),
    planning: t('workflowEditor.alkaid.progressPlanning', '分析中'),
    generating: t('workflowEditor.alkaid.progressGenerating', '生成中'),
    validating: t('workflowEditor.alkaid.progressValidating', '校验中'),
    repairing: t('workflowEditor.alkaid.progressValidating', '修正中'),
    running_trial: t('workflowEditor.alkaid.progressValidating', '试运行'),
    summarizing: t('workflowEditor.alkaid.progressFinishing', '整理中'),
    waiting_approval: t('workflowEditor.alkaid.progressFinishing', '等待确认'),
    error: t('workflowEditor.alkaid.failed', '执行异常'),
  }

  const latestRunningPlanStep = [...agenticPlanSteps].reverse().find((step) => step.status === 'running')
  const latestErrorPlanStep = [...agenticPlanSteps].reverse().find((step) => step.status === 'error')
  const latestRunningToolStep = [...agenticToolSteps].reverse().find((step) => step.status === 'running')
  const latestErrorToolStep = [...agenticToolSteps].reverse().find((step) => step.status === 'error')
  const currentActivityPhase =
    latestErrorToolStep?.phase
    || latestRunningToolStep?.phase
    || latestErrorPlanStep?.phase
    || latestRunningPlanStep?.phase
    || agenticPhase

  const compactSummaryText = [
    agenticPhaseLabelMap[currentActivityPhase] || t('workflowEditor.alkaid.running', '处理中'),
    latestErrorPlanStep?.title
      || latestRunningPlanStep?.title
      || latestErrorToolStep?.toolName
      || latestRunningToolStep?.toolName
      || (agenticPendingPatchCount != null || agenticPendingSummary
        ? t('workflowEditor.alkaid.progressFinishing', '等待确认')
        : t('workflowEditor.alkaid.running', '处理中')),
  ].filter(Boolean).join(' · ')

  const legacySummaryText =
    processSteps.find((step) => step.status === 'loading')?.label || t('workflowEditor.alkaid.running', '处理中')

  return (
    <div className={[styles.progressDock, progressDockCollapsed ? styles.progressDockCollapsed : ''].join(' ')}>
      <div className={styles.progressDockHeader}>
        <div className={styles.progressDockMeta}>
          <div className={styles.progressDockTitle}>
            {showAgenticProgress ? '当前处理' : t('workflowEditor.alkaid.executionSteps', '执行过程')}
          </div>
          <div className={styles.progressDockSummary}>
            {showAgenticProgress ? compactSummaryText : legacySummaryText}
          </div>
        </div>
        <button
          type="button"
          className={styles.progressDockToggle}
          onClick={onToggleCollapsed}
        >
          {progressDockCollapsed ? '展开' : '收起'}
        </button>
      </div>

      {!progressDockCollapsed && showAgenticProgress && (
        <div className={styles.progressDockInner}>
          <AlkaidProgress phase={agenticPhase} planSteps={agenticPlanSteps} toolSteps={agenticToolSteps} maxSteps={10} compact />
        </div>
      )}
      {!progressDockCollapsed && showLegacySteps && (
        <div className={styles.progressDockInner}>
          <ProcessLoader steps={processSteps} visible />
        </div>
      )}
    </div>
  )
}

export default AlkaidProgressDock
