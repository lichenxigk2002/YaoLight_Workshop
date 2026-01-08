import { useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { workflowApi } from '@/api/workflow';
import type { Node, Edge } from 'reactflow';

export interface PreviewState {
  crawler: any | null;
  dataclean: any | null;
  raw: any;
}

export function useCrawlerTest(node: Node | null, form: any, nodes: Node[] = [], edges: Edge[] = []) {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewState | null>(null);

  const handleTestCrawl = async () => {
    try {
      const values = await form.validateFields();
      if (!node) return;

      const config: any = { ...values };
      const parseJsonField = (field: string) => {
        const v = config[field];
        if (typeof v === 'string') {
          const s = v.trim();
          if (s.startsWith('{') && s.endsWith('}')) {
            try {
              config[field] = JSON.parse(s);
            } catch {
            }
          }
        }
      };
      parseJsonField('headers');
      parseJsonField('cookies');
      delete config.label;
      delete config.connectionDirection;

      // 递归查找所有上游节点（包括上游节点的上游节点）
      const collectUpstreamNodes = (targetNodeId: string, collected: Set<string>): Node[] => {
        const upstreamEdges = edges.filter(edge => edge.target === targetNodeId);
        const upstreamNodes: Node[] = [];
        
        upstreamEdges.forEach(edge => {
          const upstreamNode = nodes.find(n => n.id === edge.source);
          if (upstreamNode && !collected.has(upstreamNode.id)) {
            collected.add(upstreamNode.id);
            upstreamNodes.push(upstreamNode);
            // 递归查找上游节点的上游节点
            const deeperNodes = collectUpstreamNodes(upstreamNode.id, collected);
            upstreamNodes.push(...deeperNodes);
          }
        });
        
        return upstreamNodes;
      };

      const collectedNodeIds = new Set<string>();
      const allUpstreamNodes = collectUpstreamNodes(node.id, collectedNodeIds);

      const execReq: any = {
        nodes: [],
        edges: [],
      };

      // 如果有上游节点，使用上游节点的配置
      if (allUpstreamNodes.length > 0) {
        // 添加所有上游节点及其配置（按依赖顺序）
        allUpstreamNodes.forEach(upstreamNode => {
          execReq.nodes.push({
            id: upstreamNode.id,
            type: upstreamNode.data?.type || upstreamNode.type || 'start',
            config: upstreamNode.data?.config || {},
          });
        });
        
        // 添加所有相关的边
        edges.forEach(edge => {
          const sourceIncluded = allUpstreamNodes.some(n => n.id === edge.source);
          const targetIsCrawler = edge.target === node.id;
          const targetIsUpstream = allUpstreamNodes.some(n => n.id === edge.target);
          
          if ((sourceIncluded && targetIsCrawler) || (sourceIncluded && targetIsUpstream)) {
            execReq.edges.push({
              source: edge.source,
              target: edge.target,
            });
          }
        });
      } else {
        // 如果没有上游节点，创建一个默认的 start 节点
        execReq.nodes.push({ id: 'start', type: 'start', config: {} });
        execReq.edges.push({ source: 'start', target: node.id });
      }

      // 添加要测试的爬虫节点
      execReq.nodes.push({ id: node.id, type: node.data.type || 'crawler', config });

      const testCleanEnable = !!values.testCleanEnable;
      if (testCleanEnable) {
        const cleanConfig = {
          cleanType: 'custom',
          removeHTML: values.testCleanRemoveHTML !== false,
          trim: values.testCleanTrim !== false,
        };
        execReq.nodes.push({ id: 'clean', type: 'dataclean', config: cleanConfig });
        execReq.edges.push({ source: node.id, target: 'clean' });
      }

      message.loading({ content: t('node.crawlerTest.testing'), key: 'crawlTest', duration: 0 });
      const result = await workflowApi.executeWorkflow(execReq);
      message.destroy('crawlTest');

      if (!result.success) {
        message.error(result.error || t('node.crawlerTest.execFailed'));
      } else {
        const crawlerResult = result.results.find((r: any) => r.type === 'crawler' && r.node_id === node.id);
        const dataCleanResult = result.results.find((r: any) => r.type === 'dataclean' && r.node_id === 'clean');
        setPreviewData({
          crawler: crawlerResult || null,
          dataclean: dataCleanResult || null,
          raw: result,
        });
        setPreviewOpen(true);
        if (crawlerResult?.success) {
          if (dataCleanResult?.success) {
            message.success(t('node.crawlerTest.crawlAndCleanSuccess'));
          } else {
            message.success(t('node.crawlerTest.crawlSuccess'));
          }
        } else {
          message.warning(crawlerResult?.error || t('node.crawlerTest.crawlNotSuccess'));
        }
      }
    } catch (e: any) {
      message.error(e?.message || t('node.crawlerTest.testFailed'));
    }
  };

  return {
    previewOpen,
    setPreviewOpen,
    previewData,
    setPreviewData,
    handleTestCrawl,
  };
}
