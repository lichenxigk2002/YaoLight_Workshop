import AlkaidPendingPatch from './AlkaidPendingPatch'
import AlkaidPendingWorkflow from './AlkaidPendingWorkflow'
import type { PendingPatchSummary } from '../types'
import styles from '../AlkaidAssistant.module.scss'

interface AlkaidPendingBarProps {
  visible: boolean
  pendingSummary: { nodeCount: number; edgeCount: number } | null
  pendingPatchCount: number | null
  pendingPatchSummary: PendingPatchSummary | null
  applyLoading: boolean
  applyPatchLoading: boolean
  onApplyWorkflow: () => void
  onDiscardWorkflow: () => void
  onApplyPatch: () => void
  onDiscardPatch: () => void
}

const AlkaidPendingBar = ({
  visible,
  pendingSummary,
  pendingPatchCount,
  pendingPatchSummary,
  applyLoading,
  applyPatchLoading,
  onApplyWorkflow,
  onDiscardWorkflow,
  onApplyPatch,
  onDiscardPatch,
}: AlkaidPendingBarProps) => {
  if (!visible || (!pendingSummary && !(pendingPatchCount != null && pendingPatchCount > 0))) {
    return null
  }

  return (
    <div className={styles.pendingBar}>
      {pendingSummary && (
        <AlkaidPendingWorkflow
          summary={pendingSummary}
          onApply={onApplyWorkflow}
          onDiscard={onDiscardWorkflow}
          loading={applyLoading}
        />
      )}
      {pendingPatchCount != null && pendingPatchCount > 0 && (
        <AlkaidPendingPatch
          patchCount={pendingPatchCount}
          summary={pendingPatchSummary}
          onApply={onApplyPatch}
          onDiscard={onDiscardPatch}
          loading={applyPatchLoading}
        />
      )}
    </div>
  )
}

export default AlkaidPendingBar
