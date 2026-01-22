import { validateWorkflowFile } from '@/utils/workflowImportExport';
import type { WorkflowExportData } from '@/utils/workflowImportExport';

/**
 * 从Markdown文本中提取JSON代码块
 */
export function extractWorkflowJSON(markdownText: string): string | null {
  if (!markdownText) return null;

  // 方法1: 尝试提取 ```json 代码块
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/;
  const jsonMatch = markdownText.match(jsonBlockRegex);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const json = JSON.parse(jsonMatch[1].trim());
      return JSON.stringify(json, null, 2);
    } catch (e) {
      // 如果解析失败，继续尝试其他方法
    }
  }

  // 方法2: 尝试提取通用代码块（可能是json但没有语言标识）
  const codeBlockRegex = /```\s*([\s\S]*?)```/;
  const codeMatch = markdownText.match(codeBlockRegex);
  if (codeMatch && codeMatch[1]) {
    try {
      const json = JSON.parse(codeMatch[1].trim());
      return JSON.stringify(json, null, 2);
    } catch (e) {
      // 继续尝试
    }
  }

  // 方法3: 尝试直接解析整个文本（可能是纯JSON）
  try {
    const json = JSON.parse(markdownText.trim());
    return JSON.stringify(json, null, 2);
  } catch (e) {
    // 不是纯JSON
  }

  // 方法4: 尝试提取第一个看起来像JSON的对象
  const jsonObjectRegex = /\{[\s\S]*"version"[\s\S]*"nodes"[\s\S]*\}/;
  const objectMatch = markdownText.match(jsonObjectRegex);
  if (objectMatch) {
    try {
      const json = JSON.parse(objectMatch[0]);
      return JSON.stringify(json, null, 2);
    } catch (e) {
      // 解析失败
    }
  }

  return null;
}

/**
 * 验证并解析工作流JSON
 */
export function parseWorkflowJSON(jsonString: string): WorkflowExportData | null {
  try {
    const data = JSON.parse(jsonString);
    const validation = validateWorkflowFile(data);
    if (!validation.valid) {
      console.error('工作流验证失败:', validation.error);
      return null;
    }
    return data as WorkflowExportData;
  } catch (error) {
    console.error('解析工作流JSON失败:', error);
    return null;
  }
}

