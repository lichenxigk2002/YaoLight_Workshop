/**
 * 节点变量定义
 * 定义每个节点类型的输入变量和输出变量
 */

export interface NodeVariable {
  variable: string;      // 变量名，如 "url", "content"
  label: string;         // 显示名称，如 "URL地址", "内容"
  type: 'string' | 'number' | 'object' | 'array' | 'any' | 'boolean';
  required?: boolean;
  description?: string;
  default?: any;
}

export interface NodeIODefinition {
  inputs: NodeVariable[];   // 输入变量列表
  outputs: NodeVariable[];  // 输出变量列表
}

// 节点输入输出定义映射
export const nodeIODefinitions: Record<string, NodeIODefinition> = {
  start: {
    inputs: [],
    outputs: [
      {
        variable: 'data',
        label: '初始数据',
        type: 'object',
        description: '开始节点的初始数据（用户输入的数据或默认数据）',
      },
    ],
  },
  crawler: {
    inputs: [
      {
        variable: 'url',
        label: 'URL地址',
        type: 'string',
        required: false,
        description: '要爬取的URL，可从上游节点获取',
      },
      {
        variable: 'headers',
        label: '请求头',
        type: 'object',
        required: false,
        description: 'HTTP请求头',
      },
    ],
    outputs: [
      {
        variable: 'data',
        label: '爬取数据',
        type: 'object',
        description: '爬取到的数据对象',
      },
      {
        variable: 'html',
        label: 'HTML内容',
        type: 'string',
        description: '原始HTML内容',
      },
      {
        variable: 'text',
        label: '文本内容',
        type: 'string',
        description: '提取的文本内容',
      },
    ],
  },
  dataclean: {
    inputs: [
      {
        variable: 'data',
        label: '待清洗数据',
        type: 'any',
        required: true,
        description: '需要清洗的数据',
      },
    ],
    outputs: [
      {
        variable: 'cleaned',
        label: '清洗后数据',
        type: 'any',
        description: '清洗后的数据',
      },
    ],
  },
  ai: {
    inputs: [
      {
        variable: 'content',
        label: '输入内容',
        type: 'string',
        required: true,
        description: 'AI处理的输入内容',
      },
    ],
    outputs: [
      {
        variable: 'result',
        label: 'AI结果',
        type: 'string',
        description: 'AI处理的结果',
      },
    ],
  },
  condition: {
    inputs: [
      {
        variable: 'data',
        label: '数据',
        type: 'any',
        required: true,
        description: '用于条件判断的数据',
      },
    ],
    outputs: [
      {
        variable: 'result',
        label: '判断结果',
        type: 'boolean',
        description: '条件判断的结果',
      },
      {
        variable: 'data',
        label: '原始数据',
        type: 'any',
        description: '原始输入数据',
      },
    ],
  },
  transform: {
    inputs: [
      {
        variable: 'data',
        label: '待转换数据',
        type: 'any',
        required: true,
      },
    ],
    outputs: [
      {
        variable: 'transformed',
        label: '转换后数据',
        type: 'any',
        description: '转换后的数据',
      },
    ],
  },
  loop: {
    inputs: [
      {
        variable: 'items',
        label: '循环项',
        type: 'array',
        required: true,
        description: '要循环的数据数组',
      },
    ],
    outputs: [
      {
        variable: 'results',
        label: '循环结果',
        type: 'array',
        description: '循环处理后的结果数组',
      },
    ],
  },
  merge: {
    inputs: [
      {
        variable: 'data',
        label: '数据',
        type: 'any',
        required: false,
        description: '要合并的数据（多个输入）',
      },
    ],
    outputs: [
      {
        variable: 'merged',
        label: '合并数据',
        type: 'object',
        description: '合并后的数据',
      },
    ],
  },
  delay: {
    inputs: [
      {
        variable: 'data',
        label: '数据',
        type: 'any',
        required: false,
      },
    ],
    outputs: [
      {
        variable: 'data',
        label: '数据',
        type: 'any',
        description: '透传的输入数据',
      },
    ],
  },
  output: {
    inputs: [
      {
        variable: 'data',
        label: '输出数据',
        type: 'any',
        required: true,
      },
    ],
    outputs: [
      {
        variable: 'data',
        label: '输出数据',
        type: 'any',
        description: '输出的数据',
      },
    ],
  },
  end: {
    inputs: [
      {
        variable: 'data',
        label: '最终数据',
        type: 'any',
        required: false,
      },
    ],
    outputs: [],
  },
};

/**
 * 获取节点的输入变量定义
 */
export function getNodeInputVariables(nodeType: string): NodeVariable[] {
  return nodeIODefinitions[nodeType]?.inputs || [];
}

/**
 * 获取节点的输出变量定义
 */
export function getNodeOutputVariables(nodeType: string): NodeVariable[] {
  return nodeIODefinitions[nodeType]?.outputs || [];
}

/**
 * 获取节点输入输出定义
 */
export function getNodeIODefinition(nodeType: string): NodeIODefinition | undefined {
  return nodeIODefinitions[nodeType];
}

