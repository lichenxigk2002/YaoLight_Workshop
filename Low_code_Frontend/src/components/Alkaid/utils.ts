import { validateWorkflowFile } from '@/utils/workflowImportExport';
import type { WorkflowExportData } from '@/utils/workflowImportExport';

/**
 * 检测是否有工作流JSON代码块（带特殊标记的）
 * 一旦出现 <!-- workflow-json --> 即视为有工作流，便于流式时尽早显示卡片并剥离 JSON 不展示
 */
export function hasWorkflowJSONBlock(markdownText: string): boolean {
  if (!markdownText) return false;

  // 一旦出现标记就认为有工作流，流式时先显示卡片「加载中」，正文不展示 JSON
  if (/<!--\s*workflow-json\s*-->/.test(markdownText)) {
    return true;
  }

  // 检测带 ```json 的工作流块
  if (/<!--\s*workflow-json\s*-->[\s\S]*?```json\s*[\s\S]*/.test(markdownText)) {
    return true;
  }

  // 兼容旧格式：```json 代码块且含 version/nodes
  if (/```json\s*[\s\S]*/.test(markdownText) && markdownText.includes('"version"') && markdownText.includes('"nodes"')) {
    return true;
  }

  // 通用代码块且含 version/nodes
  if (/```\s*\{[\s\S]*/.test(markdownText) && markdownText.includes('"version"') && markdownText.includes('"nodes"')) {
    return true;
  }

  // 裸 JSON 对象且含 version/nodes
  if (/\{\s*"version"[\s\S]*"nodes"[\s\S]*/.test(markdownText)) {
    return true;
  }

  return false;
}

/**
 * 从Markdown文本中提取工作流JSON代码块
 */
export function extractWorkflowJSON(markdownText: string): string | null {
  if (!markdownText) return null;

  // 方法1: 优先提取带特殊标记的 ```json ... ``` 块
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

  // 方法1b: <!-- workflow-json --> 后直接跟裸 JSON（无 ``` 包裹），用括号匹配截取
  const markerRegex = /<!--\s*workflow-json\s*-->/;
  const markerMatch = markdownText.match(markerRegex);
  if (markerMatch && markerMatch.index !== undefined) {
    const after = markdownText.slice(markerMatch.index + markerMatch[0].length);
    const braceStart = after.search(/\{[ \t]*\n?[ \t]*"version"/);
    if (braceStart !== -1) {
      let depth = 0;
      let end = -1;
      for (let i = braceStart; i < after.length; i++) {
        if (after[i] === '{') depth++;
        else if (after[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end > 0) {
        try {
          const json = JSON.parse(after.slice(braceStart, end));
          return JSON.stringify(json, null, 2);
        } catch (e) {
          // 解析失败，继续其他方法
        }
      }
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
 * 从展示文案中彻底移除工作流 JSON 块（支持 <!-- workflow-json --> 后接 ```json...``` 或裸 JSON）
 * 一旦出现标记就从正文中剥离，流式未完整时从标记删到文末，保证 JSON 不在页面展示
 */
export function stripWorkflowJSONFromText(content: string): string {
  if (!content) return content;
  let text = content;

  // 1. 移除 <!-- workflow-json -->\n```json\n...\n``` 形式
  text = text.replace(/<!--\s*workflow-json\s*-->[\s\S]*?```json\s*[\s\S]*?```/g, '');

  // 2. 移除 <!-- workflow-json --> 后紧跟的裸 JSON（括号匹配）；未完整则从标记删到文末
  const markerRegex = /<!--\s*workflow-json\s*-->/g;
  let match: RegExpExecArray | null;
  const toRemove: [number, number][] = [];
  while ((match = markerRegex.exec(text)) !== null) {
    const idx = match.index;
    const afterMarker = text.slice(idx + match[0].length);
    const jsonStartRel = afterMarker.search(/\{[ \t]*\n?[ \t]*"version"/);
    let end: number;
    if (jsonStartRel === -1) {
      end = text.length; // 标记后没有 JSON 开头，删到文末（流式中）
    } else {
      const braceStart = idx + match[0].length + jsonStartRel;
      let depth = 0;
      end = braceStart;
      for (let i = braceStart; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (depth !== 0) end = text.length; // JSON 未闭合，删到文末（流式中）
    }
    toRemove.push([idx, end]);
  }
  for (let r = toRemove.length - 1; r >= 0; r--) {
    const [start, end] = toRemove[r];
    text = text.slice(0, start) + text.slice(end);
  }

  // 3. 兜底：无 marker 的 ```json ... ``` 块（含 version/nodes）
  if (text.includes('"version"') && text.includes('"nodes"')) {
    text = text.replace(/```json\s*[\s\S]*?"version"[\s\S]*?"nodes"[\s\S]*?```/g, '');
    text = text.replace(/```json\s*[\s\S]*?"version"[\s\S]*?"nodes"[\s\S]*$/gm, '');
  }

  return text.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '').trim();
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

