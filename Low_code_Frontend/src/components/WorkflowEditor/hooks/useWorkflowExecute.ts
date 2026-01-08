import { useCallback } from 'react';
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
  updateNodesExecutionStatus: (statusMap: Map<string, 'success' | 'failed' | 'pending'>) => void
) {
  const { t } = useTranslation();

  /**
   * 执行工作流
   */
  const handleRun = useCallback(async () => {
    // 验证工作流
    const validation = validateWorkflowBeforeExecute(nodes, edges, t);
    if (!validation.valid) {
      message.warning(validation.message);
      return;
    }

    message.info(t('workflowEditor.executing'));

    try {
      // 准备执行数据
      const executionData = prepareExecutionData(nodes, edges);

      // 调用后端API执行工作流
      const result = await workflowApi.executeWorkflow(executionData);

      console.log('执行结果:', result);

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
    } catch (error: any) {
      message.error(
        t('workflowEditor.execFailed', {
          error: error.message || t('workflowEditor.unknownError'),
        })
      );
      console.error('执行错误:', error);
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
  ]);

  return {
    handleRun,
  };
}

