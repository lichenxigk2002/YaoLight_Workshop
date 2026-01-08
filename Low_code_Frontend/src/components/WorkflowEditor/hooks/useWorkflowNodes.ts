import { useCallback, useState } from 'react';
import { Node } from 'reactflow';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  getDefaultConfig,
  generateRandomPosition,
  calculateMaxNodeId,
} from '@/utils/nodeUtils';

/**
 * 节点管理Hook
 */
export function useWorkflowNodes(
  nodes: Node[],
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  getNodeLabel: (type: string) => string
) {
  const { t } = useTranslation();
  const [nodeIdCounter, setNodeIdCounter] = useState(() => {
    // 初始化时计算最大ID
    return calculateMaxNodeId(nodes) + 1;
  });

  /**
   * 添加节点
   */
  const addNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      const nodePosition = position || generateRandomPosition();

      const newNode: Node = {
        id: `node-${nodeIdCounter}`,
        type: type,
        position: nodePosition,
        data: {
          label: getNodeLabel(type),
          type: type,
          config: getDefaultConfig(type),
          connectionDirection: 'vertical', // 默认上下连接
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setNodeIdCounter((counter) => counter + 1);
      message.success(t('node.messages.nodeAdded', { label: getNodeLabel(type) }));
    },
    [nodeIdCounter, setNodes, getNodeLabel, t]
  );

  /**
   * 添加注释卡片
   */
  const addCommentCard = useCallback(
    (position?: { x: number; y: number }) => {
      const nodePosition = position || generateRandomPosition();

      const commentNode: Node = {
        id: `comment-${nodeIdCounter}`,
        type: 'comment',
        position: nodePosition,
        data: {
          type: 'comment',
          text: '',
          color: '#fffacd', // 默认柠檬黄色
        },
        style: {
          width: 250,
          minHeight: 120,
        },
      };

      setNodes((nds) => [...nds, commentNode]);
      setNodeIdCounter((counter) => counter + 1);
    },
    [nodeIdCounter, setNodes]
  );

  /**
   * 删除节点
   */
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      message.success(t('node.messages.nodeDeleted'));
    },
    [setNodes, t]
  );

  /**
   * 更新节点配置
   */
  const updateNodeConfig = useCallback(
    (nodeId: string, data: { label?: string; connectionDirection?: string; config?: any }) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                label: data.label ?? node.data.label,
                connectionDirection: data.connectionDirection ?? node.data.connectionDirection,
                config: data.config ?? node.data.config,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  /**
   * 更新节点执行状态
   */
  const updateNodeExecutionStatus = useCallback(
    (nodeId: string, status: 'success' | 'failed' | 'pending') => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                executionStatus: status,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  /**
   * 批量更新节点执行状态
   */
  const updateNodesExecutionStatus = useCallback(
    (statusMap: Map<string, 'success' | 'failed' | 'pending'>) => {
      setNodes((nds) =>
        nds.map((node) => {
          const status = statusMap.get(node.id);
          if (status) {
            return {
              ...node,
              data: {
                ...node.data,
                executionStatus: status,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  /**
   * 清除所有节点的执行状态
   */
  const clearAllExecutionStatus = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, executionStatus: undefined },
      }))
    );
  }, [setNodes]);

  /**
   * 更新节点ID计数器（用于加载工作流后）
   */
  const updateNodeIdCounter = useCallback((nodes: Node[]) => {
    const maxId = calculateMaxNodeId(nodes);
    setNodeIdCounter(maxId + 1);
  }, []);

  return {
    nodeIdCounter,
    addNode,
    addCommentCard,
    deleteNode,
    updateNodeConfig,
    updateNodeExecutionStatus,
    updateNodesExecutionStatus,
    clearAllExecutionStatus,
    updateNodeIdCounter,
  };
}

