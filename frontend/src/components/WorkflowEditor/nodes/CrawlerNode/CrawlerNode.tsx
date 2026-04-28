import React, { useMemo } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { CloudDownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const CrawlerNode: React.FC<NodeProps> = ({ data, id, ...props }) => {
  const { t } = useTranslation();
  const { getNodes, getEdges } = useReactFlow();

  // 解析变量路径并获取显示值
  const getVariableDisplayValue = useMemo(() => {
    const urlVariable = data.config?.urlVariable;
    if (!urlVariable) return null;

    // 解析变量路径，格式：{{nodeId.variable.path}}
    const match = urlVariable.match(/\{\{([^}]+)\}\}/);
    if (!match) return null;

    const varPath = match[1];
    const parts = varPath.split('.');
    if (parts.length < 2) return null;

    const sourceNodeId = parts[0];
    const variablePath = parts.slice(1).join('.');

    // 获取所有节点和边
    const allNodes = getNodes();
    const allEdges = getEdges();

    // 查找源节点
    const sourceNode = allNodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return null;

    // 如果是开始节点，从配置中提取值
    if (sourceNode.data?.type === 'start') {
      const config = sourceNode.data?.config || {};
      const inputData = config.inputData;
      const inputDataType = config.inputDataType || 'auto';

      if (inputData) {
        const pathParts = variablePath.split('.');
        
        // 如果是URL格式
        if (pathParts.length === 1 && (inputDataType === 'url' || (inputDataType === 'auto' && (inputData.startsWith('http://') || inputData.startsWith('https://'))))) {
          return inputData;
        }
        
        // 如果是JSON，解析并提取值
        if (inputDataType === 'json' || inputDataType === 'auto') {
          try {
            const parsed = JSON.parse(inputData);
            if (typeof parsed === 'object' && parsed !== null) {
              let current: any = parsed;
              for (const part of pathParts) {
                if (current && typeof current === 'object' && part in current) {
                  current = current[part];
                } else {
                  return null;
                }
              }
              
              if (typeof current === 'string') {
                return current;
              }
            }
          } catch (e) {
            // JSON解析失败
          }
        }
      }
    }

    return null;
  }, [data.config?.urlVariable, getNodes, getEdges, id]);

  // 渲染爬虫节点的自定义内容
  const displayUrl = getVariableDisplayValue || data.config?.url;
  const metaLines = [
    data.config?.ruleName ? `Rule: ${data.config.ruleName}` : null,
    displayUrl ? `URL: ${displayUrl}` : null,
  ].filter(Boolean);

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<CloudDownloadOutlined style={{ fontSize: 20 }} />}
      color="#000000"
      label={t('node.labels.crawler')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default CrawlerNode;
