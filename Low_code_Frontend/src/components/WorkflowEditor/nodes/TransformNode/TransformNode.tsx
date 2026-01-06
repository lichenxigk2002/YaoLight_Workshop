import React from 'react';
import { NodeProps } from 'reactflow';
import { SwapOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';
import styles from './TransformNode.module.scss';

const TransformNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const renderContent = () => {
    if (data.config?.transformType) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>类型: {data.config.transformType}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<SwapOutlined style={{ fontSize: 20 }} />}
      color="#13c2c2"
      label="数据转换"
      showInput={true}
      showOutput={true}
    />
  );
};

export default TransformNode;

