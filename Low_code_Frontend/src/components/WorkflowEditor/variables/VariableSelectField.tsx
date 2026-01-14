import React, { useMemo } from 'react';
import { Select, Tag, Tooltip } from 'antd';
import { Node, Edge } from 'reactflow';
import { nodeIODefinitions } from './nodeVariables';

const { Option } = Select;

interface VariableSelectFieldProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  executionResult?: any; // 执行结果，用于显示预览
}

export const VariableSelectField: React.FC<VariableSelectFieldProps> = ({
  node,
  nodes,
  edges,
  value,
  onChange,
  placeholder = '选择变量',
  allowClear = true,
  executionResult,
}) => {

  // 修正变量路径：如果保存的变量路径中的节点ID不存在，尝试自动修正为正确的节点ID
  const correctedValue = useMemo(() => {
    if (!value || !node) return value;

    // 提取变量路径中的节点ID，格式：{{nodeId.variable.path}}
    const match = value.match(/\{\{([^}]+)\}\}/);
    if (!match) return value;

    const varPath = match[1];
    const parts = varPath.split('.');
    if (parts.length < 2) return value;

    const savedNodeId = parts[0];
    const variablePath = parts.slice(1).join('.');

    // 检查保存的节点ID是否存在
    const savedNodeExists = nodes.some(n => n.id === savedNodeId);
    if (savedNodeExists) return value;

    // 如果节点ID不存在，尝试从上游节点中查找匹配的变量路径
    const upstreamNodes = edges
      .filter(edge => edge.target === node.id)
      .map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        return sourceNode;
      })
      .filter(Boolean) as Node[];

    // 尝试从上游节点中查找匹配的变量
    for (const upstreamNode of upstreamNodes) {
      const nodeType = upstreamNode.data?.type || upstreamNode.type;
      const nodeDef = nodeIODefinitions[nodeType];
      if (nodeDef?.outputs) {
        for (const outputVar of nodeDef.outputs) {
          // 检查变量路径是否匹配
          if (outputVar.variable === variablePath || variablePath.startsWith(outputVar.variable + '.')) {
            const correctedPath = `{{${upstreamNode.id}.${variablePath}}}`;
            // 如果值已改变，自动更新（但只在组件挂载时执行一次，避免循环更新）
            if (correctedPath !== value) {
              // 延迟更新，避免在渲染过程中更新状态
              setTimeout(() => {
                onChange?.(correctedPath);
              }, 0);
            }
            return correctedPath;
          }
        }
      }
    }

    return value;
  }, [value, node, nodes, edges, onChange]);

  // 从执行结果中提取节点输出数据
  const nodeOutputs = useMemo(() => {
    if (!executionResult?.results) return {};
    const outputs: Record<string, any> = {};
    executionResult.results.forEach((result: any) => {
      if (result.success && result.data) {
        outputs[result.node_id] = result.data;
      }
    });
    return outputs;
  }, [executionResult]);

  // 获取变量预览值
  const getVariablePreview = (nodeId: string, variablePath: string): { value: string; type: 'preview' | 'placeholder' } | null => {
    const nodeData = nodeOutputs[nodeId];

    // 如果有执行结果，尝试提取实际值
    if (nodeData) {
      try {
        // 解析路径，如 "data.url" -> ["data", "url"]
        const parts = variablePath.split('.');
        let current: any = nodeData;

        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return null;
          }
        }

        // 格式化预览值
        if (typeof current === 'string') {
          // 如果是URL，显示完整URL（不截断）
          if (current.startsWith('http://') || current.startsWith('https://')) {
            return {
              value: current.length > 60 ? `${current.substring(0, 60)}...` : current,
              type: 'preview'
            };
          }
          // 如果是长字符串，截断
          return {
            value: current.length > 60 ? `${current.substring(0, 60)}...` : current,
            type: 'preview'
          };
        } else if (typeof current === 'number' || typeof current === 'boolean') {
          return { value: String(current), type: 'preview' };
        } else if (Array.isArray(current)) {
          return { value: `数组 (${current.length} 项)`, type: 'preview' };
        } else if (current && typeof current === 'object') {
          const keys = Object.keys(current);
          // 如果是对象，尝试显示关键字段
          if (keys.length > 0) {
            const previewFields: string[] = [];
            ['url', 'link', 'href', 'text', 'title', 'name'].forEach(key => {
              if (key in current && typeof current[key] === 'string') {
                const val = current[key] as string;
                previewFields.push(`${key}: ${val.length > 20 ? val.substring(0, 20) + '...' : val}`);
              }
            });
            if (previewFields.length > 0) {
              return { value: previewFields.join(', '), type: 'preview' };
            }
          }
          return { value: `对象 (${keys.length} 字段)`, type: 'preview' };
        }

        return { value: String(current), type: 'preview' };
      } catch (e) {
        return null;
      }
    }

    // 如果没有执行结果，尝试从节点配置中获取初始值（仅对开始节点有效）
    const upstreamNode = nodes.find(n => n.id === nodeId);
    if (upstreamNode?.data?.type === 'start') {
      const config = upstreamNode.data?.config || {};
      const inputData = config.inputData;
      const inputDataType = config.inputDataType || 'auto';

      if (inputData) {
        // 解析变量路径，如 "data.url" -> ["data", "url"]
        const pathParts = variablePath.split('.');

        // 如果是URL格式，直接显示（只有当变量路径是根级别时才适用）
        if (pathParts.length === 1 && (inputDataType === 'url' || (inputDataType === 'auto' && (inputData.startsWith('http://') || inputData.startsWith('https://'))))) {
          return {
            value: inputData.length > 60 ? `${inputData.substring(0, 60)}...` : inputData,
            type: 'placeholder'
          };
        }

        // 如果是文本，显示文本（只有当变量路径是根级别时才适用）
        if (pathParts.length === 1 && (inputDataType === 'text' || inputDataType === 'string')) {
          return {
            value: inputData.length > 60 ? `${inputData.substring(0, 60)}...` : inputData,
            type: 'placeholder'
          };
        }

        // 如果是JSON，尝试解析并根据变量路径提取值
        if (inputDataType === 'json' || inputDataType === 'auto') {
          try {
            const parsed = JSON.parse(inputData);
            if (typeof parsed === 'object' && parsed !== null) {
              // 根据变量路径提取值
              let current: any = parsed;
              for (const part of pathParts) {
                if (current && typeof current === 'object' && part in current) {
                  current = current[part];
                } else {
                  // 路径不存在，返回null
                  return null;
                }
              }

              // 根据提取的值类型返回预览
              if (typeof current === 'string') {
                // 如果是URL，显示完整URL
                if (current.startsWith('http://') || current.startsWith('https://')) {
                  return {
                    value: current.length > 60 ? `${current.substring(0, 60)}...` : current,
                    type: 'placeholder'
                  };
                }
                // 如果是普通字符串，显示文本
                return {
                  value: current.length > 60 ? `${current.substring(0, 60)}...` : current,
                  type: 'placeholder'
                };
              } else if (typeof current === 'number' || typeof current === 'boolean') {
                return { value: String(current), type: 'placeholder' };
              } else if (Array.isArray(current)) {
                return { value: `数组 (${current.length} 项)`, type: 'placeholder' };
              } else if (current && typeof current === 'object') {
                // 如果是对象，尝试显示关键字段
                const keys = Object.keys(current);
                const previewFields: string[] = [];
                ['url', 'link', 'href', 'text', 'title', 'name'].forEach(key => {
                  if (key in current && typeof current[key] === 'string') {
                    const val = current[key] as string;
                    previewFields.push(`${key}: ${val.length > 20 ? val.substring(0, 20) + '...' : val}`);
                  }
                });
                if (previewFields.length > 0) {
                  return { value: previewFields.join(', '), type: 'placeholder' };
                }
                return { value: `对象 (${keys.length} 字段)`, type: 'placeholder' };
              }

              return { value: String(current), type: 'placeholder' };
            }
          } catch (e) {
            // JSON解析失败，如果变量路径是根级别，显示原始文本
            if (pathParts.length === 1) {
              return {
                value: inputData.length > 60 ? `${inputData.substring(0, 60)}...` : inputData,
                type: 'placeholder'
              };
            }
            // 否则返回null
            return null;
          }
        }
      }
    }

    return null;
  };

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
      nodeType: string;
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
          // 添加基础变量
          variables.push({
            label: outputVar.label, // 简化：只显示变量名称，如"爬取数据"
            value: `{{${upstreamNode.id}.${outputVar.variable}}}`,
            nodeId: upstreamNode.id,
            variable: outputVar.variable,
            description: outputVar.description || `来自"${nodeLabel}"节点的${outputVar.label}`,
            nodeLabel,
            nodeType,
          });

          // 如果变量类型是object，添加常见的子字段选项（用于URL变量等场景）
          if (outputVar.type === 'object' || outputVar.type === 'any') {
            const commonFields = [
              { field: 'url', label: 'URL地址' },
              { field: 'link', label: '链接' },
              { field: 'href', label: '超链接' },
              { field: 'src', label: '资源地址' },
              { field: 'data', label: '数据' },
            ];

            commonFields.forEach(field => {
              variables.push({
                label: field.label, // 简化：只显示字段名称，如"URL地址"
                value: `{{${upstreamNode.id}.${outputVar.variable}.${field.field}}}`,
                nodeId: upstreamNode.id,
                variable: `${outputVar.variable}.${field.field}`,
                description: `来自"${nodeLabel}"节点的${field.label}`, // 更直白的描述
                nodeLabel,
                nodeType,
              });
            });
          }
        });
      }
    });

    return variables;
  }, [node, nodes, edges]);

  // 按节点分组
  const groupedVariables = useMemo(() => {
    const groups: Record<string, typeof availableVariables> = {};
    availableVariables.forEach(v => {
      if (!groups[v.nodeLabel]) {
        groups[v.nodeLabel] = [];
      }
      groups[v.nodeLabel].push(v);
    });
    return groups;
  }, [availableVariables]);

  if (availableVariables.length === 0) {
    return (
      <Select
        value={value}
        onChange={onChange}
        placeholder={placeholder || '暂无可用变量（请先连接上游节点）'}
        disabled
        allowClear={allowClear}
      >
        <Option value="" disabled>
          暂无可用变量
        </Option>
      </Select>
    );
  }

  return (
    <Select
      value={correctedValue || value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={allowClear}
      showSearch
      filterOption={(input, option) => {
        const label = option?.label as string || '';
        const value = option?.value as string || '';
        const searchText = input.toLowerCase();
        return (
          label.toLowerCase().includes(searchText) ||
          value.toLowerCase().includes(searchText)
        );
      }}
      optionLabelProp="label"
    >
      {Object.entries(groupedVariables).map(([nodeLabel, vars]) => (
        <Select.OptGroup key={nodeLabel} label={`来自: ${nodeLabel}`}>
          {vars.map(v => (
            <Option
              key={v.value}
              value={v.value}
              label={v.label}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* 主要信息：突出显示"拿到了什么" */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {/* 简化显示：只显示变量名称，去掉节点标签前缀 */}
                    <div style={{ 
                      fontWeight: 500, 
                      fontSize: 14,
                      color: '#262626',
                      marginBottom: 2
                    }}>
                      {v.label.split('.').pop() || v.label}
                    </div>
                    {/* 更直白的描述 */}
                    <div style={{ 
                      fontSize: 12, 
                      color: '#8c8c8c',
                      lineHeight: '1.4'
                    }}>
                      {v.description || `来自"${v.nodeLabel}"节点的数据`}
                    </div>
                  </div>
                  {/* 技术字段名放在次要位置，鼠标悬停时显示完整路径 */}
                  <Tooltip title={`完整路径: ${v.value}`}>
                    <Tag
                      style={{
                        fontSize: 10,
                        fontFamily: 'monospace',
                        marginLeft: 8,
                        background: '#f5f5f5',
                        color: '#8c8c8c',
                        border: 'none',
                        cursor: 'help',
                      }}
                    >
                      {v.variable}
                    </Tag>
                  </Tooltip>
                </div>
                {/* 显示预览值 - 更突出 */}
                {(() => {
                  const preview = getVariablePreview(v.nodeId, v.variable);
                  if (preview) {
                    return (
                      <div style={{
                        fontSize: 12,
                        color: preview.type === 'preview' ? '#52c41a' : '#1890ff',
                        background: preview.type === 'preview' ? '#f6ffed' : '#e6f7ff',
                        padding: '6px 10px',
                        borderRadius: 4,
                        marginTop: 2,
                        border: `1px solid ${preview.type === 'preview' ? '#b7eb8f' : '#91d5ff'}`,
                        wordBreak: 'break-all',
                      }}>
                        <span style={{ 
                          color: preview.type === 'preview' ? '#389e0d' : '#0050b3',
                          marginRight: 6,
                          fontWeight: 500
                        }}>
                          {preview.type === 'preview' ? '✓ 实际数据:' : '示例数据:'}
                        </span>
                        <span style={{ fontWeight: 500 }}>{preview.value}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </Option>
          ))}
        </Select.OptGroup>
      ))}
    </Select>
  );
};

