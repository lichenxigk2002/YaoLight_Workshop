import { useState, useRef } from 'react';
import { message } from 'antd';
import { workflowApi } from '@/api/workflow';
import type { Node, Edge } from 'reactflow';

export interface AIPreviewState {
  ai: any | null;
  raw: any;
  streamingContent?: string; // 流式正式内容
  streamingReasoningContent?: string; // 流式思考内容
  isStreaming?: boolean; // 是否正在流式输出
}

export function useAITest(node: Node | null, form: any, nodes: Node[] = [], edges: Edge[] = []) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<AIPreviewState | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingReasoningContent, setStreamingReasoningContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  const handleTestAI = async () => {
    try {
      const values = await form.validateFields();
      if (!node) return;

      const config: any = { ...values };
      // 删除不需要的字段
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
          const targetIsAI = edge.target === node.id;
          const targetIsUpstream = allUpstreamNodes.some(n => n.id === edge.target);

          if ((sourceIncluded && targetIsAI) || (sourceIncluded && targetIsUpstream)) {
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

      // 添加要测试的AI节点
      execReq.nodes.push({ id: node.id, type: node.data.type || 'ai', config });

      // 检查是否启用流式输出
      const enableStream = config.stream === true;

      if (enableStream) {
        // 流式执行
        setIsStreaming(true);
        setStreamingContent('');
        setStreamingReasoningContent('');
        setPreviewOpen(true);
        setPreviewData({
          ai: { node_id: node.id, type: 'ai', success: true, data: { content: '', reasoningContent: '' } },
          raw: { success: true, results: [] },
          streamingContent: '',
          streamingReasoningContent: '',
          isStreaming: true,
        });

        message.loading({ content: '正在流式测试AI节点...', key: 'aiTest', duration: 0 });

        let fullContent = '';
        let fullReasoningContent = '';
        let messageCount = 0;
        cancelStreamRef.current = workflowApi.executeWorkflowStream(
          execReq,
          (nodeId, content, done, contentType) => {
            messageCount++;
            console.log(`📥 [${messageCount}] 收到流式数据:`, { 
              nodeId, 
              content: content.substring(0, 50), 
              done, 
              contentType,
              contentLength: content.length 
            });
            
            if (nodeId === node.id) {
              // 根据内容类型累加到不同的变量
              if (contentType === 'reasoning') {
                fullReasoningContent += content;
                setStreamingReasoningContent(fullReasoningContent);
                console.log(`🧠 [${messageCount}] 思考内容累加:`, {
                  总长度: fullReasoningContent.length,
                  新增: content.length,
                  内容预览: fullReasoningContent.substring(0, 100)
                });
              } else if (contentType === 'content') {
                fullContent += content;
                setStreamingContent(fullContent);
                console.log(`✅ [${messageCount}] 正式内容累加:`, {
                  总长度: fullContent.length,
                  新增: content.length,
                  内容预览: fullContent.substring(0, 100)
                });
              } else {
                // 没有类型标记，可能是done时的完整内容，需要解析
                if (done && (content.includes('[REASONING]') || content.includes('[CONTENT]'))) {
                  const reasoningMatch = content.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
                  const contentMatch = content.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/);
                  
                  // 注意：done消息可能只包含完整内容，不要覆盖已累加的内容
                  if (reasoningMatch) {
                    const extractedReasoning = reasoningMatch[1];
                    // 如果提取的内容比已累加的更长，说明这是完整内容，应该替换
                    if (extractedReasoning.length > fullReasoningContent.length) {
                      fullReasoningContent = extractedReasoning;
                      setStreamingReasoningContent(fullReasoningContent);
                      console.log('🧠 从done消息中提取完整思考内容:', fullReasoningContent.length);
                    } else {
                      console.log('🧠 done消息中的思考内容已包含在累加内容中，跳过');
                    }
                  }
                  if (contentMatch) {
                    const extractedContent = contentMatch[1];
                    // 如果提取的内容比已累加的更长，说明这是完整内容，应该替换
                    if (extractedContent.length > fullContent.length) {
                      fullContent = extractedContent;
                      setStreamingContent(fullContent);
                      console.log('✅ 从done消息中提取完整正式内容:', fullContent.length);
                    } else {
                      console.log('✅ done消息中的正式内容已包含在累加内容中，跳过');
                    }
                  }
                } else {
                  // 向后兼容：没有标记的情况，默认作为正式内容
                  console.warn(`⚠️ [${messageCount}] 未识别内容类型，默认作为正式内容:`, content.substring(0, 30));
                  fullContent += content;
                  setStreamingContent(fullContent);
                }
              }
              
              // 强制更新状态
              setIsStreaming(!done);
              setPreviewData({
                streamingContent: fullContent,
                streamingReasoningContent: fullReasoningContent,
                isStreaming: !done,
                ai: {
                  node_id: node.id,
                  type: 'ai',
                  success: true,
                  data: {
                    content: fullContent,
                    reasoningContent: fullReasoningContent,
                    model: 'deepseek-chat',
                    tokensUsed: 0,
                  },
                },
                raw: { success: true, results: [] },
              });
              
              if (done) {
                console.log('🎉 流式输出完成，总计:', messageCount, '条消息');
                console.log('   思考内容长度:', fullReasoningContent.length);
                console.log('   正式内容长度:', fullContent.length);
                console.log('   思考内容预览:', fullReasoningContent.substring(0, 200));
                console.log('   正式内容预览:', fullContent.substring(0, 200));
                
                // 强制更新状态，确保UI显示最新内容
                setStreamingReasoningContent(fullReasoningContent);
                setStreamingContent(fullContent);
                setPreviewData({
                  streamingContent: fullContent,
                  streamingReasoningContent: fullReasoningContent,
                  isStreaming: false,
                  ai: {
                    node_id: node.id,
                    type: 'ai',
                    success: true,
                    data: {
                      content: fullContent,
                      reasoningContent: fullReasoningContent,
                      model: 'deepseek-chat',
                      tokensUsed: 0,
                    },
                  },
                  raw: { success: true, results: [] },
                });
                
                message.destroy('aiTest');
                message.success('AI节点流式测试完成');
              }
            }
          },
          (error) => {
            message.destroy('aiTest');
            setIsStreaming(false);
            message.error(`流式测试失败: ${error}`);
            setPreviewData(prev => ({
              ...prev!,
              isStreaming: false,
              ai: {
                ...prev!.ai!,
                success: false,
                error: error,
              },
            }));
          },
          () => {
            message.destroy('aiTest');
            setIsStreaming(false);
          }
        );
      } else {
        // 非流式执行
        message.loading({ content: '正在测试AI节点...', key: 'aiTest', duration: 0 });
        const result = await workflowApi.executeWorkflow(execReq);
        message.destroy('aiTest');

        if (!result.success) {
          message.error(result.error || 'AI节点测试执行失败');
        } else {
          const aiResult = result.results.find((r: any) => r.type === 'ai' && r.node_id === node.id);
          setPreviewData({
            ai: aiResult || null,
            raw: result,
            isStreaming: false,
          });
          setPreviewOpen(true);
          if (aiResult?.success) {
            message.success('AI节点测试成功');
          } else {
            message.warning(aiResult?.error || 'AI节点测试未成功');
          }
        }
      }
    } catch (e: any) {
      message.destroy('aiTest');
      setIsStreaming(false);
      message.error(e?.message || 'AI节点测试失败');
    }
  };

  // 取消流式输出
  const cancelStream = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
      setIsStreaming(false);
      message.info('已取消流式测试');
    }
  };

  return {
    previewOpen,
    setPreviewOpen,
    previewData,
    setPreviewData,
    handleTestAI,
    streamingContent,
    streamingReasoningContent,
    isStreaming,
    cancelStream,
  };
}

