import { describe, expect, it, vi } from 'vitest';
import { createSSEReader } from '../sseUtils';

function responseFromChunks(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  }));
}

describe('createSSEReader', () => {
  it('parses standard node messages and completes on stream end', async () => {
    const onMessage = vi.fn();
    const onComplete = vi.fn();

    createSSEReader(responseFromChunks([
      'data: {"nodeId":"ai-1","content":"hello","done":false,"contentType":"content"}\n\n',
    ]), { onMessage, onComplete });

    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onMessage).toHaveBeenCalledWith('ai-1', 'hello', false, 'content');
  });

  it('supports legacy reasoning/content markers', async () => {
    const onMessage = vi.fn();

    createSSEReader(responseFromChunks([
      'data: {"nodeId":"ai-1","content":"[REASONING_DELTA]thinking","done":false}\n\n',
      'data: {"nodeId":"ai-1","content":"[CONTENT_DELTA]answer","done":true}\n\n',
    ]), { onMessage });

    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(2));
    expect(onMessage).toHaveBeenNthCalledWith(1, 'ai-1', 'thinking', false, 'reasoning');
    expect(onMessage).toHaveBeenNthCalledWith(2, 'ai-1', 'answer', true, 'content');
  });

  it('routes parsed errors to onError', async () => {
    const onMessage = vi.fn();
    const onError = vi.fn();

    createSSEReader(responseFromChunks([
      'data: {"nodeId":"ai-1","error":"boom","done":true}\n\n',
    ]), { onMessage, onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
    expect(onMessage).not.toHaveBeenCalled();
  });
});
