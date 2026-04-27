import { useState } from 'react';
import { Button, Popover, Space, Badge, Tooltip } from 'antd';
import { EyeOutlined, DiffOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { PendingPatchSummary } from '../types';
import styles from './AlkaidPending.module.scss';

interface AlkaidPendingPatchProps {
  patchCount: number;
  summary?: PendingPatchSummary | null;
  onApply: () => void;
  onDiscard: () => void;
  loading?: boolean;
}

const AlkaidPendingPatch = ({
  patchCount,
  summary,
  onApply,
  onDiscard,
  loading = false,
}: AlkaidPendingPatchProps) => {
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
        {t('workflowEditor.alkaid.pendingPatch', '待确认补丁')}：
        {patchCount} {t('workflowEditor.changes', '项变更')}
      </div>
      {summary && (
        <div className={styles.summaryList}>
          {(summary.addedNodeIds?.length ?? 0) > 0 && (
            <div className={styles.summaryItem}>
              {t('workflowEditor.alkaid.pendingPatchAddedNodes', '将新增节点')}：{summary.addedNodeIds!.length}
            </div>
          )}
          {(summary.removedNodeIds?.length ?? 0) > 0 && (
            <div className={styles.summaryItem}>
              {t('workflowEditor.alkaid.pendingPatchRemovedNodes', '将删除节点')}：{summary.removedNodeIds!.length}
            </div>
          )}
          {(summary.updatedNodeIds?.length ?? 0) > 0 && (
            <div className={styles.summaryItem}>
              {t('workflowEditor.alkaid.pendingPatchUpdatedNodes', '将修改节点')}：{summary.updatedNodeIds!.length}
            </div>
          )}
          {summary.edgesChanged && (
            <div className={styles.summaryItem}>
              {t('workflowEditor.alkaid.pendingPatchEdgesChanged', '连线将发生变化')}
            </div>
          )}
        </div>
      )}
      <Space size={8} style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={handleDiscard} disabled={loading}>
          {t('workflowEditor.alkaid.discard', '放弃')}
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={handleApply}
          loading={loading}
        >
          {t('workflowEditor.alkaid.previewPatch', '预览修复')}
        </Button>
      </Space>
    </div>
  );

  return (
    <Tooltip title={`${t('workflowEditor.alkaid.pendingPatch', '待确认补丁')} · ${patchCount} ${t('workflowEditor.changes', '项变更')}`}>
      <Popover
        content={content}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement="topLeft"
      >
        <Badge dot offset={[-1, 2]} color="orange">
          <Button
            className={styles.triggerButton}
            icon={<DiffOutlined />}
            aria-label={t('workflowEditor.alkaid.pendingPatch', '待确认补丁')}
          />
        </Badge>
      </Popover>
    </Tooltip>
  );
};

export default AlkaidPendingPatch;
