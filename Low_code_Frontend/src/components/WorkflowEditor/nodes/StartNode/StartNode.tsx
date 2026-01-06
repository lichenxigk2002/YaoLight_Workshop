import React from 'react';
import { NodeProps } from 'reactflow';
import { PlayCircleOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';

const StartNode: React.FC<NodeProps> = (props) => {
  return (
    <BaseNode
      {...props}
      icon={<PlayCircleOutlined style={{ fontSize: 20 }} />}
      color="#52c41a"
      label="开始"
      showInput={false}
      showOutput={true}
    />
  );
};

export default StartNode;

