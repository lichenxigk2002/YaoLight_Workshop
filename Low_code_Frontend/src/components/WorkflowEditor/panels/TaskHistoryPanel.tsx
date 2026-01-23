import React, { useState, useEffect, useRef } from 'react';
import {
  List,
  Tag,
  Typography,
  Space,
  Button,
  Pagination,
  Empty,
  Spin,
  Badge,
  App,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  HistoryOutlined,
  EyeOutlined,
  ReloadOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { taskApi } from '@/api/task';
import type { Task, TaskNodeExecution, TaskStatus } from '@/types/task';
import styles from './TaskHistoryPanel.module.scss';

const { Text, Title } = Typography;

interface TaskHistoryPanelProps {
  visible: boolean;
  onClose: () => void;
  workflowId: number;
  onViewExecutionDetail?: (executions: TaskNodeExecution[], task: Task) => void;
}

/**
 * 任务历史面板组件
 */
const TaskHistoryPanel: React.FC<TaskHistoryPanelProps> = ({
  visible,
  onClose,
  workflowId,
  onViewExecutionDetail,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [hasRunningTasks, setHasRunningTasks] = useState(false);

  // 使用 useRef 来存储定时器，避免状态更新问题
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await taskApi.getWorkflowTasks(workflowId, { page, limit });
      setTasks(response.tasks || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      message.error(error.message || t('taskHistory.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 停止轮询
  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    isPollingRef.current = false;
  };

  // 开始轮询
  const startPolling = () => {
    // 如果已经在轮询，先停止
    stopPolling();

    isPollingRef.current = true;

    // 创建新的定时器
    pollingTimerRef.current = setInterval(async () => {
      // 检查是否还应该继续轮询
      if (!isPollingRef.current) {
        stopPolling();
        return;
      }

      try {
        // 同时获取任务列表和运行状态
        const [tasksResponse, runningResponse] = await Promise.all([
          taskApi.getWorkflowTasks(workflowId, { page, limit }),
          taskApi.getRunningTasks(workflowId),
        ]);

        setTasks(tasksResponse.tasks || []);
        setTotal(tasksResponse.total || 0);

        const hasRunning = runningResponse.hasTasks;
        setHasRunningTasks(hasRunning);

        // 如果没有正在运行的任务，停止轮询
        if (!hasRunning) {
          stopPolling();
        }
      } catch (error) {
        console.error('轮询失败:', error);
      }
    }, 3000); // 每3秒轮询一次（从2秒改为3秒，减少请求频率）
  };

  // 检查是否有正在运行的任务
  const checkRunningTasks = async () => {
    try {
      const response = await taskApi.getRunningTasks(workflowId);
      const hasRunning = response.hasTasks;
      setHasRunningTasks(hasRunning);

      // 如果有正在运行的任务且未在轮询，开启轮询
      if (hasRunning && !isPollingRef.current) {
        startPolling();
      } else if (!hasRunning && isPollingRef.current) {
        stopPolling();
      }
    } catch (error) {
      console.error('检查运行状态失败:', error);
    }
  };

  // 查看任务执行详情
  const handleViewDetail = async (task: Task) => {
    try {
      const response = await taskApi.getTaskNodeExecutions(task.id);
      if (onViewExecutionDetail) {
        onViewExecutionDetail(response.executions, task);
      }
    } catch (error: any) {
      message.error(error.message || t('taskHistory.getDetailFailed'));
    }
  };

  // 面板打开/关闭时的处理
  useEffect(() => {
    if (visible && workflowId) {
      // 面板打开时，获取数据并检查运行状态
      fetchTasks();
      checkRunningTasks();
    } else {
      // 面板关闭时，停止轮询
      stopPolling();
    }

    // 清理函数：组件卸载或面板关闭时停止轮询
    return () => {
      stopPolling();
    };
  }, [visible, workflowId]);

  // 页码改变时重新获取数据
  useEffect(() => {
    if (visible && workflowId) {
      fetchTasks();
    }
  }, [page]);

  // 刷新列表
  const handleRefresh = () => {
    fetchTasks();
    checkRunningTasks();
  };

  // 页码改变
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // 关闭面板
  const handleClose = () => {
    stopPolling();
    onClose();
  };

  if (!visible) return null;

  return (
    <div className={styles.panelContainer}>
      {/* 标题栏 */}
      <div className={styles.panelHeader}>
        <div className={styles.headerLeft}>
          <HistoryOutlined />
          <Text strong style={{ fontSize: '16px', marginLeft: 8 }}>
            {t('taskHistory.title')}
          </Text>
          {hasRunningTasks && (
            <Badge status="processing" text={t('taskHistory.hasRunningTasks')} style={{ marginLeft: 12 }} />
          )}
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            size="small"
          >
            {t('taskHistory.refresh')}
          </Button>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleClose}
            size="small"
          />
        </Space>
      </div>

      {/* 内容区域 */}
      <div className={styles.panelContent}>
        <Spin spinning={loading}>
          {tasks.length === 0 ? (
            <Empty description={t('taskHistory.noRecords')} />
          ) : (
            <>
              <List
                dataSource={tasks}
                renderItem={(task) => (
                  <List.Item
                    key={task.id}
                    className={styles.taskItem}
                    actions={[
                      <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(task)}
                      >
                        {t('taskHistory.viewDetail')}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <TaskStatusTag status={task.status} task={task} />
                          <Text strong>{task.name || t('taskHistory.task', { id: task.id })}</Text>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Space size="large">
                            <Text type="secondary">
                              <ClockCircleOutlined /> {t('taskHistory.startTime')}：
                              {task.startedAt
                                ? new Date(task.startedAt).toLocaleString('zh-CN')
                                : '-'}
                            </Text>
                          </Space>
                          <Space size="large">
                            <Text type="secondary">
                              {t('taskHistory.duration')}：{formatDuration(task.actualDuration)}
                            </Text>
                            <Text type="secondary">
                              {t('taskHistory.progress')}：{task.progress}%
                            </Text>
                            <Text type="secondary">
                              {t('taskHistory.priority')}：{task.priority}
                            </Text>
                          </Space>
                          {task.errorMessage && (
                            <Text type="danger" ellipsis>
                              {t('taskHistory.error')}：{task.errorMessage}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={page}
                  pageSize={limit}
                  total={total}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  showTotal={(total) => t('taskHistory.totalRecords', { total })}
                />
              </div>
            </>
          )}
        </Spin>
      </div>
    </div>
  );
};

/**
 * 任务状态标签
 */
const TaskStatusTag: React.FC<{ status: TaskStatus; task?: Task }> = ({ status, task }) => {
  const { t } = useTranslation();
  // 如果是手动中止（cancelledBy 不为空），显示"已终止"
  const isManuallyCancelled = status === 'cancelled' && task?.cancelledBy;

  const statusConfig = {
    pending: { color: 'default', icon: <ClockCircleOutlined />, text: t('taskHistory.status.pending') },
    queued: { color: 'processing', icon: <ClockCircleOutlined />, text: t('taskHistory.status.queued') },
    running: { color: 'processing', icon: <SyncOutlined spin />, text: t('taskHistory.status.running') },
    paused: { color: 'warning', icon: <PauseCircleOutlined />, text: t('taskHistory.status.paused') },
    completed: { color: 'success', icon: <CheckCircleOutlined />, text: t('taskHistory.status.completed') },
    failed: { color: 'error', icon: <CloseCircleOutlined />, text: t('taskHistory.status.failed') },
    cancelled: {
      color: 'default',
      icon: <StopOutlined />,
      text: isManuallyCancelled ? t('taskHistory.status.terminated') : t('taskHistory.status.cancelled')
    },
    timeout: { color: 'error', icon: <ClockCircleOutlined />, text: t('taskHistory.status.timeout') },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Tag color={config.color} icon={config.icon}>
      {config.text}
    </Tag>
  );
};

/**
 * 格式化时长（毫秒转为可读格式）
 */
const formatDuration = (milliseconds?: number): string => {
  if (!milliseconds) return '-';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分${seconds % 60}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
};

export default TaskHistoryPanel;

