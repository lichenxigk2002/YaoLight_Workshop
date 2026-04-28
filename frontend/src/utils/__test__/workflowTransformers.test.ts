import type { Edge, Node } from 'reactflow';
import { describe, expect, it } from 'vitest';
import {
  prepareExecutionData,
  transformCommentCardsFromLoadFormat,
  transformCommentCardsToSaveFormat,
  transformEdgesFromLoadFormat,
  transformEdgesToSaveFormat,
  transformNodesFromLoadFormat,
  transformNodesToSaveFormat,
} from '../workflowTransformers';

describe('workflowTransformers', () => {
  const getLabel = (type: string) => `label:${type}`;

  it('loads backend workflow nodes with labels, default config, and connection direction', () => {
    const nodes = transformNodesFromLoadFormat([
      { id: 'start-1', type: 'start', position: { x: 1, y: 2 }, data: { config: { trigger: 'manual' } } },
      { id: 'ai-1', type: 'ai', position: { x: 3, y: 4 }, data: { label: 'AI step', connectionDirection: 'horizontal' } },
    ], getLabel);

    expect(nodes[0]).toMatchObject({
      id: 'start-1',
      type: 'start',
      data: { label: 'label:start', type: 'start', config: { trigger: 'manual' }, connectionDirection: 'vertical' },
    });
    expect(nodes[1]).toMatchObject({
      id: 'ai-1',
      data: { label: 'AI step', connectionDirection: 'horizontal' },
    });
    expect(nodes[1].data.config).toMatchObject({ provider: 'deepseek' });
  });

  it('loads and saves comment cards separately from workflow nodes', () => {
    const comments = transformCommentCardsFromLoadFormat([
      { id: 'comment-1', type: 'comment', position: { x: 10, y: 20 }, data: { text: 'note', color: '#fff' } },
    ]);

    expect(comments[0]).toMatchObject({
      id: 'comment-1',
      type: 'comment',
      data: { type: 'comment', text: 'note', color: '#fff' },
      style: { width: 250, minHeight: 120 },
    });

    expect(transformCommentCardsToSaveFormat(comments)).toEqual([
      { id: 'comment-1', type: 'comment', position: { x: 10, y: 20 }, data: { text: 'note', color: '#fff' } },
    ]);
  });

  it('preserves edge handles and filters comment-card edges when saving', () => {
    const nodes: Node[] = [
      { id: 'condition-1', type: 'condition', data: { type: 'condition' }, position: { x: 0, y: 0 } },
      { id: 'ai-1', type: 'ai', data: { type: 'ai' }, position: { x: 0, y: 0 } },
      { id: 'comment-1', type: 'comment', data: { type: 'comment' }, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'condition-1-ai-1', source: 'condition-1', target: 'ai-1', sourceHandle: 'true' },
      { id: 'ai-1-comment-1', source: 'ai-1', target: 'comment-1' },
    ];

    expect(transformEdgesFromLoadFormat([
      { id: 'e1', source: 'condition-1', target: 'ai-1', sourceHandle: 'false', targetHandle: 'input-0' } as any,
    ])).toEqual([
      { id: 'e1', source: 'condition-1', target: 'ai-1', sourceHandle: 'false', targetHandle: 'input-0' },
    ]);

    expect(transformEdgesToSaveFormat(edges, nodes)).toEqual([
      { id: 'condition-1-ai-1', source: 'condition-1', target: 'ai-1', sourceHandle: 'true', targetHandle: undefined },
    ]);
  });

  it('converts React Flow graph into save and execution payloads without comments', () => {
    const nodes: Node[] = [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 0, y: 0 },
        data: { label: 'Start', type: 'start', config: { inputMode: 'manual' } },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 200, y: 0 },
        data: { label: 'Output', type: 'output', config: { format: 'json' } },
      },
      { id: 'comment-1', type: 'comment', position: { x: 50, y: 50 }, data: { type: 'comment', text: 'skip me' } },
    ];
    const edges: Edge[] = [{ id: 'start-1-output-1', source: 'start-1', target: 'output-1' }];

    expect(transformNodesToSaveFormat(nodes)).toHaveLength(2);
    expect(prepareExecutionData(nodes, edges)).toEqual({
      nodes: [
        { id: 'start-1', type: 'start', config: { inputMode: 'manual' } },
        { id: 'output-1', type: 'output', config: { format: 'json' } },
      ],
      edges: [{ id: 'start-1-output-1', source: 'start-1', target: 'output-1', sourceHandle: undefined, targetHandle: undefined }],
    });
  });
});
