import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
  NodeTypes,
  ReactFlowInstance,
  Connection,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTranslation } from 'react-i18next';
import StartNode from '../WorkflowEditor/nodes/StartNode/StartNode';
import AINode from '../WorkflowEditor/nodes/AINode/AINode';
import ConditionNode from '../WorkflowEditor/nodes/ConditionNode/ConditionNode';
import OutputNode from '../WorkflowEditor/nodes/OutputNode/OutputNode';
import EndNode from '../WorkflowEditor/nodes/EndNode/EndNode';
import styles from './index.module.scss';

// 定义节点类型映射
const nodeTypes: NodeTypes = {
  start: StartNode,
  ai: AINode,
  condition: ConditionNode,
  output: OutputNode,
  end: EndNode,
};

// 预设的连接线 - 条件节点连接两个分支（true 和 false）
const initialEdges: Edge[] = [
  {
    id: 'e1',
    source: 'demo-start',
    target: 'demo-ai',
    animated: true,
  },
  {
    id: 'e2',
    source: 'demo-ai',
    target: 'demo-condition',
    animated: true,
  },
  {
    id: 'e3-true',
    source: 'demo-condition',
    sourceHandle: 'true', // 连接成功分支（绿色）
    target: 'demo-end',
    animated: true,
  },
  {
    id: 'e3-false',
    source: 'demo-condition',
    sourceHandle: 'false', // 连接失败分支（红色）
    target: 'demo-output',
    animated: true,
  },
  {
    id: 'e4',
    source: 'demo-output',
    target: 'demo-end',
    animated: true,
  },
];

const LoginWorkflowCanvas: React.FC = () => {
  const { i18n } = useTranslation();
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 根据语言生成节点 - 更宽松的布局，增加节点间距
  const getInitialNodes = (): Node[] => {
    // 调整节点位置，增加垂直和水平间距，让布局更宽松
    return [
      {
        id: 'demo-start',
        type: 'start',
        position: { x: 60, y: -10 },
        data: {
          label: i18n.language === 'zh-CN' ? '启程' : 'Start',
          type: 'start',
          config: {},
          connectionDirection: 'vertical',
        },
      },
      {
        id: 'demo-ai',
        type: 'ai',
        position: { x: 252, y: 100 },
        data: {
          label: i18n.language === 'zh-CN' ? '智能赋能' : 'AI Empower',
          type: 'ai',
          config: {
            provider: 'grok',
            modelName: 'Grok',
          },
          connectionDirection: 'vertical',
        },
      },
      {
        id: 'demo-condition',
        type: 'condition',
        position: { x: -60, y: 240 },
        data: {
          label: i18n.language === 'zh-CN' ? '智能判断' : 'Smart Decision',
          type: 'condition',
          config: {},
          connectionDirection: 'vertical',
        },
      },
      {
        id: 'demo-output',
        type: 'output',
        position: { x: 240, y: 280 },
        data: {
          label: i18n.language === 'zh-CN' ? '成果输出' : 'Output',
          type: 'output',
          config: {},
          connectionDirection: 'vertical',
        },
      },
      {
        id: 'demo-end',
        type: 'end',
        position: { x: 100, y: 420 },
        data: {
          label: i18n.language === 'zh-CN' ? '完成' : 'Complete',
          type: 'end',
          config: {},
          connectionDirection: 'vertical',
        },
      },
    ];
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 连接节点
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // 语言切换时更新节点标签 - 使用优雅的自定义名称
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const nodeType = node.data.type;
        let label = node.data.label;

        // 使用更优雅的节点名称，符合"瑶光工坊"的风格
        if (i18n.language === 'zh-CN') {
          switch (nodeType) {
            case 'start':
              label = '启程';
              break;
            case 'ai':
              label = '智能赋能';
              break;
            case 'condition':
              label = '智能判断';
              break;
            case 'output':
              label = '成果输出';
              break;
            case 'end':
              label = '完成';
              break;
          }
        } else {
          switch (nodeType) {
            case 'start':
              label = 'Start';
              break;
            case 'ai':
              label = 'AI Empower';
              break;
            case 'condition':
              label = 'Smart Decision';
              break;
            case 'output':
              label = 'Output';
              break;
            case 'end':
              label = 'Complete';
              break;
          }
        }

        return {
          ...node,
          data: {
            ...node.data,
            label,
          },
        };
      })
    );
  }, [i18n.language, setNodes]);

  const fitPreview = useCallback(() => {
    reactFlowInstance.current?.fitView({
      padding: 0.28,
      duration: 500,
      minZoom: 0.42,
      maxZoom: 0.82,
    });
  }, []);

  // 初始化时调整视图，并在容器尺寸变化时重新对齐预览
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const runFit = () => {
      window.requestAnimationFrame(() => {
        fitPreview();
      });
    };

    const timer = window.setTimeout(runFit, 120);
    const resizeObserver = new ResizeObserver(() => {
      runFit();
    });

    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', runFit);

    return () => {
      window.clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', runFit);
    };
  }, [fitPreview]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fitPreview();
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fitPreview, i18n.language]);

  return (
    <div ref={containerRef} className={styles.canvasContainer} data-theme="dark">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
          window.requestAnimationFrame(() => {
            fitPreview();
          });
        }}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={0.8}
        defaultViewport={{ x: 0, y: 0, zoom: 0.65 }}
        style={{ width: '100%', height: '100%' }}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={false}
        zoomOnPinch={false}
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="rgba(255, 255, 255, 0.1)"
        />
      </ReactFlow>
    </div>
  );
};

export default LoginWorkflowCanvas;
