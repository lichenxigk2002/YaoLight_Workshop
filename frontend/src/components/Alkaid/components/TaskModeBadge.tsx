import { MessageCircle, FileText, Wand2, Wrench, Bug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { InteractionMode } from '../types'
import styles from './TaskModeBadge.module.scss'

interface TaskModeBadgeProps {
  mode: InteractionMode | null
}

const modeIcon = (mode: InteractionMode) => {
  switch (mode) {
    case 'explain':
    case 'analyze':
      return <FileText size={12} />
    case 'generate':
    case 'act':
      return <Wand2 size={12} />
    case 'repair':
      return <Wrench size={12} />
    case 'trial_debug':
      return <Bug size={12} />
    default:
      return <MessageCircle size={12} />
  }
}

const TaskModeBadge = ({ mode }: TaskModeBadgeProps) => {
  const { t } = useTranslation()
  if (!mode) return null

  const labelMap: Record<InteractionMode, string> = {
    chat: t('workflowEditor.alkaid.modeChat', '问答'),
    explain: t('workflowEditor.alkaid.modeExplain', '解释'),
    generate: t('workflowEditor.alkaid.modeGenerate', '生成'),
    repair: t('workflowEditor.alkaid.modeRepair', '修复'),
    trial_debug: t('workflowEditor.alkaid.modeTrialDebug', '调试'),
    analyze: t('workflowEditor.alkaid.modeExplain', '解释'),
    act: t('workflowEditor.alkaid.modeGenerate', '生成'),
  }

  return (
    <span className={styles.badge}>
      {modeIcon(mode)}
      {labelMap[mode]}
    </span>
  )
}

export default TaskModeBadge
