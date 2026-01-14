import { useCallback, useRef, useState } from 'react';
import { Node, Edge } from 'reactflow';
import { message, notification } from 'antd';
import { useTranslation } from 'react-i18next';
import { workflowApi } from '@/api/workflow';
import { prepareExecutionData } from '@/utils/workflowTransformers';
import { validateWorkflowBeforeExecute } from '@/utils/workflowValidators';
import React from 'react';
import { Button } from 'antd';

/**
 * 工作流执行Hook
 */
export function useWorkflowExecute(
  nodes: Node[],
  edges: Edge[],
  setExecutionResult: (result: any) => void,
  setResultPanelVisible: (visible: boolean) => void,
  setConfigPanelVisible: (visible: boolean) => void,
  setSelectedNode: (node: Node | null) => void,
  updateNodesExecutionStatus: (statusMap: Map<string, 'success' | 'failed' | 'pending'>) => void,
  workflowId?: string
) {
  const { t } = useTranslation();
  const cancelStreamRef = useRef<(() => void) | null>(null); // 保存当前流式执行的取消函数
  const [isExecuting, setIsExecuting] = useState(false); // 是否正在执行中

  /**
   * 执行工作流
   */
  const handleRun = useCallback(async () => {
    // 如果上一次流式执行还在进行，先取消它
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
      setIsExecuting(false);
      // 关闭之前的通知
      notification.destroy('workflow-stream-start');
      notification.destroy('workflow-exec-success');
      message.info('已取消上一次执行，开始新的执行');
    }

    // 验证工作流
    const validation = validateWorkflowBeforeExecute(nodes, edges, t);
    if (!validation.valid) {
      message.warning(validation.message);
      return;
    }

    message.info(t('workflowEditor.executing'));

    try {
      // 如果有workflowId，从数据库加载配置执行；否则使用内存中的配置
      let executionData: any;
      if (workflowId) {
        // 从数据库加载配置执行
        executionData = {
          workflowId: Number(workflowId),
        };
      } else {
        // 使用内存中的配置
        executionData = prepareExecutionData(nodes, edges);
      }

      // 总是使用流式执行接口，以便实时显示所有节点的执行结果
      // 这样所有节点都可以一个一个显示，而不是等所有节点执行完才显示
      const useStreaming = true; // 总是使用流式执行

      if (useStreaming) {
        // 使用流式执行
        const resultMap = new Map<string, 'success' | 'failed' | 'pending'>();

        // 初始化所有节点为pending
        // 如果有workflowId，需要从数据库加载节点列表；否则使用内存中的nodes
        let allNodes = nodes;
        if (workflowId) {
          try {
            const workflowNodes = await workflowApi.getWorkflowNodes(Number(workflowId));
            allNodes = (workflowNodes.nodes || []).map((node: any) => ({
              id: node.id,
              type: node.type,
              data: node.data,
            })) as Node[];
          } catch (error) {
            console.error('加载工作流节点失败:', error);
          }
        }
        allNodes.forEach((node: Node) => {
          if (node.data?.type !== 'comment' && node.type !== 'comment') {
            resultMap.set(node.id, 'pending');
          }
        });
        updateNodesExecutionStatus(resultMap);

        // 收集所有结果
        const results: any[] = [];
        let isComplete = false;
        let hasShownStartNotification = false; // 标记是否已显示开始通知

        await new Promise<void>((resolve, reject) => {
          // 保存取消函数
          const cancelStream = workflowApi.executeWorkflowStream(
            executionData,
            (nodeId, content, done, contentType) => {
              // 如果是节点结果事件（所有节点执行完成，包含完整结果数据）
              if (contentType === 'node_result') {
                try {
                  // 解析节点执行结果
                  const nodeResult = JSON.parse(content);
                  // 查找或创建结果项
                  let resultItem = results.find(r => r.node_id === nodeId);
                  if (!resultItem) {
                    resultItem = {
                      node_id: nodeId,
                      type: nodeResult.type || 'unknown',
                      success: nodeResult.success || false,
                      data: nodeResult.data || {},
                      error: nodeResult.error,
                    };
                    results.push(resultItem);
                  } else {
                    // 更新现有结果
                    resultItem.type = nodeResult.type || resultItem.type;
                    resultItem.success = nodeResult.success || false;
                    resultItem.data = nodeResult.data || resultItem.data;
                    resultItem.error = nodeResult.error || resultItem.error;
                  }

                  // 更新节点状态
                  resultMap.set(nodeId, nodeResult.success ? 'success' : 'failed');
                  updateNodesExecutionStatus(resultMap);

                  // 如果是第一个节点结果，显示开始通知
                  if (!hasShownStartNotification) {
                    hasShownStartNotification = true;

                    // 显示开始通知
                    const showResultPanel = () => {
                      setResultPanelVisible(true);
                      setConfigPanelVisible(false);
                      setSelectedNode(null);
                    };

                    const viewButton = React.createElement(
                      Button,
                      {
                        type: 'default',
                        size: 'small',
                        style: {
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-secondary)',
                        },
                        onClick: (e: React.MouseEvent) => {
                          e.stopPropagation();
                          showResultPanel();
                        },
                      },
                      t('workflowEditor.viewResult') || '查看结果'
                    );

                    notification.info({
                      message: t('workflowEditor.executing') || '工作流执行中',
                      description: '节点正在执行，点击查看结果实时查看',
                      placement: 'bottomRight',
                      icon: null,
                      onClick: showResultPanel,
                      btn: viewButton,
                      duration: 0, // 不自动关闭
                      key: 'workflow-stream-start', // 添加key，避免重复显示
                    });
                  }

                  // 实时更新执行结果
                  setExecutionResult({
                    success: true,
                    results: [...results],
                  });

                  return;
                } catch (error) {
                  console.error('解析节点结果失败:', error, content);
                  // 如果解析失败，至少更新节点状态
                  resultMap.set(nodeId, 'success');
                  updateNodesExecutionStatus(resultMap);
                  return;
                }
              }

              // 如果是节点完成事件（兼容旧版本）
              if (contentType === 'node_complete') {
                // 更新节点状态为成功
                resultMap.set(nodeId, 'success');
                updateNodesExecutionStatus(resultMap);
                return;
              }

              // 如果是第一个流式数据，显示开始通知
              if (!hasShownStartNotification && content) {
                hasShownStartNotification = true;

                // 显示开始通知
                const showResultPanel = () => {
                  setResultPanelVisible(true);
                  setConfigPanelVisible(false);
                  setSelectedNode(null);
                };

                const viewButton = React.createElement(
                  Button,
                  {
                    type: 'default',
                    size: 'small',
                    style: {
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-secondary)',
                    },
                    onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      showResultPanel();
                    },
                  },
                  t('workflowEditor.viewResult') || '查看结果'
                );

                notification.info({
                  message: t('workflowEditor.executing') || '工作流执行中',
                  description: '节点正在执行，点击查看结果实时查看',
                  placement: 'bottomRight',
                  icon: null,
                  onClick: showResultPanel,
                  btn: viewButton,
                  duration: 0, // 不自动关闭
                  key: 'workflow-stream-start', // 添加key，避免重复显示
                });
              }

              // 查找或创建结果项（针对AI节点的流式内容）
              let resultItem = results.find(r => r.node_id === nodeId);
              if (!resultItem) {
                // 找到节点类型
                const node = allNodes.find(n => n.id === nodeId);
                const nodeType = node?.data?.type || node?.type || 'ai';

                resultItem = {
                  node_id: nodeId,
                  type: nodeType,
                  success: true,
                  data: nodeType === 'ai' ? { content: '', reasoningContent: '' } : {},
                };
                results.push(resultItem);
                // 更新节点状态为执行中
                resultMap.set(nodeId, 'success');
                updateNodesExecutionStatus(resultMap);
              }

              // 增量更新内容（只针对AI节点的流式内容）
              if (contentType === 'reasoning') {
                resultItem.data.reasoningContent = (resultItem.data.reasoningContent || '') + content;
              } else if (contentType === 'content') {
                resultItem.data.content = (resultItem.data.content || '') + content;
              } else if (!contentType || contentType === '') {
                // 默认作为正式内容
                resultItem.data.content = (resultItem.data.content || '') + content;
              }

              // 实时更新执行结果（结果面板已经打开，实时显示流式内容）
              setExecutionResult({
                success: true,
                results: [...results],
              });

              // 如果完成，标记为完成
              if (done && !isComplete) {
                isComplete = true;
                cancelStreamRef.current = null; // 清除取消函数
                setIsExecuting(false); // 标记为执行完成
                resolve();
              }
            },
            (error) => {
              console.error('流式执行错误:', error);
              cancelStreamRef.current = null; // 清除取消函数
              setIsExecuting(false); // 标记为执行完成
              // 更新所有pending节点为failed
              resultMap.forEach((status, nodeId) => {
                if (status === 'pending') {
                  resultMap.set(nodeId, 'failed');
                }
              });
              updateNodesExecutionStatus(resultMap);

              // 更新结果，显示错误
              setExecutionResult({
                success: false,
                results: results.map(r => ({
                  ...r,
                  success: r.node_id === results[0]?.node_id ? false : r.success,
                  error: r.node_id === results[0]?.node_id ? error : r.error,
                })),
              });

              reject(new Error(error));
            },
            () => {
              // 完成回调
              cancelStreamRef.current = null; // 清除取消函数
              setIsExecuting(false); // 标记为执行完成
              if (!isComplete) {
                isComplete = true;
                resolve();
              }
            }
          );

          // 保存取消函数到ref
          cancelStreamRef.current = cancelStream;
          setIsExecuting(true); // 标记为正在执行
        });

        // 构建最终结果
        const result = {
          success: true,
          results: results,
        };

        // 计算执行的节点总数（包括上游节点和AI节点）
        const totalNodeCount = resultMap.size;

        // 显示通知的函数
        const showResultPanel = () => {
          setResultPanelVisible(true);
          setConfigPanelVisible(false);
          setSelectedNode(null);
        };

        const resultButton = React.createElement(
          Button,
          {
            type: 'default',
            size: 'small',
            style: {
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-secondary)',
            },
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              showResultPanel();
            },
          },
          t('workflowEditor.viewResult')
        );

        // 立即显示通知（不等待setState完成）
        notification.success({
          message: t('workflowEditor.execSuccessTitle') || '工作流执行完成',
          description: t('workflowEditor.execSuccessDesc', { count: totalNodeCount }) || `共执行 ${totalNodeCount} 个节点`,
          placement: 'bottomRight',
          icon: null,
          onClick: showResultPanel,
          btn: resultButton,
          duration: 0, // 不自动关闭，让用户手动关闭或点击查看结果
          key: 'workflow-exec-success', // 添加key，避免重复显示
        });

        // 保存最终执行结果（在通知显示之后）
        setExecutionResult(result);
      } else {
        // 使用普通执行接口
        const result = await workflowApi.executeWorkflow(executionData);

        // 保存执行结果
        setExecutionResult(result);

        // 更新各节点执行状态
        const resultMap = new Map<string, 'success' | 'failed' | 'pending'>();
        (result.results || []).forEach((r: any) => {
          if (r && r.node_id) {
            resultMap.set(r.node_id, r.success ? 'success' : 'failed');
          }
        });
        updateNodesExecutionStatus(resultMap);

        // 显示通知
        const showResultPanel = () => {
          setResultPanelVisible(true);
          setConfigPanelVisible(false);
          setSelectedNode(null);
        };

        const resultButton = React.createElement(
          Button,
          {
            type: 'default',
            size: 'small',
            style: {
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-secondary)',
            },
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              showResultPanel();
            },
          },
          t('workflowEditor.viewResult')
        );

        if (result.success) {
          notification.success({
            message: t('workflowEditor.execSuccessTitle'),
            description: t('workflowEditor.execSuccessDesc', { count: result.results.length }),
            placement: 'bottomRight',
            icon: null,
            onClick: showResultPanel,
            btn: resultButton,
          });
        } else {
          notification.warning({
            message: t('workflowEditor.execPartialTitle'),
            description: t('workflowEditor.execPartialDesc'),
            placement: 'bottomRight',
            icon: null,
            onClick: showResultPanel,
            btn: resultButton,
          });
        }
      }
    } catch (error: any) {
      message.error(
        t('workflowEditor.execFailed', {
          error: error.message || t('workflowEditor.unknownError'),
        })
      );
    }
  }, [
    nodes,
    edges,
    t,
    setExecutionResult,
    updateNodesExecutionStatus,
    setResultPanelVisible,
    setConfigPanelVisible,
    setSelectedNode,
    workflowId,
  ]);

  // 取消当前执行的函数
  const handleCancel = useCallback(() => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
      setIsExecuting(false); // 标记为执行完成
      // 关闭通知
      notification.destroy('workflow-stream-start');
      notification.destroy('workflow-exec-success');
      message.info('已中止执行');
    }
  }, []);

  return {
    handleRun,
    handleCancel,
    isExecuting,
  };
}

