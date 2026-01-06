import React from 'react';
import { NodeProps } from 'reactflow';
import { StopOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';

const EndNode: React.FC<NodeProps> = (props) => {
  return (
    <BaseNode
      {...props}
      icon={<StopOutlined style={{ fontSize: 20 }} />}
      color="#f5222d"
      label="结束"
      showInput={true}
      showOutput={false}
    />
  );
};

export default EndNode;

