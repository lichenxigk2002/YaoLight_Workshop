import React from 'react';
import { Card, List, Empty } from 'antd';
import { Node } from 'reactflow';
import styles from './NodePanel.module.scss';

interface NodePanelProps {
  nodes: Node[];
  onNodeSelect: (nodeId: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

const NodePanel: React.FC<NodePanelProps> = ({ nodes, onNodeSelect, style, className }) => {
  if (nodes.length === 0) {
    return (
      <Card
        title="节点列表"
        size="small"
        style={{ display: 'flex', flexDirection: 'column', ...style }}
        className={`${styles.card} ${className || ''}`}
      >
        <div className={styles.empty}>
          <Empty description="暂无节点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="节点列表"
      size="small"
      style={{ display: 'flex', flexDirection: 'column', ...style }}
      className={`${styles.card} ${className || ''}`}
    >
      <List
        size="small"
        dataSource={nodes}
        className={styles.list}
        renderItem={(node) => (
          <List.Item className={styles.listItem} onClick={() => onNodeSelect(node.id)}>
            <List.Item.Meta
              title={node.data.label || node.id}
              description={`类型: ${node.data.type || 'unknown'}`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

export default NodePanel;
