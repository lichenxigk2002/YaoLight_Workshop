import React from 'react';
import { NodeProps } from 'reactflow';
import { ClearOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';
import styles from './DataCleanNode.module.scss';

const DataCleanNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const renderContent = () => {
    const cleanType = data.config?.cleanType;
    
    const cleanTypeLabels: Record<string, string> = {
      html: '清洗HTML',
      text: '清洗文本',
      email: '提取邮箱',
      url: '提取链接',
      phone: '提取电话',
      number: '提取数字',
      date: '提取日期',
      custom: '自定义',
    };

    if (cleanType) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>
            类型: {cleanTypeLabels[cleanType] || cleanType}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<ClearOutlined style={{ fontSize: 20 }} />}
      color="#52c41a"
      label="数据清洗"
      showInput={true}
      showOutput={true}
    />
  );
};

export default DataCleanNode;

