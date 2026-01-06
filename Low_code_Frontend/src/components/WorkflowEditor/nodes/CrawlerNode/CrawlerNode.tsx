import React from 'react';
import { NodeProps } from 'reactflow';
import { CloudDownloadOutlined } from '@ant-design/icons';
import BaseNode from '../BaseNode/BaseNode';
import styles from './CrawlerNode.module.scss';

const CrawlerNode: React.FC<NodeProps> = ({ data, ...props }) => {
  // 渲染爬虫节点的自定义内容
  const renderContent = () => {
    if (data.config?.url) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>URL: {data.config.url}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<CloudDownloadOutlined style={{ fontSize: 20 }} />}
      color="#000000"
      label="爬虫节点"
      showInput={true}
      showOutput={true}
    />
  );
};

export default CrawlerNode;

