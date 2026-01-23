import React, { useState, useEffect } from 'react';
import {
  Modal,
  Collapse,
  Empty,
  Tag,
  Typography,
  Space,
  Button,
  App,
  Descriptions,
  Divider,
  Card
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  RightOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Task, TaskNodeExecution, NodeExecutionStatus } from '@/types/task';
import { workflowApi } from '@/api/workflow';
import styles from './TaskExecutionDetailModal.module.scss';

const { Text } = Typography;

interface TaskExecutionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  task: Task | null;
  executions: TaskNodeExecution[];
}

/**
 * 数据展示组件
 */
const DataViewer: React.FC<{
  title: string;
  data: any;
  filename?: string;
}> = ({ title, data, filename }) => {
  const { message } = App.useApp();
  const { t } = useTranslation();

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      message.success(t('taskHistory.executionDetail.copiedToClipboard'));
    } catch (error) {
      message.error(t('taskHistory.executionDetail.copyFailed'));
    }
  };

  const handleDownload = () => {
    if (!filename) return;
    try {
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('taskHistory.executionDetail.downloadSuccess'));
    } catch (error) {
      message.error(t('taskHistory.executionDetail.downloadFailed'));
    }
  };

  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div className={styles.dataViewer}>
      <div className={styles.dataHeader}>
        <Text strong>{title}</Text>
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={handleCopy}
            title={t('taskHistory.executionDetail.copy')}
          />
          {filename && (
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              title={t('taskHistory.executionDetail.download')}
            />
          )}
        </Space>
      </div>
      <div className={styles.dataContent}>
        <SyntaxHighlighter
          language="json"
          style={oneDark}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            padding: '12px',
            borderRadius: '0 0 6px 6px',
            fontSize: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

/**
 * 任务执行详情弹窗（历史记录查看）
 */
const TaskExecutionDetailModal: React.FC<TaskExecutionDetailModalProps> = ({
  visible,
  onClose,
  task,
  executions,
}) => {
  const { t } = useTranslation();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [nodeLabels, setNodeLabels] = useState<Record<string, string>>({});

  // 获取工作流节点信息，建立 nodeId -> label 的映射
  useEffect(() => {
    if (!task?.workflowId || !visible) return;

    const fetchNodeLabels = async () => {
      try {
        const response = await workflowApi.getWorkflowNodes(task.workflowId);
        const labels: Record<string, string> = {};

        if (response.nodes && Array.isArray(response.nodes)) {
          response.nodes.forEach((node: any) => {
            const nodeId = node.id || node.ID;
            const label = node.data?.label || node.label || nodeId;
            if (nodeId) {
              labels[nodeId] = label;
            }
          });
        }

        setNodeLabels(labels);
      } catch (error) {
        console.error('获取节点信息失败:', error);
        // 失败时不影响显示，只是没有节点名称
      }
    };

    fetchNodeLabels();
  }, [task?.workflowId, visible]);

  if (!task) return null;

  // 构建折叠面板项
  const collapseItems = executions.map((execution) => {
    const nodeLabel = nodeLabels[execution.nodeId] || execution.nodeId;
    const showNodeName = nodeLabels[execution.nodeId] && nodeLabels[execution.nodeId] !== execution.nodeId;

    return {
      key: execution.nodeId,
      label: (
        <div className={styles.collapseHeader}>
          <Space>
            <NodeStatusTag status={execution.status} task={task} execution={execution} />
            {showNodeName ? (
              <Space size="small">
                <Text strong>{nodeLabel}</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>({execution.nodeId})</Text>
              </Space>
            ) : (
              <Text strong>{execution.nodeId}</Text>
            )}
            <Tag bordered={false}>{execution.nodeType}</Tag>
          </Space>
          <Space>
            {execution.executionTime && (
              <Tag icon={<ClockCircleOutlined />} color="default">
                {execution.executionTime}ms
              </Tag>
            )}
          </Space>
        </div>
      ),
      children: (
        <div className={styles.executionDetail}>
          {/* 执行时间信息 */}
          <Descriptions column={2} size="small" className={styles.nodeMetaInfo}>
            <Descriptions.Item label={t('taskHistory.executionDetail.startTime')}>
              {execution.startedAt ? new Date(execution.startedAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('taskHistory.executionDetail.completionTime')}>
              {execution.completedAt ? new Date(execution.completedAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('taskHistory.executionDetail.retryCount')}>{execution.retryCount}</Descriptions.Item>
          </Descriptions>

          {/* 错误信息 - 放在最前面醒目显示 */}
          {execution.errorMessage && (
            <div className={styles.errorSection}>
              <Text strong type="danger">{t('taskHistory.executionDetail.errorInfo')}</Text>
              <div className={styles.errorMessage}>
                {execution.errorMessage}
              </div>
              {execution.errorStack && (
                <Collapse ghost size="small">
                  <Collapse.Panel header={t('taskHistory.executionDetail.errorStack')} key="stack">
                    <pre className={styles.errorStack}>{execution.errorStack}</pre>
                  </Collapse.Panel>
                </Collapse>
              )}
            </div>
          )}

          <Divider style={{ margin: '12px 0' }} />

          {/* 输入输出数据 */}
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {execution.inputData && (
              <DataViewer
                title={t('taskHistory.executionDetail.inputData')}
                data={execution.inputData}
              />
            )}

            {execution.outputData && (
              <DataViewer
                title={t('taskHistory.executionDetail.outputData')}
                data={execution.outputData}
                filename={`${execution.nodeId}_output.json`}
              />
            )}

            {execution.resourceUsage && (
              <DataViewer
                title={t('taskHistory.executionDetail.resourceUsage')}
                data={execution.resourceUsage}
              />
            )}
          </Space>
        </div>
      ),
    };
  });

  return (
    <Modal
      title={
        <Space>
          <Text strong style={{ fontSize: '16px' }}>{t('taskHistory.executionDetail.title')}</Text>
          <Tag color={getTaskStatusColor(task.status)}>{getTaskStatusText(task.status, task, t)}</Tag>
          <Text type="secondary" style={{ fontSize: '12px' }}>ID: {task.id}</Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      centered
      mask={false}
      footer={[
        <Button key="close" onClick={onClose}>
          {t('taskHistory.executionDetail.close')}
        </Button>,
      ]}
      className={styles.detailModal}
      styles={{ body: { padding: '20px 24px' } }}
      getContainer={false}
    >
      {/* 任务基本信息卡片 */}
      <Card size="small" className={styles.taskInfoCard} bordered={false}>
        <Descriptions title={t('taskHistory.executionDetail.taskInfo')} column={3} size="small">
          <Descriptions.Item label={t('taskHistory.taskName')}>{task.name || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.executionDetail.startTime')}>{task.startedAt ? new Date(task.startedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.executionDetail.completionTime')}>{task.completedAt ? new Date(task.completedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.executionDetail.executionDuration')}>{task.actualDuration ? `${task.actualDuration}ms` : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.progress')}>{task.progress}%</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.priority')}>{task.priority}</Descriptions.Item>
        </Descriptions>

        {task.errorMessage && (
          <div style={{ marginTop: 12 }}>
            <Text type="danger">{t('taskHistory.executionDetail.taskError', { message: task.errorMessage })}</Text>
          </div>
        )}
      </Card>

      <div className={styles.nodeListContainer}>
        <div className={styles.sectionTitle}>
          <Text strong>{t('taskHistory.executionDetail.nodeExecutionRecord')}</Text>
        </div>

        {executions.length === 0 ? (
          <Empty description={t('taskHistory.executionDetail.noExecutionRecord')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            items={collapseItems}
            expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} />}
            className={styles.nodeCollapse}
          />
        )}
      </div>
    </Modal>
  );
};

/**
 * 节点执行状态标签
 */
const NodeStatusTag: React.FC<{
  status: NodeExecutionStatus;
  task?: Task | null;
  execution?: TaskNodeExecution;
}> = ({ status, task, execution }) => {
  const { t } = useTranslation();
  // 如果任务被手动中止，需要特殊处理节点状态
  const isTaskCancelled = task?.status === 'cancelled' && task?.cancelledBy;

  // 检查错误信息是否包含 context canceled（手动中止的标志）
  const isContextCanceled = execution?.errorMessage?.toLowerCase().includes('context canceled') ||
    execution?.errorMessage?.toLowerCase().includes('context cancelled');

  // 如果任务被中止，需要特殊处理节点状态
  let displayStatus = status;
  if (isTaskCancelled) {
    if (status === 'pending') {
      // 未执行的节点显示"未执行"
      displayStatus = 'not_executed' as any;
    } else if (status === 'running') {
      // 正在执行的节点应该显示"中止"
      displayStatus = 'cancelled' as any;
    } else if (status === 'failed' && isContextCanceled) {
      // 如果节点失败且错误是 context canceled，说明是手动中止的，应该显示"中止"
      displayStatus = 'cancelled' as any;
    }
  }

  const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    pending: { color: 'default', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.pending') },
    running: { color: 'processing', icon: <ClockCircleOutlined spin={true} />, text: t('taskHistory.nodeStatus.running') },
    completed: { color: 'success', icon: <CheckCircleOutlined />, text: t('taskHistory.nodeStatus.completed') },
    failed: { color: 'error', icon: <CloseCircleOutlined />, text: t('taskHistory.nodeStatus.failed') },
    skipped: { color: 'warning', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.skipped') },
    timeout: { color: 'error', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.timeout') },
    cancelled: { color: 'default', icon: <StopOutlined />, text: t('taskHistory.nodeStatus.cancelled') },
    not_executed: { color: 'default', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.notExecuted') },
  };

  const config = statusMap[displayStatus] || statusMap.pending;

  return (
    <Tag color={config.color} icon={config.icon}>
      {config.text}
    </Tag>
  );
};

// 辅助函数
const getTaskStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    pending: 'default',
    queued: 'processing',
    running: 'processing',
    paused: 'warning',
    completed: 'success',
    failed: 'error',
    cancelled: 'default',
    timeout: 'error',
  };
  return colorMap[status] || 'default';
};

const getTaskStatusText = (status: string, task: Task | null | undefined, t: (key: string) => string) => {
  // 如果是手动中止（cancelledBy 不为空），显示"已终止"
  const isManuallyCancelled = status === 'cancelled' && task?.cancelledBy;

  const textMap: Record<string, string> = {
    pending: t('taskHistory.status.pending'),
    queued: t('taskHistory.status.queued'),
    running: t('taskHistory.status.running'),
    paused: t('taskHistory.status.paused'),
    completed: t('taskHistory.status.completed'),
    failed: t('taskHistory.status.failed'),
    cancelled: isManuallyCancelled ? t('taskHistory.status.terminated') : t('taskHistory.status.cancelled'),
    timeout: t('taskHistory.status.timeout'),
  };
  return textMap[status] || status;
};

export default TaskExecutionDetailModal;
