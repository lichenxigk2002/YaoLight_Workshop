import { Node, Edge } from 'reactflow';
import { filterWorkflowNodes } from './nodeUtils';

/**
 * 验证工作流执行前的配置
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * 验证工作流是否可以执行
 */
export function validateWorkflowBeforeExecute(
  nodes: Node[],
  _edges: Edge[],
  t: (key: string, params?: any) => string
): ValidationResult {
  const workflowNodes = filterWorkflowNodes(nodes);

  // 检查是否有节点
  if (workflowNodes.length === 0) {
    return {
      valid: false,
      message: t('workflowEditor.addNodesFirst'),
    };
  }

  // 验证爬虫节点配置
  const crawlerNodes = workflowNodes.filter((n) => n.type === 'crawler');
  for (const node of crawlerNodes) {
    if (!node.data.config?.url) {
      return {
        valid: false,
        message: t('workflowEditor.crawlerUrlMissing', {
          label: node.data.label || node.id,
        }),
      };
    }
  }

  return { valid: true };
}

