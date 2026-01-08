import React, { useState, useMemo } from 'react';
import { Button, Popover, List, Tag, Space, Input } from 'antd';
import { Node, Edge } from 'reactflow';
import { nodeIODefinitions } from './nodeVariables';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface VariableSelectorButtonProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  onSelect: (variable: string) => void;
}

export const VariableSelectorButton: React.FC<VariableSelectorButtonProps> = ({
  node,
  nodes,
  edges,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 获取所有可用的上游变量
  const availableVariables = useMemo(() => {
    if (!node) return [];

    const variables: Array<{
      label: string;
      value: string;
      nodeId: string;
      variable: string;
      description?: string;
      nodeLabel: string;
    }> = [];

    // 找到所有上游节点
    const upstreamNodes = edges
      .filter(edge => edge.target === node.id)
      .map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        return sourceNode;
      })
      .filter(Boolean) as Node[];

    upstreamNodes.forEach(upstreamNode => {
      const nodeType = upstreamNode.data?.type || upstreamNode.type;
      const nodeDef = nodeIODefinitions[nodeType];
      const nodeLabel = upstreamNode.data?.label || upstreamNode.id;

      if (nodeDef?.outputs) {
        nodeDef.outputs.forEach(outputVar => {
          variables.push({
            label: `${nodeLabel}.${outputVar.label}`,
            value: `{{${upstreamNode.id}.${outputVar.variable}}}`,
            nodeId: upstreamNode.id,
            variable: outputVar.variable,
            description: outputVar.description,
            nodeLabel,
          });
        });
      }
    });

    return variables;
  }, [node, nodes, edges]);

  // 过滤变量
  const filteredVariables = useMemo(() => {
    if (!searchText) return availableVariables;
    const search = searchText.toLowerCase();
    return availableVariables.filter(v =>
      v.label.toLowerCase().includes(search) ||
      v.variable.toLowerCase().includes(search) ||
      v.value.toLowerCase().includes(search) ||
      (v.description && v.description.toLowerCase().includes(search))
    );
  }, [availableVariables, searchText]);

  const handleSelect = (variable: string) => {
    onSelect(variable);
    setOpen(false);
    setSearchText('');
  };

  const content = (
    <div style={{ width: 400, maxHeight: 400 }}>
      {availableVariables.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
          <div style={{ marginBottom: 8 }}>暂无可用变量</div>
          <div style={{ fontSize: 12 }}>
            请先连接上游节点，或直接输入变量表达式：{`{{nodeId.variable}}`}
          </div>
        </div>
      ) : (
        <>
          <Input
            placeholder="搜索变量..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginBottom: 12 }}
            allowClear
          />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <List
              size="small"
              dataSource={filteredVariables}
              renderItem={(item) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                  }}
                  onClick={() => handleSelect(item.value)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                      <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {item.variable}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                      <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: 2 }}>
                        {item.value}
                      </code>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: '#999' }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title="选择变量"
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      <Button
        type="default"
        icon={<ThunderboltOutlined />}
        size="small"
        disabled={availableVariables.length === 0}
        title={availableVariables.length > 0 ? '选择变量' : '暂无可用变量'}
      >
        变量
      </Button>
    </Popover>
  );
};

