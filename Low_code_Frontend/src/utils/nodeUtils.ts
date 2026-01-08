import { Node } from 'reactflow';

/**
 * 获取节点的默认配置
 */
export function getDefaultConfig(type: string): any {
  switch (type) {
    case 'start':
      return {
        trigger: 'manual', // manual, schedule, webhook
      };
    case 'crawler':
      return {
        url: '',
        selector: '',
        method: 'GET',
      };
    case 'dataclean':
      return {
        cleanType: 'html', // html, text, email, url, phone, number, date, custom
        removeHTML: true,
        trim: true,
        removeSpaces: false,
      };
    case 'ai':
      return {
        model: '',
        prompt: '',
        temperature: 0.7,
      };
    case 'condition':
      return {
        conditionType: 'equals', // equals, contains, greater, less, regex
        field: '',
        value: '',
        operator: '==', // ==, !=, >, <, >=, <=, contains
      };
    case 'transform':
      return {
        transformType: 'map', // map, filter, sort, group
        script: '',
      };
    case 'loop':
      return {
        loopType: 'foreach', // foreach, while, for
        items: '',
        condition: '',
      };
    case 'merge':
      return {
        mergeType: 'concat', // concat, union, intersect
      };
    case 'delay':
      return {
        delayType: 'fixed', // fixed, random
        seconds: 1,
      };
    case 'output':
      return {
        format: 'json',
        destination: 'file',
      };
    case 'end':
      return {
        action: 'none', // none, notify, callback
      };
    default:
      return {};
  }
}

/**
 * 判断节点是否为注释卡片
 */
export function isCommentNode(node: Node): boolean {
  return node.type === 'comment' || node.data?.type === 'comment';
}

/**
 * 过滤出工作流节点（排除注释卡片）
 */
export function filterWorkflowNodes(nodes: Node[]): Node[] {
  return nodes.filter((node) => !isCommentNode(node));
}

/**
 * 过滤出注释卡片
 */
export function filterCommentCards(nodes: Node[]): Node[] {
  return nodes.filter((node) => isCommentNode(node));
}

/**
 * 生成随机位置
 */
export function generateRandomPosition(): { x: number; y: number } {
  return {
    x: Math.random() * 400 + 100,
    y: Math.random() * 400 + 100,
  };
}

/**
 * 从节点ID中提取数字ID
 */
export function extractNodeIdNumber(nodeId: string): number {
  const match = nodeId.match(/(?:node|comment)-(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 计算节点ID计数器的最大值
 */
export function calculateMaxNodeId(nodes: Node[]): number {
  if (nodes.length === 0) return 0;
  return Math.max(...nodes.map((n) => extractNodeIdNumber(n.id)), 0);
}

