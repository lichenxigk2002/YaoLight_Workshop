import React from 'react';
import { NodeProps } from 'reactflow';
import { MergeCellsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const MergeNode: React.FC<NodeProps> = (props) => {
  const { t } = useTranslation();
  return (
    <BaseNode
      {...props}
      icon={<MergeCellsOutlined style={{ fontSize: 20 }} />}
      color="#2f54eb"
      label={t('node.labels.merge')}
      showInput={true}
      showOutput={true}
      inputCount={3} // 合并节点有3个输入端口
    />
  );
};

export default MergeNode;

