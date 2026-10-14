import React, { useEffect } from 'react';
import { NodeProps, useUpdateNodeInternals } from 'reactflow';
import { MergeCellsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

function normalizeMergeInputCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 3;
  return Math.min(5, Math.max(1, Math.trunc(numeric)));
}

const MergeNode: React.FC<NodeProps> = (props) => {
  const { t } = useTranslation();
  const updateNodeInternals = useUpdateNodeInternals();
  const inputCount = normalizeMergeInputCount(props.data?.config?.inputCount);

  useEffect(() => {
    updateNodeInternals(props.id);
  }, [inputCount, props.id, updateNodeInternals]);

  return (
    <BaseNode
      {...props}
      icon={<MergeCellsOutlined style={{ fontSize: 20 }} />}
      color="#2f54eb"
      label={t('node.labels.merge')}
      showInput={true}
      showOutput={true}
      inputCount={inputCount}
      forceMultipleInputs={true}
      inputHandlePrefix="input"
    />
  );
};

export default MergeNode;

