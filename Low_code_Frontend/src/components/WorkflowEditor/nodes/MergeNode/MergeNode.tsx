import React from 'react';
import { NodeProps } from 'reactflow';
import { MergeCellsOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';

const MergeNode: React.FC<NodeProps> = (props) => {
  return (
    <BaseNode
      {...props}
      icon={<MergeCellsOutlined style={{ fontSize: 20 }} />}
      color="#2f54eb"
      label="合并节点"
      showInput={true}
      showOutput={true}
      inputCount={3} // 合并节点有多个输入端口
    />
  );
};

export default MergeNode;

