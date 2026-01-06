import React from 'react';
import { NodeProps } from 'reactflow';
import { RobotOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';
import styles from './AINode.module.scss';

const AINode: React.FC<NodeProps> = ({ data, ...props }) => {
  const renderContent = () => {
    if (data.config?.model) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>模型: {data.config.model}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<RobotOutlined style={{ fontSize: 20 }} />}
      color="#722ed1"
      label="AI处理节点"
      showInput={true}
      showOutput={true}
    />
  );
};

export default AINode;

