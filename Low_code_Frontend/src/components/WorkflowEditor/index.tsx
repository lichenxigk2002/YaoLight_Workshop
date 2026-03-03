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
import { Button, Space, Dropdown, App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  SaveOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
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
import { transformNodesFromLoadFormat, transformEdgesFromLoadFormat } from '@/utils/workflowTransformers';
import { 
  applyPatchForPreview, 
  getFinalGraphFromPreview, 
  PatchItemExt, 
  PatchPreviewResult 
} from '@/utils/alkaid/patch';
import { PatchItem } from '@/components/Alkaid/types/progress';
import { Checkbox } from 'antd';

// 导入自定义Hooks
import { useWorkflowNodes } from './hooks/useWorkflowNodes';
import { useWorkflowSave } from './hooks/useWorkflowSave';
import { useWorkflowExecute } from './hooks/useWorkflowExecute';
import { useWorkflowContextMenu } from './hooks/useWorkflowContextMenu';

// 导入各个节点组件
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

// 定义节点类型映射
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

// 初始节点和边
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
  const [, setNodeRenderKey] = useState(0); // 用于强制重新渲染节点
  const hasInitialized = useRef(false);
  const [autoTestNodeId, setAutoTestNodeId] = useState<string | null>(null);
  const [nodeListVisible, setNodeListVisible] = useState(false);
  const shouldFitViewAfterLoad = useRef(false); // 用于标记是否需要在加载后自动居中

  // 任务历史记录相关状态
  const [historyVisible, setHistoryVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskExecutions, setTaskExecutions] = useState<TaskNodeExecution[]>([]);

  // 按钮组展开/收起状态
  const [buttonsExpanded, setButtonsExpanded] = useState(true);

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

  // 获取节点标签（用于工具函数）
  const getNodeLabel = useCallback(
    (type: string): string => {
      return t(`node.shortLabels.${type}`, type);
    },
    [t]
  );

  // 使用节点管理Hook
  const {
    addNode,
    addCommentCard,
    deleteNode: deleteNodeFromHook,
    updateNodeConfig,
    updateNodesExecutionStatus,
    clearAllExecutionStatus,
    updateNodeIdCounter,
  } = useWorkflowNodes(nodes, setNodes, getNodeLabel);

  // 使用保存/加载Hook
  const { lastSaveTime, loadWorkflowNodes, handleSave, saveWorkflowInternal } = useWorkflowSave(
    workflowId,
    nodes,
    edges,
    setNodes,
    setEdges,
    getNodeLabel,
    updateNodeIdCounter
  );

  // 包装 setConfigPanelVisible，在打开配置面板时关闭历史记录面板
  const handleSetConfigPanelVisible = useCallback((visible: boolean) => {
    setConfigPanelVisible(visible);
    if (visible) {
      setHistoryVisible(false);
    }
  }, []);

  // 包装 setResultPanelVisible，在打开结果面板时关闭历史记录面板
  const handleSetResultPanelVisible = useCallback((visible: boolean) => {
    setResultPanelVisible(visible);
    if (visible) {
      setHistoryVisible(false);
    }
  }, []);

  // 使用执行Hook
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

  // 包装 handleRun，在执行时关闭历史记录面板
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
        t('workflowEditor.alkaid.previewWorkflowBanner', '已载入瑶光星生成的新工作流，请确认是否覆盖并保存')
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

          if (mark === 'add') {
              style.border = '2px solid #52c41a'; // Green
          } else if (mark === 'remove') {
              style.border = '2px solid #ff4d4f'; // Red
              style.opacity = 0.6;
          } else if (mark === 'update') {
              style.border = '2px solid #faad14'; // Orange
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

    const extendedPatches: PatchItemExt[] = rawPatches.map((p, index) => ({
      ...p,
      id: `patch-${index}-${Date.now()}`,
      selected: true,
      targetType: p.op === 'set_edges' ? 'graph' : (p.node ? 'node' : (p.nodeId ? 'node' : 'graph')),
    }));

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

  // 使用右键菜单Hook
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

  // 连接节点
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      if (!sourceNode || !targetNode) {
        message.error(t('node.messages.nodeNotFound'));
        return;
      }

      // 注释卡片不能连接
      if (isCommentNode(sourceNode) || isCommentNode(targetNode)) {
        message.warning(t('commentCard.cannotConnect'));
        return;
      }

      // 获取节点类型
      const sourceType = sourceNode.type || sourceNode.data.type;
      const targetType = targetNode.type || targetNode.data.type;

      // 验证格式兼容性
      const validation = validateNodeConnection(sourceType, targetType, t);

      if (!validation.compatible) {
        message.warning(validation.message || t('workflowEditor.unknownError'));
        return;
      }

      // 格式兼容，允许连接
      setEdges((eds) => addEdge(params, eds));
      message.success(t('node.messages.nodeConnected'));
    },
    [setEdges, nodes, t]
  );

  // 节点点击事件
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // 注释卡片不打开配置面板
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

  // 删除节点（包含边清理和选中状态处理）
  const deleteNode = useCallback(
    (nodeId: string) => {
      deleteNodeFromHook(nodeId);
      // 同时删除相关的边
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

  // 删除节点（ReactFlow的onNodesDelete）
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (deleted.length > 0) {
        // 同时删除相关的边
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

  // 删除连线（ReactFlow的onEdgesDelete）
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (deleted.length > 0) {
        message.success(t('node.messages.edgesDeleted', { count: deleted.length }) || `已删除 ${deleted.length} 条连线`);
      }
    },
    [t]
  );

  // 保存节点配置
  const handleNodeConfigSave = useCallback(
    (nodeId: string, data: any) => {
      const oldNode = nodes.find((n) => n.id === nodeId);
      const oldDirection = oldNode?.data.connectionDirection || 'vertical';
      const newDirection = data.connectionDirection || oldDirection;
      const hasDirectionChange =
        data.connectionDirection !== undefined && oldDirection !== newDirection;

      updateNodeConfig(nodeId, {
        label: data.label,
        connectionDirection: newDirection,
        config: data.config,
      });

      // 同步更新 selectedNode，确保配置面板显示最新的节点数据
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

      // 如果连接方向改变了，强制重新渲染所有节点和边
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

      // 保存后不关闭配置面板，保持打开状态
    },
    [nodes, updateNodeConfig, setEdges, selectedNode]
  );

  // 导出工作流
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

  // 获取当前工作流（用于 AI 上下文）
  const getCurrentWorkflow = useCallback(async () => {
    return {
      nodes: nodes,
      edges: edges,
    };
  }, [nodes, edges]);

  // 导入工作流
  const handleImportWorkflow = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      message.warning(t('workflowEditor.clearBeforeImport'));
      return;
    }

    // 创建隐藏的文件输入元素
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

        // 自动适配视图
        setTimeout(() => {
          if (reactFlowInstance) {
            reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
          }
        }, 100);
      } catch (error: any) {
        message.error(t('workflowEditor.importFailed') + ': ' + (error.message || t('workflowEditor.unknownError')));
      } finally {
        // 清理
        document.body.removeChild(input);
      }
    };

    document.body.appendChild(input);
    input.click();
  }, [nodes, edges, setNodes, setEdges, updateNodeIdCounter, reactFlowInstance, getNodeLabel, t, message]);

  // 加载工作流节点和边
  useEffect(() => {
    if (workflowId) {
      shouldFitViewAfterLoad.current = true; // 标记需要自动居中
      loadWorkflowNodes();
    }
  }, [workflowId, loadWorkflowNodes]);

  // 节点加载完成后自动居中显示
  useEffect(() => {
    if (
      nodes.length > 0 &&
      reactFlowInstance &&
      hasInitialized.current &&
      shouldFitViewAfterLoad.current
    ) {
      // 延迟执行以确保节点已经渲染
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
        shouldFitViewAfterLoad.current = false; // 重置标记，避免重复触发
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, reactFlowInstance]);

  // 键盘快捷键：Delete键删除选中节点
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
            <Controls />
            <MiniMap
              className={styles.miniMap}
              nodeColor={theme === 'dark' ? '#303030' : '#e8e8e8'}
              maskColor={theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(240, 240, 240, 0.6)'}
            />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>

          {workflowPreviewMode === 'workflow' && (
            <div className={styles.previewBanner}>
              <span>
                {t(
                  'workflowEditor.alkaid.previewWorkflowBannerDetail',
                  '当前正在预览瑶光星生成的新工作流，确认后将覆盖并保存当前画布'
                )}
              </span>
              <Space size="small">
                <Button size="small" type="primary" onClick={handleConfirmWorkflowPreview}>
                  {t('workflowEditor.alkaid.previewConfirm', '确认覆盖并保存')}
                </Button>
                <Button size="small" onClick={handleCancelWorkflowPreview}>
                  {t('workflowEditor.alkaid.previewCancel', '取消预览')}
                </Button>
              </Space>
            </div>
          )}

          {patchPreviewMode === 'previewing' && (
            <div className={styles.previewBanner} style={{ backgroundColor: '#fffbe6', borderBottom: '1px solid #ffe58f' }}>
              <Space>
                <span>正在预览补丁修改效果（绿色=新增，红色=删除，橙色=修改）</span>
                <Button size="small" type="primary" onClick={handleConfirmPatchPreview}>
                  确认应用全部
                </Button>
                <Button size="small" onClick={handleCancelPatchPreview}>
                  取消预览
                </Button>
              </Space>
            </div>
          )}

          {/* 保存状态显示 */}
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

          {/* 瑶光星助手 */}
          <AlkaidAssistant
            workflowId={workflowId}
            hasExistingNodes={nodes.length > 0 || edges.length > 0}
            onWorkflowApplied={loadWorkflowNodes}
            getCurrentWorkflow={getCurrentWorkflow}
            onPatchGenerated={handlePatchGenerated}
            onWorkflowGenerated={async (workflowData) => {
              try {
                // 转换节点数据
                const importedNodes = transformNodesFromLoadFormat(workflowData.nodes, getNodeLabel);
                // 转换边数据
                const importedEdges = transformEdgesFromLoadFormat(workflowData.edges);

                enterWorkflowPreview(importedNodes, importedEdges);

                // 自动适配视图
                setTimeout(() => {
                  if (reactFlowInstance) {
                    reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
                  }
                }, 100);
              } catch (error: any) {
                message.error(t('alkaid.importFailed') || '导入失败: ' + (error.message || '未知错误'));
                console.error('Import workflow error:', error);
              }
            }}
          />

          {/* 悬浮操作按钮 */}
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
                    title="收起"
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
                    title="展开"
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
                  // 保持历史记录面板打开，不关闭
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

      {/* 右键菜单 */}
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

      {/* 点击其他地方关闭右键菜单 */}
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

      {/* 任务执行详情弹窗 */}
      <TaskExecutionDetailModal
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedTask(null);
          setTaskExecutions([]);
          // 保持历史记录面板打开状态，不关闭
        }}
        task={selectedTask}
        executions={taskExecutions}
      />
    </div>
  );
};

export default WorkflowEditor;
