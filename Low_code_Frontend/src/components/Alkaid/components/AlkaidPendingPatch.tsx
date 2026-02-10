import React, { useState } from 'react';
import { Button, Popover, Space, Badge } from 'antd';
import { UploadOutlined, CloseOutlined, DiffOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './AlkaidPending.module.scss';

interface AlkaidPendingPatchProps {
  patchCount: number;
  onApply: () => void;
  onDiscard: () => void;
  loading?: boolean;
}

const AlkaidPendingPatch: React.FC<AlkaidPendingPatchProps> = ({
  patchCount,
  onApply,
  onDiscard,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const content = (
    <div className={styles.popoverContent}>
      <div className={styles.popoverLabel}>
        {t('workflowEditor.alkaid.pendingPatch', '待确认补丁')}：
        {patchCount} {t('workflowEditor.changes', '项变更')}
      </div>
      <Space size={8} style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onDiscard} disabled={loading}>
          {t('workflowEditor.alkaid.discard', '放弃')}
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<UploadOutlined />}
          onClick={onApply}
          loading={loading}
        >
          {t('workflowEditor.alkaid.applyPatch', '应用补丁')}
        </Button>
      </Space>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="topLeft"
    >
      <Badge dot offset={[-2, 2]} color="orange">
        <Button className={styles.triggerButton} icon={<DiffOutlined />}>
          {t('workflowEditor.alkaid.patch', '补丁')} ({patchCount})
        </Button>
      </Badge>
    </Popover>
  );
};

export default AlkaidPendingPatch;
