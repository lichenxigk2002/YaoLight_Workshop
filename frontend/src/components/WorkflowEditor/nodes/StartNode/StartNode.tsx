import React from 'react';
import { NodeProps } from 'reactflow';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const StartNode: React.FC<NodeProps> = (props) => {
  const { t } = useTranslation();
  const isAPIInput = props.data?.config?.inputMode === 'api_input';
  return (
    <BaseNode
      {...props}
      icon={<PlayCircleOutlined style={{ fontSize: 20 }} />}
      color="#52c41a"
      label={isAPIInput ? 'API Input' : t('node.labels.start')}
      showInput={false}
      showOutput={true}
    />
  );
};

export default StartNode;
