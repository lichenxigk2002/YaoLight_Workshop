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
  const [isReasoningStreaming, setIsReasoningStreaming] = useState(false); // 思考内容是否正在流式输出
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
        setIsReasoningStreaming(false); // 重置思考状态
        setStreamingContent('');
        setStreamingReasoningContent('');
        setPreviewOpen(true);
        setPreviewData({
          ai: { node_id: node.id, type: 'ai', success: true, data: { content: '', reasoningContent: '' } },
          raw: {
            success: true,
            results: [],
            request: execReq, // 保存请求配置
            streaming: true,
          },
          streamingContent: '',
          streamingReasoningContent: '',
          isStreaming: true,
        });

        message.loading({ content: '正在流式测试AI节点...', key: 'aiTest', duration: 0 });

        let fullContent = '';
        let fullReasoningContent = '';
        let messageCount = 0;
        let lastReasoningMessageTime = 0; // 记录最后一次收到思考内容的时间
        cancelStreamRef.current = workflowApi.executeWorkflowStream(
          execReq,
          (nodeId, content, done, contentType) => {
            messageCount++;

            if (nodeId === node.id) {
              // 根据内容类型累加到不同的变量
              if (contentType === 'reasoning') {
                fullReasoningContent += content;
                setStreamingReasoningContent(fullReasoningContent);
                setIsReasoningStreaming(true); // 正在输出思考内容
                lastReasoningMessageTime = Date.now(); // 更新最后思考内容时间
              } else if (contentType === 'content') {
                fullContent += content;
                setStreamingContent(fullContent);
                // 如果开始输出正式内容，说明思考内容已经完成
                if (fullReasoningContent.length > 0) {
                  setIsReasoningStreaming(false);
                }
              } else {
                // 没有类型标记，可能是done时的完整内容，需要解析
                if (done && (content.includes('[REASONING]') || content.includes('[CONTENT]'))) {
                  const reasoningMatch = content.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
                  const contentMatch = content.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/);

                  // 处理完整格式：只累加新增部分，避免重复
                  if (reasoningMatch) {
                    const extractedReasoning = reasoningMatch[1];
                    // 只累加新增的部分
                    if (extractedReasoning.length > fullReasoningContent.length) {
                      const newReasoning = extractedReasoning.substring(fullReasoningContent.length);
                      fullReasoningContent += newReasoning;
                      setStreamingReasoningContent(fullReasoningContent);
                    }
                  }
                  if (contentMatch) {
                    const extractedContent = contentMatch[1];
                    // 只累加新增的部分
                    if (extractedContent.length > fullContent.length) {
                      const newContent = extractedContent.substring(fullContent.length);
                      fullContent += newContent;
                      setStreamingContent(fullContent);
                    }
                  }
                } else {
                  // 向后兼容：没有标记的情况，默认作为正式内容
                  fullContent += content;
                  setStreamingContent(fullContent);
                  // 如果已经有思考内容，但收到的是没有类型标记的内容，可能是正式内容
                  // 如果距离最后一次思考内容超过一定时间（比如500ms），认为思考完成
                  if (fullReasoningContent.length > 0 && Date.now() - lastReasoningMessageTime > 500) {
                    setIsReasoningStreaming(false);
                  }
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
                raw: {
                  success: true,
                  results: [{
                    node_id: node.id,
                    type: 'ai',
                    success: true,
                    data: {
                      content: fullContent,
                      reasoningContent: fullReasoningContent,
                      model: 'deepseek-chat',
                      tokensUsed: 0,
                    },
                  }],
                  request: execReq,
                  streaming: !done,
                },
              });

              if (done) {
                // 全部完成，停止思考状态
                setIsReasoningStreaming(false);

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
                  raw: {
                    success: true,
                    results: [{
                      node_id: node.id,
                      type: 'ai',
                      success: true,
                      data: {
                        content: fullContent,
                        reasoningContent: fullReasoningContent,
                        model: 'deepseek-chat',
                        tokensUsed: 0,
                      },
                    }],
                    request: execReq,
                    streaming: false,
                  },
                });

                message.destroy('aiTest');
                message.success('AI节点流式测试完成');
              }
            }
          },
          (error) => {
            // 如果是取消操作，不显示错误消息
            if (error && error.includes && error.includes('aborted')) {
              return;
            }
            
            message.destroy('aiTest');
            setIsStreaming(false);
            setIsReasoningStreaming(false);
            
            // 只有真正的错误才显示错误消息
            if (error && !error.includes('canceled') && !error.includes('aborted')) {
            message.error(`流式测试失败: ${error}`);
            }
            
            setPreviewData(prev => ({
              ...prev!,
              isStreaming: false,
              ai: {
                ...prev!.ai!,
                success: false,
                error: error,
              },
              raw: {
                ...prev!.raw,
                success: false,
                error: error,
                request: execReq,
                streaming: false,
              },
            }));
          },
          () => {
            message.destroy('aiTest');
            setIsStreaming(false);
          }
        );
      } else {
        // 非流式执行（但后端现在总是返回 SSE 格式，所以也需要使用流式接口）
        message.loading({ content: '正在测试AI节点...', key: 'aiTest', duration: 0 });

        const results: any[] = [];
        let hasError = false;
        let errorMessage = '';
        let isResolved = false; // 防止重复 resolve

        await new Promise<void>((resolve, reject) => {
          workflowApi.executeWorkflowStream(
            execReq,
            (_nodeId, content, done, contentType) => {
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

              // 执行完成
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

        message.destroy('aiTest');

        // 构建响应格式
        const result = {
          success: !hasError,
          results: results,
          error: hasError ? errorMessage : undefined,
        };

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
      
      // 更新所有相关状态
      setIsStreaming(false);
      setIsReasoningStreaming(false);
      
      // 销毁 loading 消息
      message.destroy('aiTest');
      
      // 更新预览数据状态
      setPreviewData(prev => ({
        ...prev!,
        isStreaming: false,
      }));
      
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
    isReasoningStreaming, // 导出思考内容流式状态
    cancelStream,
  };
}

