import { outputProviderRegistry } from './registry';

/**
 * 默认输出 Providers（与后端 export.DefaultFactory 对齐）
 * 后端支持：
 * - format: json
 * - format: markdown / md
 * - format: text / txt
 * destination:
 * - file / api（都会生成 artifacts；api 依赖 taskId）
 */
export function registerDefaultOutputProviders() {
  // formats
  outputProviderRegistry.registerFormat({
    id: 'json',
    label: 'JSON',
    backendValue: 'json',
    fileExtensions: ['.json'],
    description: '结构化数据导出为 JSON 文件（artifact）',
    category: { id: 'doc', label: '文档 / 数据', order: 10 },
    order: 10,
  });
  outputProviderRegistry.registerFormat({
    id: 'markdown',
    label: 'Markdown',
    backendValue: 'markdown',
    fileExtensions: ['.md', '.markdown'],
    description: '导出为 Markdown 文档（适合站内预览/再转 PDF/Word）',
    category: { id: 'doc', label: '文档 / 数据', order: 10 },
    order: 20,
  });
  outputProviderRegistry.registerFormat({
    id: 'text',
    label: 'Text',
    backendValue: 'text',
    fileExtensions: ['.txt'],
    description: '导出为纯文本文件',
    category: { id: 'doc', label: '文档 / 数据', order: 10 },
    order: 30,
  });
  outputProviderRegistry.registerFormat({
    id: 'pdf',
    label: 'PDF',
    backendValue: 'pdf',
    fileExtensions: ['.pdf'],
    description: '导出为 PDF 文件（最小可用版本：文本/JSON排版）',
    category: { id: 'doc', label: '文档 / 数据', order: 10 },
    order: 40,
  });
  outputProviderRegistry.registerFormat({
    id: 'docx',
    label: 'Word (DOCX)',
    backendValue: 'docx',
    fileExtensions: ['.docx'],
    description: '导出为 Word 文档（最小可用版本：按行输出段落）',
    category: { id: 'doc', label: '文档 / 数据', order: 10 },
    order: 50,
  });
  outputProviderRegistry.registerFormat({
    id: 'mermaid',
    label: 'Mermaid',
    backendValue: 'mermaid',
    fileExtensions: ['.mmd', '.md'],
    description: '导出 Mermaid 源码与带 mermaid 代码块的 Markdown',
    category: { id: 'diagram', label: '关系图 / 流程图（Mermaid）', order: 20 },
    order: 10,
  });
  outputProviderRegistry.registerFormat({
    id: 'timeline',
    label: 'Timeline (Mermaid)',
    backendValue: 'timeline',
    fileExtensions: ['.mmd', '.md'],
    description: '人文常用：事件时间线（输入 events 列表，导出 Mermaid timeline）',
    category: { id: 'diagram', label: '关系图 / 流程图（Mermaid）', order: 20 },
    order: 20,
  });
  outputProviderRegistry.registerFormat({
    id: 'sankey',
    label: 'Sankey (Mermaid)',
    backendValue: 'sankey',
    fileExtensions: ['.mmd', '.md'],
    description: '人文/社会科学常用：流向图（输入 flows 列表，导出 Mermaid sankey-beta）',
    category: { id: 'diagram', label: '关系图 / 流程图（Mermaid）', order: 20 },
    order: 30,
  });
  outputProviderRegistry.registerFormat({
    id: 'network',
    label: 'Network (Mermaid)',
    backendValue: 'network',
    fileExtensions: ['.mmd', '.md'],
    description: '人文常用：人物-事件-地点关系网络（输入 edges 列表，导出 Mermaid flowchart）',
    category: { id: 'diagram', label: '关系图 / 流程图（Mermaid）', order: 20 },
    order: 40,
  });
  outputProviderRegistry.registerFormat({
    id: 'chart',
    label: 'Chart (SVG)',
    backendValue: 'chart',
    fileExtensions: ['.svg'],
    description: '导出简单 SVG 图表（支持 scatter/pie/line/bar/histogram/heatmap）',
    category: { id: 'chart', label: '可视化图表（SVG）', order: 30 },
    order: 10,
  });

  // destinations
  outputProviderRegistry.registerDestination({
    id: 'file',
    label: '文件（站内下载）',
    backendValue: 'file',
    description: '生成 artifact，可在结果面板下载/预览',
  });
  outputProviderRegistry.registerDestination({
    id: 'api',
    label: '导出 API（供外部系统获取）',
    backendValue: 'api',
    description: '生成 artifact，并可通过 /tasks/:id/artifacts 获取与下载',
  });
}

