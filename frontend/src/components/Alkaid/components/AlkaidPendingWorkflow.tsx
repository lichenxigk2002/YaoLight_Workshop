import { useState } from 'react';
import { Button, Popover, Space, Badge, Tooltip } from 'antd';
import { UploadOutlined, BranchesOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { WorkflowExportData } from '../types';
import styles from './AlkaidPending.module.scss';

interface AlkaidPendingWorkflowProps {
  summary: { nodeCount: number; edgeCount: number };
  workflow?: WorkflowExportData | null;
  onApply: () => void;
  onDiscard: () => void;
  loading?: boolean;
}

const AlkaidPendingWorkflow = ({
  summary,
  onApply,
  onDiscard,
  loading = false,
}: AlkaidPendingWorkflowProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const handleDiscard = () => {
    setOpen(false);
    onDiscard();
  };
  const handleApply = () => {
    setOpen(false);
    onApply();
  };

  const content = (
    <div className={styles.popoverContent}>
      <div className={styles.popoverLabel}>
        {t('workflowEditor.alkaid.pendingWorkflow', '待确认工作流')}：
        {summary.nodeCount} {t('workflowEditor.nodes', '节点')}，
        {summary.edgeCount} {t('workflowEditor.edges', '边')}
      </div>
      <Space size={8} style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={handleDiscard} disabled={loading}>
          {t('workflowEditor.alkaid.discard', '放弃')}
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<UploadOutlined />}
          onClick={handleApply}
          loading={loading}
        >
          {t('workflowEditor.alkaid.applyToCanvas', '应用到画布')}
        </Button>
      </Space>
    </div>
  );

  return (
    <Tooltip title={`${t('workflowEditor.alkaid.pendingWorkflow', '待确认工作流')} · ${summary.nodeCount} ${t('workflowEditor.nodes', '节点')}`}>
      <Popover
        content={content}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement="topLeft"
      >
        <Badge dot offset={[-1, 2]} color="blue">
          <Button
            className={styles.triggerButton}
            icon={<BranchesOutlined />}
            aria-label={t('workflowEditor.alkaid.pendingWorkflow', '待确认工作流')}
          />
        </Badge>
      </Popover>
    </Tooltip>
  );
};

export default AlkaidPendingWorkflow;
