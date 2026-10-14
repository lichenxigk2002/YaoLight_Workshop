/**
 * 节点数据格式定义
 * 定义每个节点类型的输入格式和输出格式
 */

// 数据格式类型
export type DataFormat = 
  | 'any'           // 任意格式（通用）
  | 'json'          // JSON对象
  | 'array'         // 数组
  | 'text'          // 文本
  | 'html'          // HTML内容
  | 'url'           // URL字符串
  | 'number'        // 数字
  | 'boolean'       // 布尔值
  | 'null';         // 无输入（开始节点）

// 节点格式定义接口
export interface NodeFormatDefinition {
  inputFormats: DataFormat[];   // 可接受的输入格式列表
  outputFormat: DataFormat;      // 输出格式
  description?: string;          // 格式说明
}

// 节点格式定义映射
export const nodeFormats: Record<string, NodeFormatDefinition> = {
  // 开始节点：无输入，输出JSON对象
  start: {
    inputFormats: ['null'],
    outputFormat: 'json',
    description: '开始节点输出初始JSON数据',
  },

  // 爬虫节点：接受URL或JSON，输出HTML或JSON
  crawler: {
    inputFormats: ['any', 'json', 'url', 'text'],
    outputFormat: 'json',
    description: '爬虫节点输出爬取的数据（JSON格式）',
  },

  // 数据清洗节点：接受任意格式，输出清洗后的数据
  dataclean: {
    inputFormats: ['any', 'json', 'array', 'text', 'html'],
    outputFormat: 'json',
    description: '数据清洗节点输出清洗后的数据（JSON格式）',
  },

  // AI节点：接受文本、JSON或HTML，输出文本或JSON
  ai: {
    inputFormats: ['any', 'json', 'text', 'html'],
    outputFormat: 'json',
    description: 'AI节点输出处理后的数据（JSON格式）',
  },

  // 条件节点：接受任意格式，输出JSON（包含判断结果）
  condition: {
    inputFormats: ['any', 'json', 'array', 'text', 'number'],
    outputFormat: 'json',
    description: '条件节点输出判断结果和原始数据',
  },

  // 转换节点：接受任意格式，输出转换后的格式
  transform: {
    inputFormats: ['any', 'json', 'array', 'text'],
    outputFormat: 'json',
    description: '转换节点输出转换后的数据',
  },

  code: {
    inputFormats: ['any', 'json', 'array', 'text'],
    outputFormat: 'json',
    description: '代码节点输出执行结果（JSON格式）',
  },

  // 循环节点：接受数组或JSON，输出数组
  loop: {
    inputFormats: ['any', 'array', 'json'],
    outputFormat: 'json',
    description: '循环节点输出 results（数组）与统计信息（JSON格式）',
  },

  // 合并节点：接受任意格式（多个输入），输出JSON
  merge: {
    inputFormats: ['any', 'json', 'array', 'text'],
    outputFormat: 'json',
    description: '合并节点输出合并后的JSON数据',
  },

  // 延迟节点：接受任意格式，透传输出
  delay: {
    inputFormats: ['any', 'json', 'array', 'text'],
    outputFormat: 'json',
    description: '延迟节点透传输入数据',
  },

  // 输出节点：接受任意格式，无输出
  output: {
    inputFormats: ['any', 'json', 'array', 'text'],
    // 后端输出节点现在会返回 artifacts 与 data（并写入 variableContext）
    // 这里用 json 以便允许连接到 end/merge 等节点，并可被变量面板引用
    outputFormat: 'json',
    description: '输出节点会生成导出制品（artifacts），并返回导出信息（JSON）',
  },

  // 结束节点：接受任意格式，无输出
  end: {
    inputFormats: ['any', 'json', 'array', 'text'],
    outputFormat: 'null',
    description: '结束节点不产生输出数据',
  },
};

/**
 * 检查格式是否兼容
 * @param sourceFormat 源节点的输出格式
 * @param targetFormat 目标节点的输入格式列表
 * @returns 是否兼容
 */
export function isFormatCompatible(
  sourceFormat: DataFormat,
  targetFormats: DataFormat[]
): boolean {
  // 如果目标节点接受任意格式，则兼容
  if (targetFormats.includes('any')) {
    return true;
  }

  // 如果源格式是any，检查目标是否接受any
  if (sourceFormat === 'any') {
    return targetFormats.includes('any');
  }

  // 检查源格式是否在目标格式列表中
  return targetFormats.includes(sourceFormat);
}

/**
 * 获取节点的输入格式定义
 */
export function getNodeInputFormats(nodeType: string): DataFormat[] {
  return nodeFormats[nodeType]?.inputFormats || ['any'];
}

/**
 * 获取节点的输出格式定义
 */
export function getNodeOutputFormat(nodeType: string): DataFormat {
  return nodeFormats[nodeType]?.outputFormat || 'any';
}

/**
 * 验证节点连接是否兼容
 * @param sourceNodeType 源节点类型
 * @param targetNodeType 目标节点类型
 * @param t 翻译函数（可选）
 * @returns 验证结果 { compatible: boolean, message?: string }
 */
export function validateNodeConnection(
  sourceNodeType: string,
  targetNodeType: string,
  t?: (key: string, params?: any) => string
): { compatible: boolean; message?: string } {
  const sourceOutput = getNodeOutputFormat(sourceNodeType);
  const targetInputs = getNodeInputFormats(targetNodeType);

  // 如果源节点输出为null（如输出节点、结束节点），不能连接到需要数据的节点
  if (sourceOutput === 'null' && !targetInputs.includes('null')) {
    const sourceLabel = t ? t(`node.types.${sourceNodeType}`) : getNodeTypeLabel(sourceNodeType);
    const targetLabel = t ? t(`node.types.${targetNodeType}`) : getNodeTypeLabel(targetNodeType);
    return {
      compatible: false,
      message: t 
        ? t('node.validation.noOutputCannotConnect', { source: sourceLabel, target: targetLabel })
        : `${sourceLabel}没有输出数据，不能连接到${targetLabel}`,
    };
  }

  // 如果目标节点不接受null，但源节点输出null
  if (sourceOutput === 'null' && !targetInputs.includes('null')) {
    const sourceLabel = t ? t(`node.types.${sourceNodeType}`) : getNodeTypeLabel(sourceNodeType);
    const targetLabel = t ? t(`node.types.${targetNodeType}`) : getNodeTypeLabel(targetNodeType);
    return {
      compatible: false,
      message: t
        ? t('node.validation.needsInputButNoOutput', { source: sourceLabel, target: targetLabel })
        : `${targetLabel}需要输入数据，但${sourceLabel}没有输出`,
    };
  }

  // 检查格式兼容性
  if (!isFormatCompatible(sourceOutput, targetInputs)) {
    const sourceLabel = t ? t(`node.types.${sourceNodeType}`) : getNodeTypeLabel(sourceNodeType);
    const targetLabel = t ? t(`node.types.${targetNodeType}`) : getNodeTypeLabel(targetNodeType);
    const formatLabel = t ? t(`node.formats.${sourceOutput}`) : getFormatLabel(sourceOutput);
    
    return {
      compatible: false,
      message: t
        ? t('node.validation.formatIncompatible', { source: sourceLabel, target: targetLabel, format: formatLabel })
        : `${sourceLabel}输出${formatLabel}格式，但${targetLabel}不接受此格式`,
    };
  }

  return { compatible: true };
}

/**
 * 获取节点类型的中文标签
 */
function getNodeTypeLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    start: '开始节点',
    crawler: '爬虫节点',
    ai: 'AI处理节点',
    condition: '条件判断节点',
    transform: '数据转换节点',
    code: '代码节点',
    loop: '循环节点',
    merge: '合并节点',
    delay: '延迟节点',
    output: '输出节点',
    end: '结束节点',
  };
  return labels[nodeType] || nodeType;
}

/**
 * 获取格式的中文标签
 */
function getFormatLabel(format: DataFormat): string {
  const labels: Record<DataFormat, string> = {
    any: '任意',
    json: 'JSON',
    array: '数组',
    text: '文本',
    html: 'HTML',
    url: 'URL',
    number: '数字',
    boolean: '布尔值',
    null: '无',
  };
  return labels[format] || format;
}
