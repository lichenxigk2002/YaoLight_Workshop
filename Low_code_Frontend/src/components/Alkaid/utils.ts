import { validateWorkflowFile } from '@/utils/workflowImportExport';
import type { WorkflowExportData } from '@/utils/workflowImportExport';

/**
 * 检测是否有工作流JSON代码块（带特殊标记的）
 */
export function hasWorkflowJSONBlock(markdownText: string): boolean {
  if (!markdownText) return false;

  // 检测是否有带特殊标记的工作流JSON代码块
  // 格式：<!-- workflow-json -->\n```json\n{...}\n```
  const workflowJsonBlockRegex = /<!--\s*workflow-json\s*-->[\s\S]*?```json\s*[\s\S]*/;
  if (workflowJsonBlockRegex.test(markdownText)) {
    return true;
  }

  // 兼容旧格式：检测是否有 ```json 代码块，且包含工作流的关键字段
  const jsonBlockStartRegex = /```json\s*[\s\S]*/;
  if (jsonBlockStartRegex.test(markdownText)) {
    // 检查是否包含工作流的关键字段
    if (markdownText.includes('"version"') && markdownText.includes('"nodes"')) {
      return true;
    }
  }

  // 检测是否有通用代码块开始标记，且包含工作流的关键字段
  const codeBlockStartRegex = /```\s*\{[\s\S]*/;
  if (codeBlockStartRegex.test(markdownText)) {
    // 检查是否包含工作流的关键字段
    if (markdownText.includes('"version"') && markdownText.includes('"nodes"')) {
      return true;
    }
  }

  // 检测是否有JSON对象开始，且包含工作流的关键字段
  const jsonObjectStartRegex = /\{\s*"version"[\s\S]*"nodes"[\s\S]*/;
  if (jsonObjectStartRegex.test(markdownText)) {
    return true;
  }

  return false;
}

/**
 * 从Markdown文本中提取工作流JSON代码块
 */
export function extractWorkflowJSON(markdownText: string): string | null {
  if (!markdownText) return null;

  // 方法1: 优先提取带特殊标记的工作流JSON代码块（新格式）
  const workflowJsonBlockRegex = /<!--\s*workflow-json\s*-->[\s\S]*?```json\s*([\s\S]*?)```/;
  const workflowMatch = markdownText.match(workflowJsonBlockRegex);
  if (workflowMatch && workflowMatch[1]) {
    try {
      const json = JSON.parse(workflowMatch[1].trim());
      return JSON.stringify(json, null, 2);
    } catch (e) {
      // 如果解析失败，继续尝试其他方法
    }
  }

  // 方法2: 尝试提取 ```json 代码块（兼容旧格式，但必须包含工作流特征）
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/;
  const jsonMatch = markdownText.match(jsonBlockRegex);
  if (jsonMatch && jsonMatch[1]) {
    const jsonContent = jsonMatch[1].trim();
    // 只处理包含工作流特征的JSON
    if (jsonContent.includes('"version"') && jsonContent.includes('"nodes"')) {
      try {
        const json = JSON.parse(jsonContent);
        return JSON.stringify(json, null, 2);
      } catch (e) {
        // 如果解析失败，继续尝试其他方法
      }
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

