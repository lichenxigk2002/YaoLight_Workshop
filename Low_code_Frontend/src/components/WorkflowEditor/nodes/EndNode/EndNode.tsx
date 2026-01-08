import React from 'react';
import { NodeProps } from 'reactflow';
import { StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const EndNode: React.FC<NodeProps> = (props) => {
  const { t } = useTranslation();
  return (
    <BaseNode
      {...props}
      icon={<StopOutlined style={{ fontSize: 20 }} />}
      color="#f5222d"
      label={t('node.labels.end')}
      showInput={true}
      showOutput={false}
    />
  );
};

export default EndNode;

