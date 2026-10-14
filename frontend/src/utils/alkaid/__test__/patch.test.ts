import type { Edge, Node } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { applyPatchForPreview, getFinalGraphFromPreview, type PatchItemExt } from '../patch';

const baseNodes: Node[] = [
  { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', type: 'start', config: {} } },
  { id: 'ai-1', type: 'ai', position: { x: 200, y: 0 }, data: { label: 'AI', type: 'ai', config: { prompt: 'old' } } },
  { id: 'merge-1', type: 'merge', position: { x: 400, y: 0 }, data: { label: 'Merge', type: 'merge', config: {} } },
];

const baseEdges: Edge[] = [
  { id: 'start-1-ai-1', source: 'start-1', target: 'ai-1' },
];

function patch(item: Partial<PatchItemExt> & Pick<PatchItemExt, 'op'>): PatchItemExt {
  return {
    id: item.id || `patch-${item.op}`,
    selected: item.selected ?? true,
    targetType: item.targetType || 'node',
    ...item,
  } as PatchItemExt;
}

describe('Alkaid patch preview', () => {
  it('adds new nodes and marks them as add', () => {
    const result = applyPatchForPreview(baseNodes, baseEdges, [
      patch({
        op: 'add',
        node: { id: 'output-1', type: 'output', position: { x: 400, y: 0 }, data: { config: { format: 'json' } } },
      }),
    ], (type) => `label:${type}`);

    expect(result.nodes.map((node) => node.id)).toContain('output-1');
    expect(result.nodeMark['output-1']).toBe('add');
    expect(result.nodes.find((node) => node.id === 'output-1')?.data.label).toBe('label:output');
  });

  it('marks removed nodes and connected edges, then strips them from final graph', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({ op: 'remove', nodeId: 'ai-1' }),
    ]);

    expect(preview.nodeMark['ai-1']).toBe('remove');
    expect(preview.edgeMark['start-1-ai-1']).toBe('remove');

    const finalGraph = getFinalGraphFromPreview(preview);
    expect(finalGraph.nodes.map((node) => node.id)).toEqual(['start-1', 'merge-1']);
    expect(finalGraph.edges).toEqual([]);
  });

  it('updates node data and position without mutating the original graph', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({ op: 'set', nodeId: 'ai-1', path: 'data', value: { label: 'Updated AI', type: 'ai', config: { prompt: 'new' } } }),
      patch({ op: 'set', nodeId: 'ai-1', path: 'position', value: { x: 300, y: 40 } }),
    ]);

    const updated = preview.nodes.find((node) => node.id === 'ai-1');
    expect(updated?.data).toEqual({ label: 'Updated AI', type: 'ai', config: { prompt: 'new' } });
    expect(updated?.position).toEqual({ x: 300, y: 40 });
    expect(preview.nodeMark['ai-1']).toBe('update');
    expect(baseNodes[1].data.config.prompt).toBe('old');
    expect(baseNodes[1].position).toEqual({ x: 200, y: 0 });
  });

  it('previews edge replacement and keeps only target edges in final graph', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({
        op: 'set_edges',
        targetType: 'graph',
        value: [{ id: 'ai-1-start-1', source: 'ai-1', target: 'start-1' }],
      }),
    ]);

    expect(preview.edgeMark['start-1-ai-1']).toBe('remove');
    expect(preview.edgeMark['ai-1-start-1']).toBe('add');

    const finalGraph = getFinalGraphFromPreview(preview);
    expect(finalGraph.edges.map((edge) => edge.id)).toEqual(['ai-1-start-1']);
    expect(finalGraph.edges[0].animated).toBe(false);
  });

  it('replaces reused edge ids when endpoints change', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({
        op: 'set_edges',
        targetType: 'graph',
        value: [{ id: 'start-1-ai-1', source: 'ai-1', target: 'start-1' }],
      }),
    ]);

    expect(preview.edgeMark['start-1-ai-1']).toBe('update');

    const finalGraph = getFinalGraphFromPreview(preview);
    expect(finalGraph.edges).toMatchObject([
      { id: 'start-1-ai-1', source: 'ai-1', target: 'start-1' },
    ]);
  });

  it('ignores unselected patches', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({ op: 'remove', nodeId: 'ai-1', selected: false }),
    ]);

    expect(preview.nodeMark).toEqual({});
    expect(getFinalGraphFromPreview(preview).nodes.map((node) => node.id)).toEqual(['start-1', 'ai-1', 'merge-1']);
  });

  it('clears every edge when set_edges is empty', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({ op: 'set_edges', targetType: 'graph', value: [] }),
    ]);

    expect(preview.edgeMark['start-1-ai-1']).toBe('remove');
    expect(getFinalGraphFromPreview(preview).edges).toEqual([]);
  });

  it('keeps parallel handled edges distinct when ids are omitted', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({
        op: 'set_edges',
        targetType: 'graph',
        value: [
          { source: 'start-1', target: 'merge-1', sourceHandle: 'true', targetHandle: 'input-0' },
          { source: 'start-1', target: 'merge-1', sourceHandle: 'false', targetHandle: 'input-1' },
        ],
      }),
    ]);

    const finalGraph = getFinalGraphFromPreview(preview);
    expect(finalGraph.edges).toMatchObject([
      { id: 'start-1-merge-1-true-input-0', source: 'start-1', target: 'merge-1', sourceHandle: 'true', targetHandle: 'input-0' },
      { id: 'start-1-merge-1-false-input-1', source: 'start-1', target: 'merge-1', sourceHandle: 'false', targetHandle: 'input-1' },
    ]);
  });

  it('drops target edges pointing at missing nodes before saving', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({
        op: 'set_edges',
        targetType: 'graph',
        value: [
          { id: 'start-1-missing-1', source: 'start-1', target: 'missing-1' },
          { id: 'start-1-ai-1', source: 'start-1', target: 'ai-1' },
        ],
      }),
    ]);

    expect(getFinalGraphFromPreview(preview).edges).toEqual([
      { id: 'start-1-ai-1', source: 'start-1', target: 'ai-1', style: {}, animated: false },
    ]);
  });

  it('removes set_edges entries that point at nodes removed by the same patch', () => {
    const preview = applyPatchForPreview(baseNodes, baseEdges, [
      patch({ op: 'remove', nodeId: 'ai-1' }),
      patch({
        op: 'set_edges',
        targetType: 'graph',
        value: [
          { id: 'start-1-ai-1', source: 'start-1', target: 'ai-1' },
          { id: 'start-1-merge-1', source: 'start-1', target: 'merge-1' },
        ],
      }),
    ]);

    expect(preview.edgeMark['start-1-ai-1']).toBe('remove');
    expect(getFinalGraphFromPreview(preview).edges.map((edge) => edge.id)).toEqual(['start-1-merge-1']);
  });
});
