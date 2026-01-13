import React from 'react';
import { Card, List, Empty } from 'antd';
import { Node } from 'reactflow';

interface NodePanelProps {
  nodes: Node[];
  onNodeSelect: (nodeId: string) => void;
  style?: React.CSSProperties;
}

const NodePanel: React.FC<NodePanelProps> = ({ nodes, onNodeSelect, style }) => {
  if (nodes.length === 0) {
    return (
      <Card title="节点列表" size="small" style={{ display: 'flex', flexDirection: 'column', ...style }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
          <Empty description="暂无节点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </Card>
    );
  }

  return (
    <Card title="节点列表" size="small" style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <List
        size="small"
        dataSource={nodes}
        style={{ flex: 1, overflowY: 'auto' }}
        renderItem={(node) => (
          <List.Item
            style={{ cursor: 'pointer' }}
            onClick={() => onNodeSelect(node.id)}
          >
            <List.Item.Meta
              title={node.data.label || node.id}
              description={`类型: ${node.data.type || '未知'}`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

export default NodePanel;

