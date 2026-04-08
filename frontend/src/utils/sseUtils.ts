/**
 * SSE (Server-Sent Events) 工具函数
 */

export interface SSEMessage {
  nodeId: string;
  content: string;
  done: boolean;
  contentType?: 'reasoning' | 'content' | 'node_complete' | 'node_result';
  error?: string;
}

export interface SSECallbacks {
  onMessage: (nodeId: string, content: string, done: boolean, contentType?: 'reasoning' | 'content' | 'node_complete' | 'node_result') => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

/**
 * 解析 SSE 数据内容
 * 支持新的 contentType 字段和旧的标记格式（向后兼容）
 */
function parseSSEContent(dataStr: string): {
  content: string;
  contentType?: 'reasoning' | 'content' | 'node_complete' | 'node_result';
  error?: string;
  reasoningMatch?: RegExpMatchArray;
  contentMatch?: RegExpMatchArray;
  parsed?: any;
} {
  if (!dataStr) return { content: '' };

  try {
    const parsed = JSON.parse(dataStr);

    // 处理错误
    if (parsed.error) {
      return { content: '', error: parsed.error, parsed };
    }

    // 适配 Alkaid 流式消息格式 { content, step, done }
    if (parsed.step !== undefined) {
      return { 
        content: parsed.content || '', 
        contentType: parsed.step, // 将 step 映射为 contentType
        parsed 
      };
    }

    if (parsed.nodeId && parsed.content !== undefined) {
      let content = parsed.content || '';
      let contentType: 'reasoning' | 'content' | 'node_complete' | 'node_result' | undefined = parsed.contentType || undefined;

      // 如果后端没有发送 contentType，向后兼容：尝试解析标记
      if (!contentType) {
        if (content.startsWith('[REASONING_DELTA]')) {
          content = content.substring('[REASONING_DELTA]'.length);
          contentType = 'reasoning';
        } else if (content.startsWith('[CONTENT_DELTA]')) {
          content = content.substring('[CONTENT_DELTA]'.length);
          contentType = 'content';
        } else if (content.includes('[REASONING]') || content.includes('[CONTENT]')) {
          // 完整格式（done时可能发送）
          const reasoningMatch = content.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
          const contentMatch = content.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/);

          if (reasoningMatch && contentMatch) {
            // 同时包含两种内容，需要分别处理
            return { content, contentType: undefined, reasoningMatch, contentMatch, parsed };
          } else if (reasoningMatch) {
            content = reasoningMatch[1];
            contentType = 'reasoning';
          } else if (contentMatch) {
            content = contentMatch[1];
            contentType = 'content';
          }
        }
      }

      return { content, contentType, parsed };
    }
  } catch (e) {
    // 解析失败，返回空内容
  }

  return { content: '' };
}

/**
 * 处理 SSE 数据并调用回调
 */
function processSSEData(dataStr: string, callbacks: SSECallbacks): void {
  if (!dataStr) return;

  const result = parseSSEContent(dataStr);

  // 处理错误
  if (result.error && result.parsed) {
    callbacks.onError?.(result.error);
    return;
  }

  // 处理同时包含思考和正式内容的情况
  if (result.reasoningMatch && result.contentMatch && result.parsed) {
    callbacks.onMessage(
      result.parsed.nodeId,
      result.reasoningMatch[1],
      result.parsed.done || false,
      'reasoning'
    );
    callbacks.onMessage(
      result.parsed.nodeId,
      result.contentMatch[1],
      result.parsed.done || false,
      'content'
    );
    return;
  }

  // 正常处理
  if (result.parsed) {
    // 兼容 Alkaid 格式 (没有 nodeId)
    const nodeId = result.parsed.nodeId || 'alkaid';
    
    callbacks.onMessage(
      nodeId,
      result.content,
      result.parsed.done || false,
      result.contentType as any
    );
  }
}

/**
 * 创建 SSE 流式读取器
 * @param response Fetch Response 对象
 * @param callbacks 回调函数
 * @returns 取消函数
 */
export function createSSEReader(
  response: Response,
  callbacks: SSECallbacks
): () => void {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    callbacks.onError?.('Response body is null');
    return () => { };
  }

  let buffer = '';
  let currentData = '';
  let isAborted = false;

  const readChunk = () => {
    if (isAborted) return;

    reader.read().then(({ done, value }) => {
      if (isAborted) return;

      if (done) {
        // 处理最后的数据
        if (currentData) {
          processSSEData(currentData, callbacks);
        }
        callbacks.onComplete?.();
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // 按行分割
      const lines = buffer.split('\n');
      // 保留最后一行不完整的数据
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine === '') {
          // 空行表示一个事件结束，处理之前累积的数据
          if (currentData) {
            processSSEData(currentData, callbacks);
            currentData = '';
          }
        } else if (line.startsWith('data:')) {
          // 遇到新的data行，先处理之前的数据（如果有）
          if (currentData) {
            processSSEData(currentData, callbacks);
          }

          const dataContent = line.substring(5).trim();
          if (dataContent === '[DONE]') {
            callbacks.onComplete?.();
            return;
          }
          currentData = dataContent;
        }
        // 忽略 event: 行和其他行
      }

      readChunk();
    }).catch(err => {
      if (isAborted || err.name === 'AbortError') {
        return;
      }
      callbacks.onError?.(err.message || '读取流失败');
    });
  };

  readChunk();

  // 返回取消函数
  return () => {
    isAborted = true;
    reader.cancel();
  };
}
