import React from 'react';
import { NodeProps } from 'reactflow';
import { ClockCircleOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';
import styles from './DelayNode.module.scss';

const DelayNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const renderContent = () => {
    if (data.config?.seconds) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>延迟: {data.config.seconds}秒</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<ClockCircleOutlined style={{ fontSize: 20 }} />}
      color="#fa8c16"
      label="延迟节点"
      showInput={true}
      showOutput={true}
    />
  );
};

export default DelayNode;

