import React from 'react';
import { Card, List, Empty } from 'antd';
import { Node } from 'reactflow';

interface NodePanelProps {
  nodes: Node[];
  onNodeSelect: (nodeId: string) => void;
}

const NodePanel: React.FC<NodePanelProps> = ({ nodes, onNodeSelect }) => {
  if (nodes.length === 0) {
    return (
      <Card title="节点列表" size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无节点" />
        </div>
      </Card>
    );
  }

  return (
    <Card title="节点列表" size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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

