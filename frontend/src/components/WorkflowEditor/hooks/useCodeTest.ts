import { useState } from 'react';
import { App } from 'antd';
import type { Edge, Node } from 'reactflow';
import { workflowApi } from '@/api/workflow';

export interface CodePreviewState {
  code: any | null;
  raw: any;
}

export function useCodeTest(
  node: Node | null,
  form: any,
  nodes: Node[] = [],
  edges: Edge[] = [],
  buildNodeConfig?: () => Promise<any | null>,
  handleSaveForm?: (onSave: (nodeId: string, config: any) => void, onSaveToBackend?: () => Promise<boolean>, workflowId?: string) => Promise<boolean>,
  onSave?: (nodeId: string, config: any) => void,
) {
  const { message } = App.useApp();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CodePreviewState | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestCode = async () => {
    try {
      let config: any;
      if (buildNodeConfig) {
        config = await buildNodeConfig(true);
        if (!config) return;
        if (handleSaveForm && onSave) {
          await handleSaveForm(onSave, undefined, undefined);
        }
      } else {
        const values = await form.validateFields();
        if (!node) return;
        config = { ...values };
        delete config.label;
        delete config.connectionDirection;
      }
      if (!node) return;

      const collectUpstreamNodes = (targetNodeId: string, collected: Set<string>): Node[] => {
        const upstreamEdges = edges.filter((edge) => edge.target === targetNodeId);
        const upstreamNodes: Node[] = [];
        upstreamEdges.forEach((edge) => {
          const upstreamNode = nodes.find((n) => n.id === edge.source);
          if (upstreamNode && !collected.has(upstreamNode.id)) {
            collected.add(upstreamNode.id);
            upstreamNodes.push(upstreamNode);
            upstreamNodes.push(...collectUpstreamNodes(upstreamNode.id, collected));
          }
        });
        return upstreamNodes;
      };

      const collectedNodeIds = new Set<string>();
      const allUpstreamNodes = collectUpstreamNodes(node.id, collectedNodeIds);
      const execReq: any = { nodes: [], edges: [] };

      if (allUpstreamNodes.length > 0) {
        allUpstreamNodes.forEach((upstreamNode) => {
          execReq.nodes.push({
            id: upstreamNode.id,
            type: upstreamNode.data?.type || upstreamNode.type || 'start',
            config: upstreamNode.data?.config || {},
          });
        });
        edges.forEach((edge) => {
          const sourceIncluded = allUpstreamNodes.some((n) => n.id === edge.source);
          const targetIsCode = edge.target === node.id;
          const targetIsUpstream = allUpstreamNodes.some((n) => n.id === edge.target);
          if ((sourceIncluded && targetIsCode) || (sourceIncluded && targetIsUpstream)) {
            execReq.edges.push({
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
            });
          }
        });
      } else {
        execReq.nodes.push({
          id: 'start',
          type: 'start',
          config: {
            inputMode: 'manual',
            inputDataType: 'json',
            inputData: '{"sample":"hello code node"}',
          },
        });
        execReq.edges.push({ source: 'start', target: node.id });
      }

      execReq.nodes.push({ id: node.id, type: node.data.type || 'code', config });

      setIsTesting(true);
      message.loading({ content: '正在测试代码节点...', key: 'codeTest', duration: 0 });
      const { nodeResult, rawEvents } = await new Promise<{ nodeResult: any; rawEvents: any[] }>((resolve, reject) => {
        const rawEvents: any[] = [];
        let resolved = false;
        const cancel = workflowApi.executeWorkflowStream(
          execReq,
          (nodeId, content, done, contentType) => {
            rawEvents.push({ nodeId, content, done, contentType });

            if (contentType !== 'node_result' || nodeId !== node.id) {
              if (done && nodeId === 'workflow_complete' && !resolved) {
                resolved = true;
                reject(new Error('未返回代码节点执行结果'));
              }
              return;
            }

            try {
              const parsed = typeof content === 'string' ? JSON.parse(content) : content;
              if (!resolved) {
                resolved = true;
                cancel();
                resolve({
                  nodeResult: {
                    node_id: parsed?.node_id || nodeId,
                    type: parsed?.type || 'code',
                    success: parsed?.success !== false,
                    data: parsed?.data || {},
                    error: parsed?.error || '',
                  },
                  rawEvents,
                });
              }
            } catch {
              // Ignore parse errors until stream completes or a valid node_result arrives.
            }
          },
          (error) => {
            if (!resolved) {
              resolved = true;
              reject(new Error(error || '代码节点测试失败'));
            }
          },
          () => {
            if (!resolved) {
              resolved = true;
              reject(new Error('未返回代码节点执行结果'));
            }
          },
        );
      });

      setPreviewData({
        code: nodeResult,
        raw: rawEvents,
      });
      setPreviewOpen(true);
      message.success({ content: '代码节点测试完成', key: 'codeTest' });
    } catch (error: any) {
      message.error({ content: error?.message || '代码节点测试失败', key: 'codeTest' });
    } finally {
      setIsTesting(false);
    }
  };

  return {
    previewOpen,
    setPreviewOpen,
    previewData,
    isTesting,
    handleTestCode,
  };
}
