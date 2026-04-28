import { useCallback, useState, useRef } from 'react';
import { Node } from 'reactflow';
import { ReactFlowInstance } from 'reactflow';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';
import {
  DeleteOutlined,
  SettingOutlined,
  BugOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  CloudDownloadOutlined,
  ClearOutlined,
  RobotOutlined,
  BranchesOutlined,
  ReloadOutlined,
  MergeCellsOutlined,
  ClockCircleOutlined,
  ExportOutlined,
  StopOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { generateRandomPosition } from '@/utils/nodeUtils';

/**
 * 右键菜单Hook
 */
export function useWorkflowContextMenu(
  nodes: Node[],
  reactFlowInstance: ReactFlowInstance | null,
  addNode: (type: string, position?: { x: number; y: number }) => void,
  addCommentCard: (position?: { x: number; y: number }) => void,
  deleteNode: (nodeId: string) => void,
  updateNodeConfig: (nodeId: string, data: any) => void,
  setSelectedNode: (node: Node | null) => void,
  setConfigPanelVisible: (visible: boolean) => void,
  setResultPanelVisible: (visible: boolean) => void,
  setAutoTestNodeId: (nodeId: string | null) => void
) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  /**
   * 节点右键事件
   */
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    []
  );

  /**
   * 画布右键事件
   */
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
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
    },
    [reactFlowInstance]
  );

  /**
   * 右键菜单项点击处理
   */
  const handleContextMenuClick = useCallback<MenuProps['onClick']>(
    ({ key }) => {
      if (contextMenu?.nodeId) {
        // 节点右键菜单
        const node = nodes.find((n) => n.id === contextMenu.nodeId);
        if (!node) {
          setContextMenu(null);
          return;
        }

        // 注释卡片只显示删除选项
        if (node.type === 'comment') {
          if (key === 'delete') {
            deleteNode(contextMenu.nodeId);
          }
          setContextMenu(null);
          return;
        }

        switch (key) {
          case 'delete':
            deleteNode(contextMenu.nodeId);
            break;
          case 'config':
            setSelectedNode(node);
            setConfigPanelVisible(true);
            setResultPanelVisible(false);
            break;
          case 'test-crawl':
            if (node.type === 'crawler') {
              setSelectedNode(node);
              setConfigPanelVisible(true);
              setResultPanelVisible(false);
              setAutoTestNodeId(node.id);
            }
            break;
          case 'direction-vertical':
          case 'direction-horizontal':
            const newDirection = key === 'direction-vertical' ? 'vertical' : 'horizontal';
            updateNodeConfig(node.id, {
              label: node.data.label,
              connectionDirection: newDirection,
              config: node.data.config || {},
            });
            message.success(
              t(
                newDirection === 'vertical'
                  ? 'node.contextMenu.switchToVertical'
                  : 'node.contextMenu.switchToHorizontal'
              )
            );
            break;
        }
      } else {
        // 画布右键菜单
        const position =
          (contextMenuRef.current as any)?.__pendingPosition || generateRandomPosition();

        if (key === 'add-comment') {
          addCommentCard(position);
        } else {
          // 节点类型选择（从"添加节点"的子菜单中选择）
          addNode(key, position);
        }
      }
      setContextMenu(null);
    },
    [
      contextMenu,
      nodes,
      deleteNode,
      addNode,
      addCommentCard,
      updateNodeConfig,
      setSelectedNode,
      setConfigPanelVisible,
      setResultPanelVisible,
      setAutoTestNodeId,
      t,
    ]
  );

  /**
   * 生成节点右键菜单项
   */
  const getNodeContextMenuItems = useCallback((): MenuProps['items'] => {
    if (!contextMenu?.nodeId) return [];

    const node = nodes.find((n) => n.id === contextMenu.nodeId);
    if (!node) return [];

    // 注释卡片只显示删除选项
    if (node.type === 'comment') {
      return [
        {
          key: 'delete',
          label: t('node.contextMenu.deleteComment'),
          icon: <DeleteOutlined />,
          danger: true,
        },
      ];
    }

    const currentDirection = node.data.connectionDirection || 'vertical';
    const baseItems: MenuProps['items'] = [
      {
        key: 'config',
        label: t('node.contextMenu.configNode'),
        icon: <SettingOutlined />,
      },
    ];

    // 如果是爬虫节点，添加测试抓取选项
    if (node.type === 'crawler') {
      baseItems.push({
        key: 'test-crawl',
        label: t('node.contextMenu.testCrawl'),
        icon: <BugOutlined />,
      });
    }

    return [
      ...baseItems,
      {
        key: 'direction',
        label: t('node.contextMenu.connectionDirection'),
        icon: <SwapOutlined />,
        children: [
          {
            key: 'direction-vertical',
            label: t('node.contextMenu.vertical'),
            icon: currentDirection === 'vertical' ? <ArrowUpOutlined /> : null,
          },
          {
            key: 'direction-horizontal',
            label: t('node.contextMenu.horizontal'),
            icon: currentDirection === 'horizontal' ? <ArrowLeftOutlined /> : null,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        label: t('node.contextMenu.deleteNode'),
        icon: <DeleteOutlined />,
        danger: true,
      },
    ];
  }, [contextMenu, nodes, t]);

  /**
   * 生成画布右键菜单项
   */
  const getPaneContextMenuItems = useCallback((): MenuProps['items'] => {
    return [
      {
        key: 'add-node',
        label: t('node.contextMenu.addNode'),
        icon: <PlusOutlined />,
        children: [
          {
            key: 'start',
            label: t('node.labels.start'),
            icon: <PlayCircleOutlined />,
          },
          {
            key: 'crawler',
            label: t('node.labels.crawler'),
            icon: <CloudDownloadOutlined />,
          },
          {
            key: 'dataclean',
            label: t('node.labels.dataclean'),
            icon: <ClearOutlined />,
          },
          {
            key: 'ai',
            label: t('node.labels.ai'),
            icon: <RobotOutlined />,
          },
          {
            key: 'condition',
            label: t('node.labels.condition'),
            icon: <BranchesOutlined />,
          },
          {
            key: 'transform',
            label: t('node.labels.transform'),
            icon: <SwapOutlined />,
          },
          {
            key: 'code',
            label: t('node.labels.code'),
            icon: <CodeOutlined />,
          },
          {
            key: 'loop',
            label: t('node.labels.loop'),
            icon: <ReloadOutlined />,
          },
          {
            key: 'merge',
            label: t('node.labels.merge'),
            icon: <MergeCellsOutlined />,
          },
          {
            key: 'delay',
            label: t('node.labels.delay'),
            icon: <ClockCircleOutlined />,
          },
          {
            key: 'output',
            label: t('node.labels.output'),
            icon: <ExportOutlined />,
          },
          {
            key: 'end',
            label: t('node.labels.end'),
            icon: <StopOutlined />,
          },
        ],
      },
      {
        key: 'add-comment',
        label: t('node.contextMenu.addComment'),
        icon: <FileTextOutlined />,
      },
    ];
  }, [t]);

  /**
   * 获取当前右键菜单项
   */
  const getContextMenuItems = useCallback((): MenuProps['items'] => {
    if (contextMenu?.nodeId) {
      return getNodeContextMenuItems();
    } else {
      return getPaneContextMenuItems();
    }
  }, [contextMenu, getNodeContextMenuItems, getPaneContextMenuItems]);

  return {
    contextMenu,
    contextMenuRef,
    setContextMenu,
    onNodeContextMenu,
    onPaneContextMenu,
    handleContextMenuClick,
    getContextMenuItems,
  };
}
