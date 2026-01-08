import React from 'react';
import { NodeProps } from 'reactflow';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const StartNode: React.FC<NodeProps> = (props) => {
  const { t } = useTranslation();
  return (
    <BaseNode
      {...props}
      icon={<PlayCircleOutlined style={{ fontSize: 20 }} />}
      color="#52c41a"
      label={t('node.labels.start')}
      showInput={false}
      showOutput={true}
    />
  );
};

export default StartNode;

