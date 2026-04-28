import React from 'react';
import { NodeProps } from 'reactflow';
import { BranchesOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const ConditionNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const metaLines = data.config?.field
    ? [`${data.config.field} ${data.config.operator} ${data.config.value}`]
    : [];

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<BranchesOutlined style={{ fontSize: 20 }} />}
      color="#faad14"
      label={t('node.labels.condition')}
      showInput={true}
      showOutput={true}
      outputCount={2} // 条件节点有两个输出（true/false）
    />
  );
};

export default ConditionNode;
