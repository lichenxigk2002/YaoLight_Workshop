import React from 'react';
import { NodeProps } from 'reactflow';
import { ReloadOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';
import styles from './LoopNode.module.scss';

const LoopNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const renderContent = () => {
    if (data.config?.loopType) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>类型: {data.config.loopType}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<ReloadOutlined style={{ fontSize: 20 }} />}
      color="#eb2f96"
      label="循环节点"
      showInput={true}
      showOutput={true}
    />
  );
};

export default LoopNode;

