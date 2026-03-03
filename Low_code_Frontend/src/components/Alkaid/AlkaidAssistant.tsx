import React, { useState } from 'react'
import styles from './AlkaidAssistant.module.scss'
import AlkaidButton from './AlkaidButton'
import AlkaidPanel from './AlkaidPanel'
import type { PatchItem } from './types'

interface AlkaidAssistantProps {
  workflowId?: string;
  onWorkflowGenerated?: (workflow: any) => void;
  /** 当生成补丁并点击应用时触发，进入补丁预览模式。onConfirm 为确认应用后的回调（用于后端清理 pending） */
  onPatchGenerated?: (patchList: PatchItem[], onConfirm: () => Promise<void>) => void;
  hasExistingNodes?: boolean; // 是否已有工作流节点
  /** 是否使用 Agentic 流（进度 + 待确认工作流）；默认 true */
  useAgentic?: boolean;
  /** Agentic 流下「应用到画布」成功后调用，用于刷新画布（如重新拉取节点） */
  onWorkflowApplied?: () => void;
  /** 获取当前工作流数据（用于上下文注入） */
  getCurrentWorkflow?: () => Promise<any>;
}

const AlkaidAssistant: React.FC<AlkaidAssistantProps> = (props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className={styles.floatingButton}>
        <AlkaidButton onClick={() => setOpen((v) => !v)} />
      </div>

      {open && (
        <div className={styles.chatWindow}>
          <AlkaidPanel
            {...props}
            variant="floating"
            defaultView="chat"
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  )
}

export default AlkaidAssistant
