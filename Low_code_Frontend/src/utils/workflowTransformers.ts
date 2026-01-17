import { Node, Edge } from 'reactflow';
import { getDefaultConfig } from './nodeUtils';
import { filterWorkflowNodes, filterCommentCards, isCommentNode } from './nodeUtils';

/**
 * 节点数据格式（从后端加载）
 */
export interface NodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data?: {
    label?: string;
    type?: string;
    config?: any;
    connectionDirection?: string;
    text?: string;
    color?: string;
  };
}

/**
 * 边数据格式（从后端加载）
 */
export interface EdgeData {
  id?: string;
  source: string;
  target: string;
}

/**
 * 注释卡片数据格式（从后端加载）
 */
export interface CommentCardData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data?: {
    text?: string;
    color?: string;
  };
}

/**
 * 工作流节点响应格式
 */
export interface WorkflowNodesResponse {
  nodes?: NodeData[];
  edges?: EdgeData[];
  commentCards?: CommentCardData[];
}

/**
 * 将后端节点数据转换为ReactFlow节点格式
 */
export function transformNodesFromLoadFormat(
  nodesData: NodeData[],
  getNodeLabel: (type: string) => string
): Node[] {
  if (!nodesData || nodesData.length === 0) return [];

  return nodesData.map((nodeData) => ({
    id: nodeData.id,
    type: nodeData.type,
    position: nodeData.position || { x: 0, y: 0 },
    data: {
      label: nodeData.data?.label || getNodeLabel(nodeData.type),
      type: nodeData.type,
      config: nodeData.data?.config || getDefaultConfig(nodeData.type),
      connectionDirection: nodeData.data?.connectionDirection || 'vertical',
    },
  }));
}

/**
 * 将后端注释卡片数据转换为ReactFlow节点格式
 */
export function transformCommentCardsFromLoadFormat(
  commentCardsData: CommentCardData[]
): Node[] {
  if (!commentCardsData || commentCardsData.length === 0) return [];

  return commentCardsData.map((cardData) => ({
    id: cardData.id,
    type: 'comment',
    position: cardData.position || { x: 0, y: 0 },
    data: {
      type: 'comment',
      text: cardData.data?.text || '',
      color: cardData.data?.color || '#fffacd',
    },
    style: {
      width: 250,
      minHeight: 120,
    },
  }));
}

/**
 * 将后端边数据转换为ReactFlow边格式
 */
export function transformEdgesFromLoadFormat(edgesData: EdgeData[]): Edge[] {
  if (!edgesData || edgesData.length === 0) return [];

  return edgesData.map((edgeData) => ({
    id: edgeData.id || `${edgeData.source}-${edgeData.target}`,
    source: edgeData.source,
    target: edgeData.target,
    sourceHandle: edgeData.sourceHandle || undefined, // 加载 sourceHandle（条件节点的 true/false 分支）
    targetHandle: edgeData.targetHandle || undefined, // 加载 targetHandle（合并节点的 input-0/input-1/input-2）
  }));
}

/**
 * 将ReactFlow节点转换为保存格式（只保存工作流节点）
 */
export function transformNodesToSaveFormat(nodes: Node[]): NodeData[] {
  const workflowNodes = filterWorkflowNodes(nodes);

  return workflowNodes.map((node) => ({
    id: node.id,
    type: node.type || node.data.type || 'default',
    position: node.position,
    data: {
      label: node.data.label,
      type: node.data.type || node.type,
      config: node.data.config || {},
      connectionDirection: node.data.connectionDirection || 'vertical',
    },
  }));
}

/**
 * 将注释卡片转换为保存格式
 */
export function transformCommentCardsToSaveFormat(nodes: Node[]): CommentCardData[] {
  const commentCards = filterCommentCards(nodes);

  return commentCards.map((card) => ({
    id: card.id,
    type: 'comment',
    position: card.position,
    data: {
      text: card.data?.text || '',
      color: card.data?.color || '#fffacd',
    },
  }));
}

/**
 * 将ReactFlow边转换为保存格式（排除注释卡片之间的连接）
 */
export function transformEdgesToSaveFormat(edges: Edge[], nodes: Node[]): EdgeData[] {
  return edges
    .filter((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      return (
        sourceNode &&
        targetNode &&
        !isCommentNode(sourceNode) &&
        !isCommentNode(targetNode)
      );
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined, // 保存 sourceHandle（条件节点的 true/false 分支）
      targetHandle: edge.targetHandle || undefined, // 保存 targetHandle（合并节点的 input-0/input-1/input-2）
    }));
}

/**
 * 准备执行数据（排除注释卡片）
 */
export function prepareExecutionData(nodes: Node[], edges: Edge[]) {
  const workflowNodes = filterWorkflowNodes(nodes);

  return {
    nodes: workflowNodes.map((node) => ({
      id: node.id,
      type: (node.type || node.data.type || 'default') as string,
      config: (node.data.config || {}) as Record<string, any>,
    })),
    edges: transformEdgesToSaveFormat(edges, nodes),
  };
}

