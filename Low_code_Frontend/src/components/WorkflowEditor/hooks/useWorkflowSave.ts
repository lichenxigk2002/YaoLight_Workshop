import { useCallback, useState } from 'react';
import { Node, Edge } from 'reactflow';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { workflowApi } from '@/api/workflow';
import {
  transformNodesToSaveFormat,
  transformEdgesToSaveFormat,
  transformCommentCardsToSaveFormat,
  transformNodesFromLoadFormat,
  transformCommentCardsFromLoadFormat,
  transformEdgesFromLoadFormat,
} from '@/utils/workflowTransformers';

/**
 * 工作流保存和加载Hook
 */
export function useWorkflowSave(
  workflowId: string | undefined,
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  getNodeLabel: (type: string) => string,
  updateNodeIdCounter: (nodes: Node[]) => void,
  templateId: number | null,
  setTemplateId: (templateId: number | null) => void
) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  /**
   * 加载工作流节点和边
   */
  const loadWorkflowNodes = useCallback(async () => {
    if (!workflowId) return;

    try {
      const response = await workflowApi.getWorkflowNodes(Number(workflowId));

      const allNodes: Node[] = [];

      // 加载节点
      if (response.nodes && response.nodes.length > 0) {
        const loadedNodes = transformNodesFromLoadFormat(response.nodes, getNodeLabel);
        allNodes.push(...loadedNodes);
      }

      // 加载注释卡片
      if (response.commentCards && response.commentCards.length > 0) {
        const loadedCommentCards = transformCommentCardsFromLoadFormat(response.commentCards);
        allNodes.push(...loadedCommentCards);
      }

      // 转换边格式
      const loadedEdges = transformEdgesFromLoadFormat(response.edges || []);

      setNodes(allNodes);
      setEdges(loadedEdges);
      setTemplateId(response.templateId ?? null);

      // 更新节点ID计数器
      updateNodeIdCounter(allNodes);
    } catch (error: any) {
      message.error(
        t('node.messages.loadFailed', {
          error: error.message || t('workflowEditor.unknownError'),
        })
      );
    }
  }, [workflowId, setNodes, setEdges, getNodeLabel, updateNodeIdCounter, setTemplateId, message, t]);

  /**
   * 保存工作流（内部函数）
   * @param silent 是否静默保存
   * @param overrideNodes 可选：覆盖当前状态的节点数据
   * @param overrideEdges 可选：覆盖当前状态的边数据
   */
  const saveWorkflowInternal = useCallback(
    async (silent: boolean = false, overrideNodes?: Node[], overrideEdges?: Edge[]) => {
      if (!workflowId) {
        if (!silent) {
          message.warning(t('workflowEditor.workflowIdMissing') || '工作流ID不存在，无法保存');
        }
        return false;
      }

      const nodesToSave = overrideNodes || nodes;
      const edgesToSave = overrideEdges || edges;

      try {
        setIsSaving(true);

        // 转换数据格式
        const nodesData = transformNodesToSaveFormat(nodesToSave);
        const commentCardsData = transformCommentCardsToSaveFormat(nodesToSave);
        const edgesData = transformEdgesToSaveFormat(edgesToSave, nodesToSave);

        await workflowApi.saveWorkflowNodes(Number(workflowId), {
          nodes: nodesData,
          edges: edgesData,
          commentCards: commentCardsData,
          templateId: templateId ?? undefined,
        });

        if (!silent) {
          setLastSaveTime(new Date()); // 只有手动保存时才显示保存时间
          message.success(t('workflowEditor.saveSuccess') || '工作流已保存');
        }
        return true;
      } catch (error: any) {
        if (!silent) {
          message.error(
            t('workflowEditor.saveFailed') || '保存工作流失败: ' + (error.message || '未知错误')
          );
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [workflowId, nodes, edges, message, t, templateId]
  );

  /**
   * 手动保存工作流
   */
  const handleSave = useCallback(async () => {
    await saveWorkflowInternal(false);
  }, [saveWorkflowInternal]);

  return {
    isSaving,
    lastSaveTime,
    loadWorkflowNodes,
    saveWorkflowInternal,
    handleSave,
  };
}

