import type { Node } from 'reactflow';
import { describe, expect, it, vi } from 'vitest';
import {
  calculateMaxNodeId,
  extractNodeIdNumber,
  filterCommentCards,
  filterWorkflowNodes,
  generateRandomPosition,
  getDefaultConfig,
  isCommentNode,
} from '../nodeUtils';

describe('nodeUtils', () => {
  it('returns stable default configs for core node types', () => {
    expect(getDefaultConfig('start')).toMatchObject({ inputMode: 'manual', trigger: 'manual' });
    expect(getDefaultConfig('crawler')).toMatchObject({ method: 'GET', url: '' });
    expect(getDefaultConfig('ai')).toMatchObject({ modelMode: 'system', provider: 'deepseek' });
    expect(getDefaultConfig('unknown')).toEqual({});
  });

  it('identifies comment nodes by type or data.type', () => {
    expect(isCommentNode({ id: 'comment-1', type: 'comment', data: {}, position: { x: 0, y: 0 } })).toBe(true);
    expect(isCommentNode({ id: 'legacy-comment', data: { type: 'comment' }, position: { x: 0, y: 0 } } as Node)).toBe(true);
    expect(isCommentNode({ id: 'node-1', type: 'ai', data: {}, position: { x: 0, y: 0 } })).toBe(false);
  });

  it('filters workflow nodes and comment cards separately', () => {
    const nodes: Node[] = [
      { id: 'node-1', type: 'start', data: {}, position: { x: 0, y: 0 } },
      { id: 'comment-1', type: 'comment', data: {}, position: { x: 10, y: 10 } },
      { id: 'node-2', type: 'ai', data: {}, position: { x: 20, y: 20 } },
    ];

    expect(filterWorkflowNodes(nodes).map((node) => node.id)).toEqual(['node-1', 'node-2']);
    expect(filterCommentCards(nodes).map((node) => node.id)).toEqual(['comment-1']);
  });

  it('extracts numeric suffixes and calculates the largest node counter', () => {
    expect(extractNodeIdNumber('node-42')).toBe(42);
    expect(extractNodeIdNumber('comment-7')).toBe(7);
    expect(extractNodeIdNumber('custom-id')).toBe(0);

    expect(calculateMaxNodeId([
      { id: 'node-2', data: {}, position: { x: 0, y: 0 } },
      { id: 'comment-11', data: {}, position: { x: 0, y: 0 } },
      { id: 'custom', data: {}, position: { x: 0, y: 0 } },
    ] as Node[])).toBe(11);
  });

  it('generates positions inside the expected offset range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(generateRandomPosition()).toEqual({ x: 300, y: 300 });
  });
});
