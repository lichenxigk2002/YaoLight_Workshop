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
import { Card, Button, Space, message, Dropdown, Select } from 'antd';
import { workflowApi } from '@/api/workflow';
import {
  PlusOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  SettingOutlined,
  CloudDownloadOutlined,
  ClearOutlined,
  RobotOutlined,
  BranchesOutlined,
  SwapOutlined,
  ReloadOutlined,
  MergeCellsOutlined,
  ClockCircleOutlined,
  ExportOutlined,
  StopOutlined,
  ArrowUpOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import NodePanel from './NodePanel';
import NodeConfigPanel from './NodeConfigPanel';
import ExecutionResultPanel from './ExecutionResultPanel';
import { validateNodeConnection } from './nodeFormats';
import styles from './index.module.scss';

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
};

// 初始节点
const initialNodes: Node[] = [];

// 初始边
const initialEdges: Edge[] = [];

const WorkflowEditor: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configPanelVisible, setConfigPanelVisible] = useState(false);
  const [resultPanelVisible, setResultPanelVisible] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [nodeRenderKey, setNodeRenderKey] = useState(0); // 强制重新渲染节点的key
  const hasInitialized = useRef(false); // 记录是否已初始化

  // 添加节点
  const addNode = useCallback((type: string, position?: { x: number; y: number }) => {
    const nodePosition = position || {
      x: Math.random() * 400 + 100,
      y: Math.random() * 400 + 100,
    };

    const newNode: Node = {
      id: `node-${nodeIdCounter}`,
      type: type,
      position: nodePosition,
      data: {
        label: getNodeLabel(type),
        type: type,
        config: getDefaultConfig(type),
        connectionDirection: 'vertical', // 默认上下连接
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNodeIdCounter((counter) => counter + 1);
    message.success(`已添加${getNodeLabel(type)}节点`);
  }, [nodeIdCounter, setNodes]);

  // 获取节点标签
  const getNodeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      start: '开始',
      crawler: '爬虫节点',
      dataclean: '数据清洗',
      ai: 'AI处理节点',
      condition: '条件判断',
      transform: '数据转换',
      loop: '循环节点',
      merge: '合并节点',
      delay: '延迟节点',
      output: '输出节点',
      end: '结束',
    };
    return labels[type] || type;
  };

  // 获取默认配置
  const getDefaultConfig = (type: string): any => {
    switch (type) {
      case 'start':
        return {
          trigger: 'manual', // manual, schedule, webhook
        };
      case 'crawler':
        return {
          url: '',
          selector: '',
          method: 'GET',
        };
      case 'dataclean':
        return {
          cleanType: 'html', // html, text, email, url, phone, number, date, custom
          removeHTML: true,
          trim: true,
          removeSpaces: false,
        };
      case 'ai':
        return {
          model: '',
          prompt: '',
          temperature: 0.7,
        };
      case 'condition':
        return {
          conditionType: 'equals', // equals, contains, greater, less, regex
          field: '',
          value: '',
          operator: '==', // ==, !=, >, <, >=, <=, contains
        };
      case 'transform':
        return {
          transformType: 'map', // map, filter, sort, group
          script: '',
        };
      case 'loop':
        return {
          loopType: 'foreach', // foreach, while, for
          items: '',
          condition: '',
        };
      case 'merge':
        return {
          mergeType: 'concat', // concat, union, intersect
        };
      case 'delay':
        return {
          delayType: 'fixed', // fixed, random
          seconds: 1,
        };
      case 'output':
        return {
          format: 'json',
          destination: 'file',
        };
      case 'end':
        return {
          action: 'none', // none, notify, callback
        };
      default:
        return {};
    }
  };

  // 连接节点
  const onConnect = useCallback(
    (params: Connection) => {
      // 找到源节点和目标节点
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      if (!sourceNode || !targetNode) {
        message.error('无法找到节点');
        return;
      }

      // 获取节点类型
      const sourceType = sourceNode.type || sourceNode.data.type;
      const targetType = targetNode.type || targetNode.data.type;

      // 验证格式兼容性
      const validation = validateNodeConnection(sourceType, targetType);

      if (!validation.compatible) {
        message.warning(validation.message || '节点格式不兼容，无法连接');
        return;
      }

      // 格式兼容，允许连接
      setEdges((eds) => addEdge(params, eds));
      message.success('节点已连接');
    },
    [setEdges, nodes]
  );

  // 加载工作流节点和边
  const loadWorkflowNodes = useCallback(async () => {
    if (!workflowId) return;

    try {
      const response = await workflowApi.getWorkflowNodes(Number(workflowId));

      if (response.nodes && response.nodes.length > 0) {
        // 转换节点格式
        const loadedNodes: Node[] = response.nodes.map((nodeData: any) => ({
          id: nodeData.id,
          type: nodeData.type,
          position: nodeData.position || { x: 0, y: 0 },
          data: {
            label: nodeData.data?.label || getNodeLabel(nodeData.type),
            type: nodeData.type,
            config: nodeData.data?.config || getDefaultConfig(nodeData.type),
            connectionDirection: nodeData.data?.connectionDirection || 'vertical',
          },
        }));

        // 转换边格式
        const loadedEdges: Edge[] = response.edges.map((edgeData: any) => ({
          id: edgeData.id || `${edgeData.source}-${edgeData.target}`,
          source: edgeData.source,
          target: edgeData.target,
        }));

        setNodes(loadedNodes);
        setEdges(loadedEdges);

        // 更新节点ID计数器
        const maxId = Math.max(...loadedNodes.map(n => {
          const match = n.id.match(/node-(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }));
        setNodeIdCounter(maxId + 1);
      }
    } catch (error: any) {
      console.error('加载工作流节点失败:', error);
      message.error('加载工作流节点失败: ' + (error.message || '未知错误'));
    }
  }, [workflowId, setNodes, setEdges]);

  // 保存工作流
  const handleSave = useCallback(async () => {
    if (!workflowId) {
      message.warning('工作流ID不存在，无法保存');
      return;
    }

    try {
      // 转换节点格式
      const nodesData = nodes.map(node => ({
        id: node.id,
        type: node.type || node.data.type || 'default',
        position: node.position,
        data: {
          label: node.data.label,
          type: node.data.type || node.type,
          config: node.data.config || {},
          connectionDirection: node.data.connectionDirection || 'vertical',
        },
      }));

      // 转换边格式
      const edgesData = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }));

      await workflowApi.saveWorkflowNodes(Number(workflowId), {
        nodes: nodesData,
        edges: edgesData,
      });

      message.success('工作流已保存');
    } catch (error: any) {
      console.error('保存工作流失败:', error);
      message.error('保存工作流失败: ' + (error.message || '未知错误'));
    }
  }, [workflowId, nodes, edges]);

  // 节点点击事件
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setConfigPanelVisible(true);
    setContextMenu(null); // 关闭右键菜单
  }, []);

  // 节点右键事件
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  // 画布右键事件
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (!reactFlowInstance) return;

    // 将屏幕坐标转换为画布坐标
    const point = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });

    // 保存位置用于添加节点
    if (contextMenuRef.current) {
      (contextMenuRef.current as any).__pendingPosition = point;
    }
  }, [reactFlowInstance]);

  // 删除节点
  const onNodesDelete = useCallback((deleted: Node[]) => {
    if (deleted.length > 0) {
      // 同时删除相关的边
      setEdges((eds) =>
        eds.filter(
          (edge) =>
            !deleted.find(
              (node) => node.id === edge.source || node.id === edge.target
            )
        )
      );
      message.success(`已删除 ${deleted.length} 个节点`);
    }
  }, [setEdges]);

  // 删除节点函数
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) =>
      eds.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setConfigPanelVisible(false);
    }
    setContextMenu(null);
    message.success('节点已删除');
  }, [selectedNode, setNodes, setEdges]);

  // 保存节点配置
  const handleNodeConfigSave = useCallback((nodeId: string, data: any) => {
    const oldNode = nodes.find((n) => n.id === nodeId);
    const oldDirection = oldNode?.data.connectionDirection || 'vertical';
    const newDirection = data.connectionDirection || oldDirection;
    const hasDirectionChange = data.connectionDirection !== undefined && oldDirection !== newDirection;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: data.label,
              connectionDirection: newDirection,
              config: data.config,
            },
          };
        }
        return node;
      })
    );

    // 如果连接方向改变了，强制重新渲染所有节点和边
    if (hasDirectionChange) {
      // 立即更新 nodeRenderKey 强制所有节点重新渲染
      setNodeRenderKey((prev) => prev + 1);

      // 延迟更新边，确保节点已经重新渲染
      setTimeout(() => {
        setEdges((eds) =>
          eds.map((edge) => ({
            ...edge,
            // 更新边的id来强制重新计算
            id: edge.source === nodeId || edge.target === nodeId
              ? `${edge.source}-${edge.target}-${Date.now()}`
              : edge.id,
          }))
        );
      }, 100);
    }

    setConfigPanelVisible(false);
    setSelectedNode(null);
  }, [setNodes, setEdges, nodes]);

  // 右键菜单项点击处理
  const handleContextMenuClick = useCallback(({ key }: { key: string }) => {
    if (contextMenu?.nodeId) {
      // 节点右键菜单
      if (key === 'delete') {
        deleteNode(contextMenu.nodeId);
      } else if (key === 'config') {
        const node = nodes.find((n) => n.id === contextMenu.nodeId);
        if (node) {
          setSelectedNode(node);
          setConfigPanelVisible(true);
        }
      } else if (key === 'direction-vertical' || key === 'direction-horizontal') {
        // 切换连接方向
        const node = nodes.find((n) => n.id === contextMenu.nodeId);
        if (node) {
          const newDirection = key === 'direction-vertical' ? 'vertical' : 'horizontal';
          handleNodeConfigSave(node.id, {
            label: node.data.label,
            connectionDirection: newDirection,
            config: node.data.config || {},
          });
          message.success(`已切换为${newDirection === 'vertical' ? '上下' : '左右'}连接`);
        }
      }
    } else {
      // 画布右键菜单 - 添加节点
      const position = (contextMenuRef.current as any)?.__pendingPosition || {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      };
      addNode(key, position);
    }
    setContextMenu(null);
  }, [contextMenu, nodes, deleteNode, addNode, handleNodeConfigSave]);

  // 键盘快捷键：Delete键删除选中节点
  // 加载工作流节点和边
  useEffect(() => {
    if (workflowId) {
      loadWorkflowNodes();
    }
  }, [workflowId, loadWorkflowNodes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果配置面板打开，不处理删除操作
      if (configPanelVisible) {
        return;
      }

      // 如果焦点在输入框、文本域等可编辑元素内，不处理删除操作
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

  // 执行工作流
  const handleRun = async () => {
    if (nodes.length === 0) {
      message.warning('请先添加节点');
      return;
    }

    // 验证爬虫节点配置
    const crawlerNodes = nodes.filter((n) => n.type === 'crawler');
    for (const node of crawlerNodes) {
      if (!node.data.config?.url) {
        message.error(`节点 ${node.data.label || node.id} 未配置URL`);
        return;
      }
    }

    message.info('工作流执行中...');

    try {
      // 准备执行数据
      const executionData = {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: (node.type || node.data.type || 'default') as string,
          config: (node.data.config || {}) as Record<string, any>,
        })),
        edges: edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
        })),
      };

      // 调用后端API执行工作流
      const result = await workflowApi.executeWorkflow(executionData);

      console.log('执行结果:', result);

      // 保存执行结果
      setExecutionResult(result);

      // result 是 ExecutionResult 类型，包含 success 和 results
      if (result.success) {
        message.success(`工作流执行完成！共执行 ${result.results.length} 个节点`);
        // 自动打开结果面板
        setResultPanelVisible(true);
      } else {
        message.warning('工作流执行完成，但有部分节点失败');
        // 也打开结果面板，让用户查看错误
        setResultPanelVisible(true);
      }
    } catch (error: any) {
      message.error(`工作流执行失败: ${error.message || '未知错误'}`);
      console.error('执行错误:', error);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.editorHeader} size="small">
        <Space wrap>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addNode('start')}
          >
            开始
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => addNode('crawler')}
          >
            爬虫
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => addNode('ai')}
          >
            AI处理
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => addNode('condition')}
          >
            条件判断
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addNode('transform')}
          >
            数据转换
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addNode('loop')}
          >
            循环
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addNode('merge')}
          >
            合并
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addNode('delay')}
          >
            延迟
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => addNode('output')}
          >
            输出
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addNode('end')}
          >
            结束
          </Button>
          {selectedNode && (
            <Select
              value={selectedNode.data.connectionDirection || 'vertical'}
              onChange={(value) => {
                if (selectedNode) {
                  handleNodeConfigSave(selectedNode.id, {
                    label: selectedNode.data.label,
                    connectionDirection: value,
                    config: selectedNode.data.config || {},
                  });
                }
              }}
              style={{ width: 150 }}
              size="large"
            >
              <Select.Option value="vertical">上下连接</Select.Option>
              <Select.Option value="horizontal">左右连接</Select.Option>
            </Select>
          )}
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
          >
            保存工作流
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRun}
          >
            执行工作流
          </Button>
        </Space>
      </Card>

      <div className={styles.content}>
        <div className={styles.canvas}>
          <ReactFlow
            key={nodeRenderKey}
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
              setContextMenu(null);
            }}
            onNodesDelete={onNodesDelete}
            onInit={(instance) => {
              setReactFlowInstance(instance);
              // 只在初始化时执行一次 fitView
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
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>

        <div className={styles.sidebar}>
          <NodePanel nodes={nodes} onNodeSelect={(nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node) {
              setSelectedNode(node);
              setConfigPanelVisible(true);
            }
          }} />
        </div>
      </div>

      <NodeConfigPanel
        visible={configPanelVisible}
        node={selectedNode}
        onClose={() => {
          setConfigPanelVisible(false);
          setSelectedNode(null);
        }}
        onSave={handleNodeConfigSave}
      />

      <ExecutionResultPanel
        visible={resultPanelVisible}
        onClose={() => setResultPanelVisible(false)}
        result={executionResult}
        nodes={nodes}
      />

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
              items: contextMenu.nodeId
                ? (() => {
                  const node = nodes.find((n) => n.id === contextMenu.nodeId);
                  const currentDirection = node?.data.connectionDirection || 'vertical';
                  return [
                    {
                      key: 'config',
                      label: '配置节点',
                      icon: <SettingOutlined />,
                    },
                    {
                      key: 'direction',
                      label: '连接方向',
                      icon: <SwapOutlined />,
                      children: [
                        {
                          key: 'direction-vertical',
                          label: '上下连接',
                          icon: currentDirection === 'vertical' ? <ArrowUpOutlined /> : null,
                        },
                        {
                          key: 'direction-horizontal',
                          label: '左右连接',
                          icon: currentDirection === 'horizontal' ? <ArrowLeftOutlined /> : null,
                        },
                      ],
                    },
                    {
                      type: 'divider',
                    },
                    {
                      key: 'delete',
                      label: '删除节点',
                      icon: <DeleteOutlined />,
                      danger: true,
                    },
                  ];
                })()
                : [
                  {
                    key: 'start',
                    label: '开始',
                    icon: <PlayCircleOutlined />,
                  },
                  {
                    key: 'crawler',
                    label: '爬虫节点',
                    icon: <CloudDownloadOutlined />,
                  },
                  {
                    key: 'dataclean',
                    label: '数据清洗',
                    icon: <ClearOutlined />,
                  },
                  {
                    key: 'ai',
                    label: 'AI处理节点',
                    icon: <RobotOutlined />,
                  },
                  {
                    key: 'condition',
                    label: '条件判断',
                    icon: <BranchesOutlined />,
                  },
                  {
                    key: 'transform',
                    label: '数据转换',
                    icon: <SwapOutlined />,
                  },
                  {
                    key: 'loop',
                    label: '循环节点',
                    icon: <ReloadOutlined />,
                  },
                  {
                    key: 'merge',
                    label: '合并节点',
                    icon: <MergeCellsOutlined />,
                  },
                  {
                    key: 'delay',
                    label: '延迟节点',
                    icon: <ClockCircleOutlined />,
                  },
                  {
                    key: 'output',
                    label: '输出节点',
                    icon: <ExportOutlined />,
                  },
                  {
                    key: 'end',
                    label: '结束',
                    icon: <StopOutlined />,
                  },
                ],
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

