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
import { Button, Space, message, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  SaveOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import NodePanel from './NodePanel';
import NodeConfigPanel from './NodeConfigPanel';
import ExecutionResultPanel from './ExecutionResultPanel';
import { validateNodeConnection } from './nodeFormats';
import styles from './index.module.scss';
import { useThemeStore } from '@/store/theme';
import { isCommentNode } from '@/utils/nodeUtils';

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
  const { lastSaveTime, loadWorkflowNodes, handleSave } = useWorkflowSave(
    workflowId,
    nodes,
    edges,
    setNodes,
    setEdges,
    getNodeLabel,
    updateNodeIdCounter
  );

  // 使用执行Hook
  const { handleRun } = useWorkflowExecute(
    nodes,
    edges,
    setExecutionResult,
    setResultPanelVisible,
    setConfigPanelVisible,
    setSelectedNode,
    updateNodesExecutionStatus
  );

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
    setConfigPanelVisible,
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
        setContextMenu(null);
        return;
      }
      setSelectedNode(node);
      setConfigPanelVisible(true);
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

      setConfigPanelVisible(false);
      setSelectedNode(null);
    },
    [nodes, updateNodeConfig, setEdges]
  );

  // 加载工作流节点和边
  useEffect(() => {
    if (workflowId) {
      loadWorkflowNodes();
    }
  }, [workflowId, loadWorkflowNodes]);

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
            onInit={(instance) => {
              setReactFlowInstance(instance);
              if (!hasInitialized.current) {
                setTimeout(() => {
                  instance.fitView({ padding: 0.2, duration: 0 });
                  hasInitialized.current = true;
                }, 0);
              }
            }}
            nodeTypes={nodeTypes}
            attributionPosition="bottom-left"
            deleteKeyCode={configPanelVisible ? null : ['Delete', 'Backspace']}
          >
            <style>
              {`
                .react-flow__controls {
                  box-shadow: 0 0 2px 1px ${theme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.08)'};
                  border-radius: 4px;
                  overflow: hidden;
                }
                .react-flow__controls-button {
                  background: ${theme === 'dark' ? '#1f1f1f' : '#fefefe'};
                  border-bottom: 1px solid ${theme === 'dark' ? '#303030' : '#eee'};
                  color: ${theme === 'dark' ? '#e0e0e0' : 'inherit'};
                }
                .react-flow__controls-button:hover {
                  background: ${theme === 'dark' ? '#303030' : '#f4f4f4'};
                }
                .react-flow__controls-button svg {
                  fill: ${theme === 'dark' ? '#e0e0e0' : 'currentColor'};
                  max-width: 14px;
                  max-height: 14px;
                }
                .react-flow__controls-button:last-child {
                  border-bottom: none;
                }
              `}
            </style>
            <Controls />
            <MiniMap
              style={{
                backgroundColor: theme === 'dark' ? '#141414' : '#fff',
                border: `1px solid ${theme === 'dark' ? '#303030' : '#e8e8e8'}`,
              }}
              nodeColor={theme === 'dark' ? '#303030' : '#e8e8e8'}
              maskColor={theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(240, 240, 240, 0.6)'}
            />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>

          {/* 保存状态显示 */}
          {lastSaveTime && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 10,
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
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

          {/* 悬浮操作按钮 */}
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <Space size="small">
              <Button
                size="small"
                shape="round"
                icon={<SaveOutlined />}
                onClick={handleSave}
                style={{ fontSize: '12px' }}
              >
                {t('workflowEditor.save')}
              </Button>
              <Button
                size="small"
                shape="round"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleRun}
                style={{ fontSize: '12px' }}
              >
                {t('workflowEditor.run')}
              </Button>
              <Button
                size="small"
                shape="round"
                icon={<ReloadOutlined />}
                onClick={clearAllExecutionStatus}
                style={{ fontSize: '12px' }}
              >
                {t('workflowEditor.clearTaskStatus')}
              </Button>
              <Button
                size="small"
                shape="round"
                icon={<UnorderedListOutlined />}
                onClick={() => setNodeListVisible(!nodeListVisible)}
                style={{ fontSize: '12px' }}
              >
                {t('workflowEditor.nodes')}
              </Button>
            </Space>
            {nodeListVisible && (
              <div
                style={{
                  position: 'absolute',
                  top: 40,
                  right: 0,
                  width: 250,
                  maxHeight: '60vh',
                  zIndex: 11,
                  boxShadow:
                    '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
                  borderRadius: 8,
                }}
              >
                <NodePanel
                  nodes={nodes}
                  style={{ maxHeight: '60vh', borderRadius: 8 }}
                  onNodeSelect={(nodeId) => {
                    const node = nodes.find((n) => n.id === nodeId);
                    if (node) {
                      setSelectedNode(node);
                      setConfigPanelVisible(true);
                      setResultPanelVisible(false);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            width: configPanelVisible || resultPanelVisible ? 400 : 0,
            transition: 'width 0.3s cubic-bezier(0.2, 0, 0, 1)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 400,
              height: '100%',
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              boxShadow:
                '0 6px 16px -8px rgba(0,0,0,0.08), 0 9px 28px 0 rgba(0,0,0,0.05), 0 12px 48px 16px rgba(0,0,0,0.03)',
              border: '1px solid var(--border-secondary)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {resultPanelVisible ? (
              <ExecutionResultPanel
                visible={resultPanelVisible}
                onClose={() => setResultPanelVisible(false)}
                result={executionResult}
                nodes={nodes}
              />
            ) : (
              selectedNode && (
                <NodeConfigPanel
                  visible={configPanelVisible}
                  node={selectedNode}
                  nodes={nodes}
                  edges={edges}
                  executionResult={executionResult}
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
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkflowEditor;
