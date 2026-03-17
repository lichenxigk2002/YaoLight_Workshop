import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  NodeTypes,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, Space, Dropdown, App, Modal, Input, List, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  SaveOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  DeploymentUnitOutlined,
  UploadOutlined,
  HistoryOutlined,
  DoubleRightOutlined,
  DoubleLeftOutlined,
} from '@ant-design/icons';
import NodePanel from './panels/NodePanel';
import NodeConfigPanel from './panels/NodeConfigPanel';
import ExecutionResultPanel from './panels/ExecutionResultPanel';
import TaskHistoryPanel from './panels/TaskHistoryPanel';
import TaskExecutionDetailModal from './panels/TaskExecutionDetailModal';
import type { Task, TaskNodeExecution } from '@/types/task';
import { validateNodeConnection } from './utils/nodeFormats';
import styles from './index.module.scss';
import { useThemeStore } from '@/store/theme';
import { isCommentNode } from '@/utils/nodeUtils';
import { exportWorkflow, importWorkflow } from '@/utils/workflowImportExport';
import { AlkaidAssistant } from '@/components/Alkaid';
import { transformNodesFromLoadFormat, transformEdgesFromLoadFormat, transformCommentCardsFromLoadFormat } from '@/utils/workflowTransformers';
import { 
  applyPatchForPreview, 
  getFinalGraphFromPreview, 
  PatchItemExt, 
  PatchPreviewResult 
} from '@/utils/alkaid/patch';
import { PatchItem } from '@/components/Alkaid/types/progress';
import { workflowApi } from '@/api/workflow';
import type { WorkflowTemplateLibraryItem } from '@/types/workflow';

// 瀵煎叆鑷畾涔塇ooks
import { useWorkflowNodes } from './hooks/useWorkflowNodes';
import { useWorkflowSave } from './hooks/useWorkflowSave';
import { useWorkflowExecute } from './hooks/useWorkflowExecute';
import { useWorkflowContextMenu } from './hooks/useWorkflowContextMenu';

// 瀵煎叆鍚勪釜鑺傜偣缁勪欢
import StartNode from './nodes/StartNode/StartNode';
import CrawlerNode from './nodes/CrawlerNode/CrawlerNode';
import DataCleanNode from './nodes/DataCleanNode/DataCleanNode';
import AINode from './nodes/AINode/AINode';
import ConditionNode from './nodes/ConditionNode/ConditionNode';
import TransformNode from './nodes/TransformNode/TransformNode';
import LoopNode from './nodes/LoopNode/LoopNode';
import MergeNode from './nodes/MergeNode/MergeNode';
import DelayNode from './nodes/DelayNode/DelayNode';
import OutputNode from './nodes/OutputNode/OutputNode';
import EndNode from './nodes/EndNode/EndNode';
import CommentCard from './nodes/CommentCard/CommentCard';

// 瀹氫箟鑺傜偣绫诲瀷鏄犲皠
const nodeTypes: NodeTypes = {
  start: StartNode,
  crawler: CrawlerNode,
  dataclean: DataCleanNode,
  ai: AINode,
  condition: ConditionNode,
  transform: TransformNode,
  loop: LoopNode,
  merge: MergeNode,
  delay: DelayNode,
  output: OutputNode,
  end: EndNode,
  comment: CommentCard,
};

// 鍒濆鑺傜偣鍜岃竟
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const WorkflowEditor: React.FC = () => {
  const { theme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { workflowId } = useParams<{ workflowId: string }>();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configPanelVisible, setConfigPanelVisible] = useState(false);
  const [resultPanelVisible, setResultPanelVisible] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [, setNodeRenderKey] = useState(0); // 鐢ㄤ簬寮哄埗閲嶆柊娓叉煋鑺傜偣
  const hasInitialized = useRef(false);
  const [autoTestNodeId, setAutoTestNodeId] = useState<string | null>(null);
  const [nodeListVisible, setNodeListVisible] = useState(false);
  const shouldFitViewAfterLoad = useRef(false); // 鐢ㄤ簬鏍囪鏄惁闇€瑕佸湪鍔犺浇鍚庤嚜鍔ㄥ眳涓?

  // 浠诲姟鍘嗗彶璁板綍鐩稿叧鐘舵€?
  const [historyVisible, setHistoryVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskExecutions, setTaskExecutions] = useState<TaskNodeExecution[]>([]);

  // 鎸夐挳缁勫睍寮€/鏀惰捣鐘舵€?
  const [buttonsExpanded, setButtonsExpanded] = useState(true);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateKeyword, setTemplateKeyword] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateImportingId, setTemplateImportingId] = useState<number | null>(null);
  const [templateItems, setTemplateItems] = useState<WorkflowTemplateLibraryItem[]>([]);

  const [workflowPreviewMode, setWorkflowPreviewMode] = useState<'none' | 'workflow'>('none');
  const originalWorkflowRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // Patch Preview State
  const [patchPreviewMode, setPatchPreviewMode] = useState<'none' | 'previewing'>('none');
  const [patchList, setPatchList] = useState<PatchItemExt[]>([]);
  const originalWorkflowForPatchRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const patchConfirmCallbackRef = useRef<(() => Promise<void>) | null>(null);

  const defaultViewport = React.useMemo(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0, zoom: 1 };
    const w = window.innerWidth;
    const zoom = w <= 1920 ? 0.9 : w <= 2560 ? 0.95 : 1;
    return { x: 0, y: 0, zoom };
  }, []);

  // 鑾峰彇鑺傜偣鏍囩锛堢敤浜庡伐鍏峰嚱鏁帮級
  const getNodeLabel = useCallback(
    (type: string): string => {
      return t(`node.shortLabels.${type}`, type);
    },
    [t]
  );

  // 浣跨敤鑺傜偣绠＄悊Hook
  const {
    addNode,
    addCommentCard,
    deleteNode: deleteNodeFromHook,
    updateNodeConfig,
    updateNodesExecutionStatus,
    clearAllExecutionStatus,
    updateNodeIdCounter,
  } = useWorkflowNodes(nodes, setNodes, getNodeLabel);

  // 浣跨敤淇濆瓨/鍔犺浇Hook
  const { lastSaveTime, loadWorkflowNodes, handleSave, saveWorkflowInternal } = useWorkflowSave(
    workflowId,
    nodes,
    edges,
    setNodes,
    setEdges,
    getNodeLabel,
    updateNodeIdCounter
  );

  // 鍖呰 setConfigPanelVisible锛屽湪鎵撳紑閰嶇疆闈㈡澘鏃跺叧闂巻鍙茶褰曢潰鏉?
  const handleSetConfigPanelVisible = useCallback((visible: boolean) => {
    setConfigPanelVisible(visible);
    if (visible) {
      setHistoryVisible(false);
    }
  }, []);

  // 鍖呰 setResultPanelVisible锛屽湪鎵撳紑缁撴灉闈㈡澘鏃跺叧闂巻鍙茶褰曢潰鏉?
  const handleSetResultPanelVisible = useCallback((visible: boolean) => {
    setResultPanelVisible(visible);
    if (visible) {
      setHistoryVisible(false);
    }
  }, []);

  // 浣跨敤鎵цHook
  const { handleRun: originalHandleRun, handleCancel, isExecuting } = useWorkflowExecute(
    nodes,
    edges,
    setExecutionResult,
    handleSetResultPanelVisible,
    handleSetConfigPanelVisible,
    setSelectedNode,
    updateNodesExecutionStatus,
    workflowId
  );

  // 鍖呰 handleRun锛屽湪鎵ц鏃跺叧闂巻鍙茶褰曢潰鏉?
  const handleRun = useCallback(() => {
    setHistoryVisible(false);
    originalHandleRun();
  }, [originalHandleRun]);

  const enterWorkflowPreview = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (!originalWorkflowRef.current) {
        originalWorkflowRef.current = { nodes, edges };
      }
      setNodes(newNodes);
      setEdges(newEdges);
      updateNodeIdCounter(newNodes);
      setWorkflowPreviewMode('workflow');
      message.success(
        t('workflowEditor.alkaid.previewWorkflowBanner')
      );
    },
    [nodes, edges, setNodes, setEdges, updateNodeIdCounter, message, t]
  );

  const handleConfirmWorkflowPreview = useCallback(async () => {
    const ok = await saveWorkflowInternal(false);
    if (ok) {
      originalWorkflowRef.current = null;
      setWorkflowPreviewMode('none');
    }
  }, [saveWorkflowInternal]);

  const handleCancelWorkflowPreview = useCallback(() => {
    if (originalWorkflowRef.current) {
      setNodes(originalWorkflowRef.current.nodes);
      setEdges(originalWorkflowRef.current.edges);
      updateNodeIdCounter(originalWorkflowRef.current.nodes);
    }
    originalWorkflowRef.current = null;
    setWorkflowPreviewMode('none');
  }, [setNodes, setEdges, updateNodeIdCounter]);

  // Update Graph with Preview Result (Apply Styles)
  const updateGraphWithPreview = useCallback((result: PatchPreviewResult) => {
      const styledNodes = result.nodes.map(n => {
          const mark = result.nodeMark[n.id];
          let style = { ...n.style };
          let data = { ...n.data, diffMark: mark }; // Inject diffMark into data for custom nodes

          if (mark === 'remove') {
              style.opacity = 0.7;
          }
          return { ...n, style, data };
      });

      const styledEdges = result.edges.map(e => {
          const mark = result.edgeMark[e.id];
          let style = { ...e.style };
          let animated = e.animated;
          // Inject diffMark into data if needed, but edges use style directly usually
          
          if (mark === 'add') {
              style.stroke = '#52c41a';
              style.strokeWidth = 2;
              animated = true;
          } else if (mark === 'remove') {
              style.stroke = '#ff4d4f';
              style.strokeWidth = 2;
              style.strokeDasharray = '5 5';
          } else if (mark === 'update') {
              style.stroke = '#faad14';
              style.strokeWidth = 2;
          }
          return { ...e, style, animated };
      });

      setNodes(styledNodes);
      setEdges(styledEdges);
      updateNodeIdCounter(styledNodes);
  }, [setNodes, setEdges, updateNodeIdCounter]);

  // Enter Patch Preview
  const handlePatchGenerated = useCallback((rawPatches: PatchItem[], onConfirm?: () => Promise<void>) => {
    patchConfirmCallbackRef.current = onConfirm || null;

    if (workflowPreviewMode === 'workflow') {
        handleCancelWorkflowPreview();
    }
    
    // Save original if not already saved
    if (!originalWorkflowForPatchRef.current) {
        originalWorkflowForPatchRef.current = { nodes, edges };
    }

    const extendedPatches = rawPatches.map((p, index) => ({
      ...p,
      id: `patch-${index}-${Date.now()}`,
      selected: true,
      targetType: p.op === 'set_edges' ? 'graph' : (p.node ? 'node' : (p.nodeId ? 'node' : 'graph')),
    })) as PatchItemExt[];

    setPatchList(extendedPatches);
    setPatchPreviewMode('previewing');
    
    // Apply initial preview
    const result = applyPatchForPreview(nodes, edges, extendedPatches, getNodeLabel);
    updateGraphWithPreview(result);
  }, [nodes, edges, workflowPreviewMode, handleCancelWorkflowPreview, getNodeLabel, updateGraphWithPreview]);

  // Cancel Patch Preview
  const handleCancelPatchPreview = useCallback(() => {
      if (originalWorkflowForPatchRef.current) {
          setNodes(originalWorkflowForPatchRef.current.nodes);
          setEdges(originalWorkflowForPatchRef.current.edges);
          updateNodeIdCounter(originalWorkflowForPatchRef.current.nodes);
      }
      originalWorkflowForPatchRef.current = null;
      setPatchList([]);
      setPatchPreviewMode('none');
      patchConfirmCallbackRef.current = null;
  }, [setNodes, setEdges, updateNodeIdCounter]);

  // Confirm Patch Preview
  const handleConfirmPatchPreview = useCallback(async () => {
      if (!originalWorkflowForPatchRef.current) return;

      const result = applyPatchForPreview(
          originalWorkflowForPatchRef.current.nodes, 
          originalWorkflowForPatchRef.current.edges, 
          patchList, 
          getNodeLabel
      );
      const finalGraph = getFinalGraphFromPreview(result);
      
      const ok = await saveWorkflowInternal(false, finalGraph.nodes, finalGraph.edges);
      if (ok) {
          // Explicitly update current state to the clean final graph
          setNodes(finalGraph.nodes);
          setEdges(finalGraph.edges);
          updateNodeIdCounter(finalGraph.nodes);

          originalWorkflowForPatchRef.current = null;
          setPatchList([]);
          setPatchPreviewMode('none');
          if (patchConfirmCallbackRef.current) {
              await patchConfirmCallbackRef.current();
              patchConfirmCallbackRef.current = null;
          }
      }
  }, [patchList, getNodeLabel, saveWorkflowInternal, setNodes, setEdges, updateNodeIdCounter]);

  // 浣跨敤鍙抽敭鑿滃崟Hook
  const {
    contextMenu,
    contextMenuRef,
    setContextMenu,
    onNodeContextMenu,
    onPaneContextMenu,
    handleContextMenuClick,
    getContextMenuItems,
  } = useWorkflowContextMenu(
    nodes,
    reactFlowInstance,
    addNode,
    addCommentCard,
    deleteNodeFromHook,
    updateNodeConfig,
    setSelectedNode,
    handleSetConfigPanelVisible,
    setResultPanelVisible,
    setAutoTestNodeId
  );

  // 杩炴帴鑺傜偣
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      if (!sourceNode || !targetNode) {
        message.error(t('node.messages.nodeNotFound'));
        return;
      }

      // 娉ㄩ噴鍗＄墖涓嶈兘杩炴帴
      if (isCommentNode(sourceNode) || isCommentNode(targetNode)) {
        message.warning(t('commentCard.cannotConnect'));
        return;
      }

      // 鑾峰彇鑺傜偣绫诲瀷
      const sourceType = sourceNode.type || sourceNode.data.type;
      const targetType = targetNode.type || targetNode.data.type;

      // 楠岃瘉鏍煎紡鍏煎鎬?
      const validation = validateNodeConnection(sourceType, targetType, t);

      if (!validation.compatible) {
        message.warning(validation.message || t('workflowEditor.unknownError'));
        return;
      }

      // 鏍煎紡鍏煎锛屽厑璁歌繛鎺?
      setEdges((eds) => addEdge(params, eds));
      message.success(t('node.messages.nodeConnected'));
    },
    [setEdges, nodes, t]
  );

  // 鑺傜偣鐐瑰嚮浜嬩欢
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // 娉ㄩ噴鍗＄墖涓嶆墦寮€閰嶇疆闈㈡澘
      if (isCommentNode(node)) {
        setSelectedNode(node);
        setConfigPanelVisible(false);
        setResultPanelVisible(false);
        setHistoryVisible(false);
        setContextMenu(null);
        return;
      }
      setSelectedNode(node);
      handleSetConfigPanelVisible(true);
      setResultPanelVisible(false);
      setContextMenu(null);
    },
    [setContextMenu]
  );

  // 鍒犻櫎鑺傜偣锛堝寘鍚竟娓呯悊鍜岄€変腑鐘舵€佸鐞嗭級
  const deleteNode = useCallback(
    (nodeId: string) => {
      deleteNodeFromHook(nodeId);
      // 鍚屾椂鍒犻櫎鐩稿叧鐨勮竟
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
        setConfigPanelVisible(false);
      }
      setContextMenu(null);
    },
    [deleteNodeFromHook, setEdges, selectedNode, setContextMenu]
  );

  // 鍒犻櫎鑺傜偣锛圧eactFlow鐨刼nNodesDelete锛?
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (deleted.length > 0) {
        // 鍚屾椂鍒犻櫎鐩稿叧鐨勮竟
        setEdges((eds) =>
          eds.filter(
            (edge) =>
              !deleted.find((node) => node.id === edge.source || node.id === edge.target)
          )
        );
        message.success(t('node.messages.nodesDeleted', { count: deleted.length }));
      }
    },
    [setEdges, t]
  );

  // 鍒犻櫎杩炵嚎锛圧eactFlow鐨刼nEdgesDelete锛?
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (deleted.length > 0) {
        message.success(t('node.messages.edgesDeleted', { count: deleted.length }));
      }
    },
    [t]
  );

  // 淇濆瓨鑺傜偣閰嶇疆
  const handleNodeConfigSave = useCallback(
    (nodeId: string, data: any) => {
      const oldNode = nodes.find((n) => n.id === nodeId);
      const nodeType = oldNode?.data?.type || oldNode?.type;
      const oldDirection = oldNode?.data.connectionDirection || 'vertical';
      const newDirection = data.connectionDirection || oldDirection;
      const hasDirectionChange =
        data.connectionDirection !== undefined && oldDirection !== newDirection;
      const oldMergeInputCount = Number(oldNode?.data?.config?.inputCount ?? 3);
      const newMergeInputCount = Number(data?.config?.inputCount ?? 3);
      const normalizedOldMergeInputCount = Number.isFinite(oldMergeInputCount)
        ? Math.min(5, Math.max(1, Math.trunc(oldMergeInputCount)))
        : 3;
      const normalizedNewMergeInputCount = Number.isFinite(newMergeInputCount)
        ? Math.min(5, Math.max(1, Math.trunc(newMergeInputCount)))
        : 3;
      const hasMergeInputCountChange =
        nodeType === 'merge' && normalizedOldMergeInputCount !== normalizedNewMergeInputCount;

      updateNodeConfig(nodeId, {
        label: data.label,
        connectionDirection: newDirection,
        config: data.config,
      });

      // 鍚屾鏇存柊 selectedNode锛岀‘淇濋厤缃潰鏉挎樉绀烘渶鏂扮殑鑺傜偣鏁版嵁
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => {
          if (!prev || prev.id !== nodeId) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              label: data.label,
              connectionDirection: newDirection,
              config: data.config,
            },
          };
        });
      }

      if (hasMergeInputCountChange) {
        setEdges((eds) =>
          eds.filter((edge) => {
            if (edge.target !== nodeId) return true;
            if (!edge.targetHandle) return true;
            const match = edge.targetHandle.match(/^input-(\d+)$/);
            if (!match) return true;
            return Number(match[1]) < normalizedNewMergeInputCount;
          })
        );
        setNodeRenderKey((prev) => prev + 1);
      }

      // 濡傛灉杩炴帴鏂瑰悜鏀瑰彉浜嗭紝寮哄埗閲嶆柊娓叉煋鎵€鏈夎妭鐐瑰拰杈?
      if (hasDirectionChange) {
        setNodeRenderKey((prev) => prev + 1);
        setTimeout(() => {
          setEdges((eds) =>
            eds.map((edge) => ({
              ...edge,
              id:
                edge.source === nodeId || edge.target === nodeId
                  ? `${edge.source}-${edge.target}-${Date.now()}`
                  : edge.id,
            }))
          );
        }, 100);
      }

      // 淇濆瓨鍚庝笉鍏抽棴閰嶇疆闈㈡澘锛屼繚鎸佹墦寮€鐘舵€?
    },
    [nodes, updateNodeConfig, setEdges, selectedNode]
  );

  // 瀵煎嚭宸ヤ綔娴?
  const handleExportWorkflow = useCallback(() => {
    if (nodes.length === 0 && edges.length === 0) {
      message.warning(t('workflowEditor.emptyWorkflowWarning'));
      return;
    }
    try {
      exportWorkflow(nodes, edges);
      message.success(t('workflowEditor.exportSuccess'));
    } catch (error: any) {
      message.error(t('workflowEditor.exportFailed') + ': ' + (error.message || t('workflowEditor.unknownError')));
    }
  }, [nodes, edges, t]);

  // 鑾峰彇褰撳墠宸ヤ綔娴侊紙鐢ㄤ簬 AI 涓婁笅鏂囷級
  const getCurrentWorkflow = useCallback(async () => {
    return {
      nodes: nodes,
      edges: edges,
    };
  }, [nodes, edges]);

  // 瀵煎叆宸ヤ綔娴?
  const handleImportWorkflow = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      message.warning(t('workflowEditor.clearBeforeImport'));
      return;
    }

    // 鍒涘缓闅愯棌鐨勬枃浠惰緭鍏ュ厓绱?
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const { nodes: importedNodes, edges: importedEdges } = await importWorkflow(file, getNodeLabel);
        setNodes(importedNodes);
        setEdges(importedEdges);
        updateNodeIdCounter(importedNodes);
        message.success(t('workflowEditor.importSuccess'));

        // 鑷姩閫傞厤瑙嗗浘
        setTimeout(() => {
          if (reactFlowInstance) {
            reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
          }
        }, 100);
      } catch (error: any) {
        message.error(t('workflowEditor.importFailed') + ': ' + (error.message || t('workflowEditor.unknownError')));
      } finally {
        // 娓呯悊
        document.body.removeChild(input);
      }
    };

    document.body.appendChild(input);
    input.click();
  }, [nodes, edges, setNodes, setEdges, updateNodeIdCounter, reactFlowInstance, getNodeLabel, t, message]);

  // 鍔犺浇宸ヤ綔娴佽妭鐐瑰拰杈?
  const loadTemplateLibrary = useCallback(async (keyword: string = '') => {
    try {
      setTemplateLoading(true);
      const response = await workflowApi.listPublishedTemplates({
        page: 1,
        pageSize: 20,
        keyword: keyword.trim() || undefined,
      });
      setTemplateItems(response?.list || []);
    } catch (error: any) {
      message.error(error.message || t('workflowEditor.templateLoadFailed'));
    } finally {
      setTemplateLoading(false);
    }
  }, [message, t]);

  const applyTemplateImport = useCallback(async (templateId: number) => {
    try {
      setTemplateImportingId(templateId);
      const response = await workflowApi.getPublishedTemplateNodes(templateId);
      const importedNodes: Node[] = [];
      if (response.nodes?.length) {
        importedNodes.push(...transformNodesFromLoadFormat(response.nodes, getNodeLabel));
      }
      if (response.commentCards?.length) {
        importedNodes.push(
          ...transformCommentCardsFromLoadFormat(
            response.commentCards.map((card) => ({ ...card, type: 'comment' }))
          )
        );
      }
      const importedEdges = transformEdgesFromLoadFormat(response.edges || []);
      setNodes(importedNodes);
      setEdges(importedEdges);
      updateNodeIdCounter(importedNodes);
      setTemplateModalVisible(false);
      message.success(t('workflowEditor.templateImported'));
      setTimeout(() => {
        reactFlowInstance?.fitView({ padding: 0.2, duration: 400 });
      }, 100);
    } catch (error: any) {
      message.error(error.message || t('workflowEditor.templateImportFailed'));
    } finally {
      setTemplateImportingId(null);
    }
  }, [getNodeLabel, message, reactFlowInstance, setEdges, setNodes, t, updateNodeIdCounter]);

  const handleOpenTemplateModal = useCallback(() => {
    setTemplateModalVisible(true);
    if (templateItems.length === 0) {
      void loadTemplateLibrary();
    }
  }, [loadTemplateLibrary, templateItems.length]);

  const handleImportTemplate = useCallback((templateId: number) => {
    if (nodes.length > 0 || edges.length > 0) {
      Modal.confirm({
        title: t('workflowEditor.replaceCanvasTitle'),
        content: t('workflowEditor.replaceCanvasContent'),
        onOk: () => applyTemplateImport(templateId),
      });
      return;
    }
    void applyTemplateImport(templateId);
  }, [applyTemplateImport, edges.length, nodes.length, t]);

  useEffect(() => {
    if (workflowId) {
      shouldFitViewAfterLoad.current = true; // 鏍囪闇€瑕佽嚜鍔ㄥ眳涓?
      loadWorkflowNodes();
    }
  }, [workflowId, loadWorkflowNodes]);

  // 鑺傜偣鍔犺浇瀹屾垚鍚庤嚜鍔ㄥ眳涓樉绀?
  useEffect(() => {
    if (
      nodes.length > 0 &&
      reactFlowInstance &&
      hasInitialized.current &&
      shouldFitViewAfterLoad.current
    ) {
      // 寤惰繜鎵ц浠ョ‘淇濊妭鐐瑰凡缁忔覆鏌?
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
        shouldFitViewAfterLoad.current = false; // 閲嶇疆鏍囪锛岄伩鍏嶉噸澶嶈Е鍙?
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, reactFlowInstance]);

  // 閿洏蹇嵎閿細Delete閿垹闄ら€変腑鑺傜偣
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (configPanelVisible) {
        return;
      }

      const target = event.target as HTMLElement;
      const isEditableElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]');

      if (isEditableElement) {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
        event.preventDefault();
        deleteNode(selectedNode.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNode, deleteNode, configPanelVisible]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.canvas}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={() => {
              setSelectedNode(null);
              setConfigPanelVisible(false);
              setContextMenu(null);
            }}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            defaultViewport={defaultViewport}
            onInit={(instance) => {
              setReactFlowInstance(instance);
              if (!hasInitialized.current) {
                setTimeout(() => {
                  if (nodes.length > 0) {
                    instance.fitView({ padding: 0.2, duration: 0 });
                  } else {
                    (instance as any)?.setViewport?.(defaultViewport, { duration: 0 });
                  }
                  hasInitialized.current = true;
                }, 0);
              }
            }}
            nodeTypes={nodeTypes}
            attributionPosition="bottom-left"
            deleteKeyCode={configPanelVisible ? null : ['Delete', 'Backspace']}
          >
            <Controls className={styles.flowControls} />
            <MiniMap
              className={styles.miniMap}
              nodeColor={theme === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(17, 17, 17, 0.12)'}
              maskColor={theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(247, 245, 241, 0.72)'}
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1}
              color={theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(17, 17, 17, 0.08)'}
            />
          </ReactFlow>

          {workflowPreviewMode === 'workflow' && (
            <div className={styles.previewBanner}>
              <span>
                {t(
                  'workflowEditor.alkaid.previewWorkflowBannerDetail',
                  '褰撳墠姝ｅ湪棰勮鐟跺厜鏄熺敓鎴愮殑鏂板伐浣滄祦锛岀‘璁ゅ悗灏嗚鐩栧苟淇濆瓨褰撳墠鐢诲竷'
                )}
              </span>
              <Space size="small">
                <Button size="small" type="primary" onClick={handleConfirmWorkflowPreview}>
                  {t('workflowEditor.alkaid.previewConfirm')}
                </Button>
                <Button size="small" onClick={handleCancelWorkflowPreview}>
                  {t('workflowEditor.alkaid.previewCancel')}
                </Button>
              </Space>
            </div>
          )}

          {patchPreviewMode === 'previewing' && (
            <div className={`${styles.previewBanner} ${styles.previewBannerWarning}`}>
              <Space>
                <span>{t('workflowEditor.alkaid.patchPreviewBanner')}</span>
                <Button size="small" type="primary" onClick={handleConfirmPatchPreview}>
                  {t('workflowEditor.alkaid.patchPreviewApplyAll')}
                </Button>
                <Button size="small" onClick={handleCancelPatchPreview}>
                  {t('workflowEditor.alkaid.patchPreviewCancel')}
                </Button>
              </Space>
            </div>
          )}

          {/* 淇濆瓨鐘舵€佹樉绀?*/}
          {lastSaveTime && (
            <div className={styles.saveStatus}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
              <span>{t('workflowEditor.saved')}</span>
              <span>
                {lastSaveTime.toLocaleTimeString(
                  i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  }
                )}
              </span>
            </div>
          )}

          {/* 鐟跺厜鏄熷姪鎵?*/}
          <AlkaidAssistant
            workflowId={workflowId}
            hasExistingNodes={nodes.length > 0 || edges.length > 0}
            onWorkflowApplied={loadWorkflowNodes}
            getCurrentWorkflow={getCurrentWorkflow}
            onPatchGenerated={handlePatchGenerated}
            onWorkflowGenerated={async (workflowData) => {
              try {
                // 杞崲鑺傜偣鏁版嵁
                const importedNodes = transformNodesFromLoadFormat(workflowData.nodes, getNodeLabel);
                // 杞崲杈规暟鎹?
                const importedEdges = transformEdgesFromLoadFormat(workflowData.edges);

                enterWorkflowPreview(importedNodes, importedEdges);

                // 鑷姩閫傞厤瑙嗗浘
                setTimeout(() => {
                  if (reactFlowInstance) {
                    reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
                  }
                }, 100);
              } catch (error: any) {
                message.error(t('alkaid.importFailed') || '瀵煎叆澶辫触: ' + (error.message || '鏈煡閿欒'));
                console.error('Import workflow error:', error);
              }
            }}
          />

          {/* 鎮诞鎿嶄綔鎸夐挳 */}
          <div className={`${styles.actionButtons} ${buttonsExpanded ? styles.expanded : styles.collapsed}`}>
            <Space size="small" key={buttonsExpanded ? 'expanded' : 'collapsed'}>
              {buttonsExpanded ? (
                <>
                  <Button
                    size="small"
                    shape="round"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRun}
                  >
                    {t('workflowEditor.run')}
                  </Button>
                  <Button
                    size="small"
                    shape="round"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                  >
                    {t('workflowEditor.save')}
                  </Button>
                  <Button
                    size="small"
                    shape="round"
                    icon={<ReloadOutlined />}
                    onClick={clearAllExecutionStatus}
                  >
                    {t('workflowEditor.clearTaskStatus')}
                  </Button>
                  <Button
                    size="small"
                    shape="round"
                    icon={<UnorderedListOutlined />}
                    onClick={() => setNodeListVisible(!nodeListVisible)}
                  >
                    {t('workflowEditor.nodes')}
                  </Button>
                  <Button
                    size="small"
                    shape="round"
                    icon={<HistoryOutlined />}
                    onClick={() => {
                      setHistoryVisible(true);
                      setConfigPanelVisible(false);
                      setResultPanelVisible(false);
                      setSelectedNode(null);
                    }}
                  >
                    {t('taskHistory.history')}
                  </Button>
                  <Button
                    size="small"
                    shape="round"
                    icon={<DownloadOutlined />}
                    onClick={handleExportWorkflow}
                  >
                    {t('workflowEditor.export')}
                  </Button>
                  <Button
                    size="small"
                    shape="round"
                    icon={<DeploymentUnitOutlined />}
                    onClick={handleOpenTemplateModal}
                  >
                    {t('workflowEditor.importTemplate')}
                  </Button>
                  <Button
                    size="small"
                    shape="round"
                    icon={<UploadOutlined />}
                    onClick={handleImportWorkflow}
                  >
                    {t('workflowEditor.import')}
                  </Button>
                  <Button
                    size="small"
                    shape="circle"
                    icon={<DoubleLeftOutlined />}
                    onClick={() => setButtonsExpanded(false)}
                    title={t('workflowEditor.collapse')}
                  />
                </>
              ) : (
                <>
                  <Button
                    size="small"
                    shape="round"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRun}
                  >
                    {t('workflowEditor.run')}
                  </Button>
                  <Button
                    size="small"
                    shape="circle"
                    icon={<DoubleRightOutlined />}
                    onClick={() => setButtonsExpanded(true)}
                    title={t('workflowEditor.expand')}
                  />
                </>
              )}
            </Space>
            {nodeListVisible && (
              <div className={styles.nodeListPopup}>
                <NodePanel
                  nodes={nodes}
                  className={styles.nodePanel}
                  onNodeSelect={(nodeId) => {
                    const node = nodes.find((n) => n.id === nodeId);
                    if (node) {
                      setSelectedNode(node);
                      handleSetConfigPanelVisible(true);
                      setResultPanelVisible(false);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div
          className={`${styles.configPanelContainer} ${(configPanelVisible || resultPanelVisible || historyVisible) ? styles.visible : ''}`}
        >
          <div className={styles.configPanelContent}>
            {historyVisible ? (
              <TaskHistoryPanel
                visible={historyVisible}
                onClose={() => {
                  setHistoryVisible(false);
                }}
                workflowId={workflowId ? parseInt(workflowId) : 0}
                onViewExecutionDetail={(executions, task) => {
                  setSelectedTask(task);
                  setTaskExecutions(executions);
                  setDetailVisible(true);
                  // 淇濇寔鍘嗗彶璁板綍闈㈡澘鎵撳紑锛屼笉鍏抽棴
                }}
              />
            ) : resultPanelVisible ? (
              <ExecutionResultPanel
                visible={resultPanelVisible}
                onClose={() => setResultPanelVisible(false)}
                result={executionResult}
                nodes={nodes}
                onCancel={handleCancel}
                isExecuting={isExecuting}
              />
            ) : (
              selectedNode && (
                <NodeConfigPanel
                  visible={configPanelVisible}
                  node={selectedNode}
                  nodes={nodes}
                  edges={edges}
                  executionResult={executionResult}
                  workflowId={workflowId}
                  onSaveToBackend={() => saveWorkflowInternal(true)}
                  onClose={() => {
                    setConfigPanelVisible(false);
                    setSelectedNode(null);
                    setAutoTestNodeId(null);
                  }}
                  onSave={handleNodeConfigSave}
                  autoTest={selectedNode?.id === autoTestNodeId}
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* 鍙抽敭鑿滃崟 */}
      <Modal
        title={t('workflowEditor.importTemplate')}
        open={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        footer={null}
        width={720}
        className={styles.templateModal}
        getContainer={false}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={templateKeyword}
              placeholder={t('workflowEditor.searchTemplate')}
              onChange={(event) => setTemplateKeyword(event.target.value)}
              onPressEnter={() => void loadTemplateLibrary(templateKeyword)}
            />
            <Button onClick={() => void loadTemplateLibrary(templateKeyword)}>
              {t('common.search', 'Search')}
            </Button>
          </Space.Compact>
          <List
            loading={templateLoading}
            dataSource={templateItems}
            locale={{ emptyText: t('workflowEditor.noTemplateFound') }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="import"
                    type="link"
                    loading={templateImportingId === item.id}
                    onClick={() => handleImportTemplate(item.id)}
                  >
                    {t('workflowEditor.import')}
                  </Button>,
                ]}
              >
                <List.Item.Meta title={item.name} description={item.description || item.category || '-'} />
                <Space size={8} wrap>
                  <Tag>{t('workflowEditor.templateNodeCount', { count: item.nodeCount })}</Tag>
                  <Tag>{t('workflowEditor.templateUsageCount', { count: item.usageCount })}</Tag>
                </Space>
              </List.Item>
            )}
          />
        </Space>
      </Modal>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <Dropdown
            open={true}
            menu={{
              items: getContextMenuItems(),
              onClick: handleContextMenuClick,
            }}
            trigger={['contextMenu']}
          >
            <div />
          </Dropdown>
        </div>
      )}

      {/* 鐐瑰嚮鍏朵粬鍦版柟鍏抽棴鍙抽敭鑿滃崟 */}
      {contextMenu && (
        <div
          className={styles.contextMenuOverlay}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        />
      )}

      {/* 浠诲姟鎵ц璇︽儏寮圭獥 */}
      <TaskExecutionDetailModal
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedTask(null);
          setTaskExecutions([]);
          // 淇濇寔鍘嗗彶璁板綍闈㈡澘鎵撳紑鐘舵€侊紝涓嶅叧闂?
        }}
        task={selectedTask}
        executions={taskExecutions}
      />
    </div>
  );
};

export default WorkflowEditor;


