import { useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { workflowApi } from '@/api/workflow';
import type { Node, Edge } from 'reactflow';

export interface PreviewState {
  crawler: any | null;
  dataclean: any | null;
  raw: any;
}

export function useCrawlerTest(
  node: Node | null, 
  form: any, 
  nodes: Node[] = [], 
  edges: Edge[] = [],
  buildNodeConfig?: () => Promise<any | null>,
  handleSaveForm?: (onSave: (nodeId: string, config: any) => void, onSaveToBackend?: () => Promise<boolean>, workflowId?: string) => Promise<boolean>,
  onSave?: (nodeId: string, config: any) => void
) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewState | null>(null);

  const handleTestCrawl = async () => {
    try {
      // 如果有 buildNodeConfig 函数，使用它来构建配置（会自动处理配置转换等）
      let config: any;
      if (buildNodeConfig) {
        config = await buildNodeConfig(true);
        if (!config) {
          return; // 验证失败或构建失败
        }
        
        // 自动保存配置（静默保存，不显示消息）
        if (handleSaveForm && onSave) {
          await handleSaveForm(onSave, undefined, undefined);
        }
      } else {
        // 兼容旧逻辑：直接从表单获取值
        const values = await form.validateFields();
        if (!node) return;
        config = { ...values };
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
      }
      
      if (!node) return;

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

      // 从表单获取测试清洗相关配置（这些字段不在节点配置中，只在测试时使用）
      const formValues = form.getFieldsValue();
      const testCleanEnable = !!formValues.testCleanEnable;
      if (testCleanEnable) {
        const cleanConfig = {
          cleanType: 'custom',
          removeHTML: formValues.testCleanRemoveHTML !== false,
          trim: formValues.testCleanTrim !== false,
          removeSpaces: true, // 测试时默认移除多余空格，让数据更干净
        };
        execReq.nodes.push({ id: 'clean', type: 'dataclean', config: cleanConfig });
        execReq.edges.push({ source: node.id, target: 'clean' });
      }

      message.loading({ content: t('node.crawlerTest.testing'), key: 'crawlTest', duration: 0 });

      // 使用流式接口，因为后端现在总是返回 SSE 格式
      const results: any[] = [];
      let hasError = false;
      let errorMessage = '';
      let isResolved = false; // 防止重复 resolve

      await new Promise<void>((resolve, reject) => {
        const cancelStream = workflowApi.executeWorkflowStream(
          execReq,
          (nodeId, content, done, contentType) => {
            // 处理节点结果
            if (contentType === 'node_result') {
              try {
                const nodeResult = JSON.parse(content);
                results.push({
                  node_id: nodeResult.node_id || nodeResult.NodeID,
                  type: nodeResult.type || nodeResult.Type,
                  success: nodeResult.success || nodeResult.Success,
                  data: nodeResult.data || nodeResult.Data || {},
                  error: nodeResult.error || nodeResult.Error,
                });
              } catch (e) {
                console.error('解析节点结果失败:', e, content);
              }
            }

            // 执行完成（done 为 true 时，通常表示最后一个消息）
            if (done && !isResolved) {
              isResolved = true;
              resolve();
            }
          },
          (error) => {
            if (!isResolved) {
              hasError = true;
              errorMessage = error;
              isResolved = true;
              reject(new Error(error));
            }
          },
          () => {
            // onComplete 回调，确保在流结束时 resolve（如果还没有 resolve）
            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          }
        );
      });

      message.destroy('crawlTest');

      // 构建响应格式
      const result = {
        success: !hasError,
        results: results,
        error: hasError ? errorMessage : undefined,
      };

      if (!result.success) {
        message.error(result.error || t('node.crawlerTest.execFailed'));
      } else {
        const crawlerResult = result.results?.find((r: any) => r.type === 'crawler' && r.node_id === node.id);
        const dataCleanResult = result.results?.find((r: any) => r.type === 'dataclean' && r.node_id === 'clean');

        const previewData = {
          crawler: crawlerResult || null,
          dataclean: dataCleanResult || null,
          raw: result,
        };

        setPreviewData(previewData);
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
      message.destroy('crawlTest');
      console.error('爬虫测试错误:', e);
      console.error('错误详情:', {
        message: e?.message,
        response: e?.response,
        code: e?.code,
        status: e?.response?.status,
        data: e?.response?.data,
      });

      // 提供更详细的错误信息
      let errorMessage = e?.message || t('node.crawlerTest.testFailed');
      if (e?.code === 'ECONNABORTED') {
        errorMessage = '请求超时，爬虫执行时间过长，请检查爬虫配置或增加超时时间';
      } else if (e?.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e?.response?.status) {
        errorMessage = `请求失败 (状态码: ${e.response.status})`;
      }

      message.error(errorMessage);
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
