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
  // 注意：节点类型可能存储在 node.data.type 或 node.type 中
  // 只验证真正的爬虫节点，避免误判其他节点类型
  for (const node of workflowNodes) {
    const nodeType = node.data?.type || node.type;

    // 只处理爬虫节点
    if (nodeType !== 'crawler') {
      continue;
    }

    // 检查URL配置：优先检查 urlVariable，如果没有则检查 url
    const urlVariable = node.data?.config?.urlVariable;
    const url = node.data?.config?.url;

    // 如果既没有URL变量，也没有URL配置，则报错
    if (!urlVariable && !url) {
      return {
        valid: false,
        message: t('workflowEditor.crawlerUrlMissing', {
          label: node.data?.label || node.id,
        }),
      };
    }
  }

  return { valid: true };
}

