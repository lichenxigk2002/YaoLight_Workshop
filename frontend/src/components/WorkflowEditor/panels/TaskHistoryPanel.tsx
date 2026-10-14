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
import { AIIcon } from '@/components/Icons';
import styles from './TaskHistoryPanel.module.scss';

const { Text } = Typography;

interface TaskHistoryPanelProps {
  visible: boolean;
  onClose: () => void;
  workflowId: number;
  activeTaskId?: number;
  cancellingTaskIds?: number[];
  onViewExecutionDetail?: (executions: TaskNodeExecution[], task: Task) => void;
  onOpenExecutionResult?: (task: Task) => void;
  onResumeExecution?: (task: Task) => void;
  onCancelTask?: (task: Task) => void;
}

const TaskHistoryPanel: React.FC<TaskHistoryPanelProps> = ({
  visible,
  onClose,
  workflowId,
  activeTaskId,
  cancellingTaskIds = [],
  onViewExecutionDetail,
  onOpenExecutionResult,
  onResumeExecution,
  onCancelTask,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [hasRunningTasks, setHasRunningTasks] = useState(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

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

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    isPollingRef.current = false;
  };

  const startPolling = () => {
    stopPolling();
    isPollingRef.current = true;

    pollingTimerRef.current = setInterval(async () => {
      if (!isPollingRef.current) {
        stopPolling();
        return;
      }

      try {
        const [tasksResponse, runningResponse] = await Promise.all([
          taskApi.getWorkflowTasks(workflowId, { page, limit }),
          taskApi.getRunningTasks(workflowId),
        ]);

        setTasks(tasksResponse.tasks || []);
        setTotal(tasksResponse.total || 0);

        const hasRunning = runningResponse.hasTasks;
        setHasRunningTasks(hasRunning);

        if (!hasRunning) {
          stopPolling();
        }
      } catch (error) {
        console.error('Task history polling failed:', error);
      }
    }, 3000);
  };

  const checkRunningTasks = async () => {
    try {
      const response = await taskApi.getRunningTasks(workflowId);
      const hasRunning = response.hasTasks;
      setHasRunningTasks(hasRunning);

      if (hasRunning && !isPollingRef.current) {
        startPolling();
      } else if (!hasRunning && isPollingRef.current) {
        stopPolling();
      }
    } catch (error) {
      console.error('Failed to check running tasks:', error);
    }
  };

  const handleViewDetail = async (task: Task) => {
    try {
      const response = await taskApi.getTaskNodeExecutions(task.id);
      onViewExecutionDetail?.(response.executions, task);
    } catch (error: any) {
      message.error(error.message || t('taskHistory.getDetailFailed'));
    }
  };

  const handleCancelTask = async (task: Task) => {
    if (!onCancelTask) return;
    try {
      await onCancelTask(task);
      await fetchTasks();
      await checkRunningTasks();
    } catch (error: any) {
      message.error(error.message || '中止任务失败');
    }
  };

  const handleRetryFailedTask = async (task: Task) => {
    try {
      const response = await taskApi.retryFailedTask(task.id);
      message.success('已开始续跑失败节点');
      await fetchTasks();
      await checkRunningTasks();
      if (response.task_id) {
        const latestTask = await taskApi.getTaskDetail(response.task_id);
        onResumeExecution?.(latestTask);
      }
    } catch (error: any) {
      message.error(error.message || '续跑失败节点失败');
    }
  };

  useEffect(() => {
    if (visible && workflowId) {
      void fetchTasks();
      void checkRunningTasks();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [visible, workflowId]);

  useEffect(() => {
    if (visible && workflowId) {
      void fetchTasks();
    }
  }, [page, visible, workflowId]);

  const handleRefresh = () => {
    void fetchTasks();
    void checkRunningTasks();
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  if (!visible) return null;

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <div className={styles.headerLeft}>
          <HistoryOutlined />
          <Text strong className={styles.headerTitle}>
            {t('taskHistory.title')}
          </Text>
          {hasRunningTasks && (
            <span className={styles.headerBadge}>
              <Badge status="processing" />
              {t('taskHistory.hasRunningTasks')}
            </span>
          )}
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            size="small"
            className={styles.actionButton}
          >
            {t('taskHistory.refresh')}
          </Button>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleClose}
            size="small"
            className={styles.actionButton}
          />
        </Space>
      </div>

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
                  >
                    <List.Item.Meta
                      title={
                        <div className={styles.taskTitleRow}>
                          <TaskStatusTag status={task.status} task={task} />
                          <Text strong className={styles.taskTitleText}>
                            {task.name ||
                              (task.sequenceNumber !== undefined
                                ? t('taskHistory.task', { id: task.sequenceNumber })
                                : t('taskHistory.task', { id: task.id }))}
                          </Text>
                          {activeTaskId === task.id ? (
                            <Tag bordered={false} color="processing" className={styles.currentSessionTag}>
                              当前会话
                            </Tag>
                          ) : null}
                          {task.provider ? <AIIcon iconKey={task.modelIcon || task.providerIcon} fallbackProvider={task.provider} size={16} /> : null}
                        </div>
                      }
                      description={
                        <div className={styles.taskDescription}>
                          <Text type="secondary" className={styles.taskRowText}>
                            <ClockCircleOutlined /> {t('taskHistory.startTime')}：
                            {task.startedAt ? new Date(task.startedAt).toLocaleString('zh-CN') : '-'}
                          </Text>
                          <div className={styles.taskMetricsRow}>
                            <Text type="secondary" className={styles.taskRowText}>
                              {t('taskHistory.duration')}：{formatDuration(task.actualDuration)}
                            </Text>
                            <Text type="secondary" className={styles.taskRowText}>
                              {t('taskHistory.progress')}：{task.progress}%
                            </Text>
                            <Text type="secondary" className={styles.taskRowText}>
                              {t('taskHistory.priority')}：{task.priority}
                            </Text>
                          </div>
                          {task.errorMessage ? (
                            <Text type="danger" ellipsis className={styles.taskError}>
                              {t('taskHistory.error')}：{task.errorMessage}
                            </Text>
                          ) : null}
                          <div className={styles.taskActionsRow}>
                            <Button
                              type="link"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => {
                                if (isTaskRunning(task.status)) {
                                  onResumeExecution?.(task);
                                  return;
                                }
                                onOpenExecutionResult?.(task);
                              }}
                              className={styles.linkButton}
                            >
                              {isTaskRunning(task.status) ? '恢复执行' : '打开结果'}
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => void handleViewDetail(task)}
                              className={styles.linkButton}
                            >
                              {t('taskHistory.viewDetail')}
                            </Button>
                            {isTaskRunning(task.status) ? (
                              <Button
                                type="link"
                                size="small"
                                danger
                                icon={<StopOutlined />}
                                loading={cancellingTaskIds.includes(task.id)}
                                disabled={cancellingTaskIds.includes(task.id)}
                                onClick={() => void handleCancelTask(task)}
                                className={styles.linkButton}
                              >
                                {cancellingTaskIds.includes(task.id) ? '终止中' : '中止'}
                              </Button>
                            ) : null}
                            {['failed', 'cancelled', 'timeout'].includes(task.status) ? (
                              <Button
                                type="link"
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={() => void handleRetryFailedTask(task)}
                                className={styles.linkButton}
                              >
                                重试失败节点
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
              <div className={styles.paginationWrap}>
                <Pagination
                  current={page}
                  pageSize={limit}
                  total={total}
                  onChange={setPage}
                  showSizeChanger={false}
                  showTotal={(value) => t('taskHistory.totalRecords', { total: value })}
                />
              </div>
            </>
          )}
        </Spin>
      </div>
    </div>
  );
};

const TaskStatusTag: React.FC<{ status: TaskStatus; task?: Task }> = ({ status, task }) => {
  const { t } = useTranslation();
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
      text: isManuallyCancelled ? t('taskHistory.status.terminated') : t('taskHistory.status.cancelled'),
    },
    timeout: { color: 'error', icon: <ClockCircleOutlined />, text: t('taskHistory.status.timeout') },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const tagClassName = [
    styles.semanticTag,
    config.color === 'success'
      ? styles.semanticTagSuccess
      : config.color === 'error'
        ? styles.semanticTagError
        : config.color === 'warning'
          ? styles.semanticTagWarning
          : styles.semanticTagProcessing,
  ].join(' ');

  return (
    <Tag bordered={false} className={tagClassName} icon={config.icon}>
      {config.text}
    </Tag>
  );
};

const formatDuration = (milliseconds?: number): string => {
  if (!milliseconds) return '-';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分${seconds % 60}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
};

const isTaskRunning = (status: TaskStatus) =>
  ['pending', 'queued', 'running', 'paused'].includes(status);

export default TaskHistoryPanel;
