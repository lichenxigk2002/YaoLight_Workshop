import { Node, Edge } from 'reactflow';
import {
  transformNodesToSaveFormat,
  transformEdgesToSaveFormat,
  transformCommentCardsToSaveFormat,
  transformNodesFromLoadFormat,
  transformEdgesFromLoadFormat,
  transformCommentCardsFromLoadFormat,
} from './workflowTransformers';

/**
 * 工作流导出格式
 */
export interface WorkflowExportData {
  version: string;
  name?: string;
  description?: string;
  exportedAt: string;
  nodes: any[];
  edges: any[];
  commentCards?: any[];
}

/**
 * 导出工作流为JSON文件
 */
export function exportWorkflow(
  nodes: Node[],
  edges: Edge[],
  workflowName?: string,
  description?: string
): void {
  try {
    // 转换数据格式
    const nodesData = transformNodesToSaveFormat(nodes);
    const edgesData = transformEdgesToSaveFormat(edges, nodes);
    const commentCardsData = transformCommentCardsToSaveFormat(nodes);

    // 构建导出数据
    const exportData: WorkflowExportData = {
      version: '1.0.0',
      name: workflowName,
      description: description,
      exportedAt: new Date().toISOString(),
      nodes: nodesData,
      edges: edgesData,
      commentCards: commentCardsData,
    };

    // 转换为JSON字符串
    const jsonString = JSON.stringify(exportData, null, 2);

    // 创建Blob对象
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // 设置文件名
    const fileName = workflowName
      ? `${workflowName.replace(/[^a-z0-9]/gi, '_')}.json`
      : `workflow_${new Date().toISOString().split('T')[0]}.json`;
    link.download = fileName;

    // 触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error('导出工作流失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 从文件导入工作流（支持JSON格式）
 */
export async function importWorkflow(
  file: File,
  getNodeLabel: (type: string) => string
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const fileName = file.name.toLowerCase();

        // 只支持JSON格式
        if (!fileName.endsWith('.json')) {
          throw new Error('不支持的文件格式，请使用.json文件');
        }

        // 解析JSON
        const data: WorkflowExportData = JSON.parse(content);

        // 验证数据格式
        if (!data.nodes || !Array.isArray(data.nodes)) {
          throw new Error('无效的工作流文件：缺少节点数据');
        }
        if (!data.edges || !Array.isArray(data.edges)) {
          throw new Error('无效的工作流文件：缺少边数据');
        }

        // 验证版本（可选）
        if (data.version && !data.version.startsWith('1.')) {
          console.warn('工作流文件版本可能不兼容:', data.version);
        }

        // 转换节点数据
        const allNodes: Node[] = [];
        const loadedNodes = transformNodesFromLoadFormat(data.nodes, getNodeLabel);
        allNodes.push(...loadedNodes);

        // 转换注释卡片（如果有）
        if (data.commentCards && data.commentCards.length > 0) {
          const loadedCommentCards = transformCommentCardsFromLoadFormat(data.commentCards);
          allNodes.push(...loadedCommentCards);
        }

        // 转换边数据
        const loadedEdges = transformEdgesFromLoadFormat(data.edges);

        resolve({
          nodes: allNodes,
          edges: loadedEdges,
        });
      } catch (error) {
        reject(new Error('导入工作流失败: ' + (error instanceof Error ? error.message : '未知错误')));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsText(file);
  });
}

/**
 * 验证工作流文件格式
 */
export function validateWorkflowFile(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '无效的文件格式' };
  }

  if (!data.nodes || !Array.isArray(data.nodes)) {
    return { valid: false, error: '缺少节点数据' };
  }

  if (!data.edges || !Array.isArray(data.edges)) {
    return { valid: false, error: '缺少边数据' };
  }

  // 验证节点格式
  for (const node of data.nodes) {
    if (!node.id || !node.type) {
      return { valid: false, error: '节点数据格式错误：缺少id或type' };
    }
  }

  // 验证边格式
  for (const edge of data.edges) {
    if (!edge.source || !edge.target) {
      return { valid: false, error: '边数据格式错误：缺少source或target' };
    }
  }

  return { valid: true };
}

