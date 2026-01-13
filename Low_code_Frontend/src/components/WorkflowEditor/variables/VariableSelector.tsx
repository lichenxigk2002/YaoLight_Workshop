import { useMemo, forwardRef } from 'react';
import { AutoComplete, Tooltip, Tag } from 'antd';
import { Node, Edge } from 'reactflow';
import { nodeIODefinitions } from './nodeVariables';
import { useTranslation } from 'react-i18next';

interface VariableSelectorProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  allowInput?: boolean; // 是否允许直接输入
}

interface VariableOption {
  label: string;
  value: string;
  nodeId: string;
  variable: string;
  description?: string;
}

export const VariableSelector = forwardRef<any, VariableSelectorProps>(({
  node,
  nodes,
  edges,
  value,
  onChange,
  placeholder = '选择变量或输入表达式',
}, ref) => {
  const { t } = useTranslation();

  // 获取所有可用的上游变量
  const availableVariables = useMemo(() => {
    if (!node) return [];

    const variables: VariableOption[] = [];

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
          });
        });
      }
    });

    return variables;
  }, [node, nodes, edges]);

  // 构建选项列表
  const options = useMemo(() => {
    if (availableVariables.length === 0) {
      return [];
    }

    return [
      {
        label: (
          <div style={{ fontSize: 12, color: '#999', padding: '4px 0' }}>
            {t('node.variables.availableVariables') || '可用变量'}
          </div>
        ),
        options: availableVariables.map(v => {
          // 构建搜索文本（用于过滤，避免对 React 元素进行 JSON.stringify）
          const searchText = `${v.label} ${v.variable} ${v.value} ${v.description || ''}`.toLowerCase();

          return {
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{v.label}</div>
                  {v.description && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                      {v.description}
                    </div>
                  )}
                </div>
                <Tooltip title={v.value}>
                  <Tag
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      marginLeft: 8,
                      cursor: 'pointer',
                    }}
                  >
                    {v.variable}
                  </Tag>
                </Tooltip>
              </div>
            ),
            value: v.value,
            searchText, // 添加搜索文本字段
          };
        }),
      },
    ];
  }, [availableVariables, t]);

  const handleChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  // 始终显示 AutoComplete，即使没有可用变量
  // 这样用户可以输入变量表达式，也可以看到提示
  return (
    <AutoComplete
      value={value || ''}
      onChange={handleChange}
      onSelect={handleChange}
      placeholder={placeholder}
      options={options.length > 0 ? options : undefined}
      filterOption={(inputValue, option) => {
        if (!option) return false;
        const input = inputValue.toLowerCase();

        // 使用 value 进行过滤
        const optionValue = (option as any).value;
        if (typeof optionValue === 'string' && optionValue.toLowerCase().includes(input)) {
          return true;
        }

        // 使用 searchText 进行过滤（如果存在）
        if ((option as any).searchText) {
          return (option as any).searchText.includes(input);
        }

        return false;
      }}
      style={{ width: '100%' }}
      allowClear
      // 如果没有选项，也允许输入
      notFoundContent={
        availableVariables.length === 0 ? (
          <div style={{ padding: '8px 0', color: '#999', fontSize: 12 }}>
            没有可用变量。可以直接输入 URL 或变量表达式，如：{`{{nodeId.variable}}`}
          </div>
        ) : undefined
      }
      ref={ref}
    />
  );
});

VariableSelector.displayName = 'VariableSelector';

/**
 * 获取变量的显示名称
 */
export function getVariableDisplayName(
  variablePath: string,
  nodes: Node[]
): string {
  // 解析 {{nodeId.variable}} 格式
  const match = variablePath.match(/\{\{([^.]+)\.(.+)\}\}/);
  if (!match) {
    return variablePath;
  }

  const [, nodeId, variable] = match;
  const node = nodes.find(n => n.id === nodeId);
  if (!node) {
    return variablePath;
  }

  const nodeType = node.data?.type || node.type;
  const nodeDef = nodeIODefinitions[nodeType];
  const outputVar = nodeDef?.outputs.find(v => v.variable === variable);

  const nodeLabel = node.data?.label || nodeId;
  const varLabel = outputVar?.label || variable;

  return `${nodeLabel}.${varLabel}`;
}

