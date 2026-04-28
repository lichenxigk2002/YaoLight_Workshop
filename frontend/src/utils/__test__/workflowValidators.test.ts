import type { Node } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { validateWorkflowBeforeExecute } from '../workflowValidators';

const t = (key: string, params?: Record<string, unknown>) => `${key}${params?.label ? `:${params.label}` : ''}`;

describe('validateWorkflowBeforeExecute', () => {
  it('rejects an empty workflow', () => {
    expect(validateWorkflowBeforeExecute([], [], t)).toEqual({
      valid: false,
      message: 'workflowEditor.addNodesFirst',
    });
  });

  it('rejects crawler nodes without url or urlVariable', () => {
    const nodes: Node[] = [
      { id: 'crawler-1', type: 'crawler', data: { type: 'crawler', label: 'Crawler', config: {} }, position: { x: 0, y: 0 } },
    ];

    expect(validateWorkflowBeforeExecute(nodes, [], t)).toEqual({
      valid: false,
      message: 'workflowEditor.crawlerUrlMissing:Crawler',
    });
  });

  it('accepts crawler nodes with direct url or variable url', () => {
    expect(validateWorkflowBeforeExecute([
      { id: 'crawler-1', type: 'crawler', data: { type: 'crawler', config: { url: 'https://example.com' } }, position: { x: 0, y: 0 } },
    ], [], t)).toEqual({ valid: true });

    expect(validateWorkflowBeforeExecute([
      { id: 'crawler-2', type: 'crawler', data: { type: 'crawler', config: { urlVariable: '{{start-1.url}}' } }, position: { x: 0, y: 0 } },
    ], [], t)).toEqual({ valid: true });
  });

  it('ignores comment cards during validation', () => {
    expect(validateWorkflowBeforeExecute([
      { id: 'comment-1', type: 'comment', data: { type: 'comment' }, position: { x: 0, y: 0 } },
    ], [], t)).toEqual({
      valid: false,
      message: 'workflowEditor.addNodesFirst',
    });
  });
});
