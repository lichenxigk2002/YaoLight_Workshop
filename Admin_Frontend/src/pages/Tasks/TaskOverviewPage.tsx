import { useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Statistic, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useOutletContext } from 'react-router-dom';
import { downloadAdminTaskArtifact, getAdminTaskArtifacts } from '@/api/tasks';
import CodeViewer from '@/components/CodeViewer';
import type { AdminTaskArtifact } from '@/types/tasks';
import type { TaskDetailOutletContext } from './TaskDetailLayout';
import styles from './Tasks.module.scss';

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

function formatBytes(size?: number) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function TaskOverviewPage() {
  const { message } = App.useApp();
  const { detail } = useOutletContext<TaskDetailOutletContext>();
  const [artifacts, setArtifacts] = useState<AdminTaskArtifact[]>([]);
  const [artifactTotal, setArtifactTotal] = useState(0);
  const [artifactPage, setArtifactPage] = useState(1);
  const [artifactPageSize, setArtifactPageSize] = useState(10);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  useEffect(() => {
    setLoadingArtifacts(true);
    getAdminTaskArtifacts(detail.task.id, { page: artifactPage, page_size: artifactPageSize })
      .then((payload) => {
        setArtifacts(payload.list);
        setArtifactTotal(payload.total);
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载任务制品失败');
      })
      .finally(() => setLoadingArtifacts(false));
  }, [artifactPage, artifactPageSize, detail.task.id, message]);

  const artifactColumns: ColumnsType<AdminTaskArtifact> = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'kind', width: 120, render: (value: string) => <Tag>{value}</Tag> },
    { title: '节点', dataIndex: 'node_id', width: 160, render: (value: string) => value || '-' },
    { title: '大小', dataIndex: 'size', width: 120, render: (value: number) => formatBytes(value) },
    { title: '创建时间', dataIndex: 'created_at', width: 180, render: (value: string) => formatDateTime(value) },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          onClick={async () => {
            try {
              await downloadAdminTaskArtifact(record.id, record.name);
            } catch (error: unknown) {
              message.error(error instanceof Error ? error.message : '下载制品失败');
            }
          }}
        >
          下载
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title="进度" value={detail.task.progress} suffix="%" />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="节点执行数" value={detail.node_execution_count} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="日志数" value={detail.log_count} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="制品数" value={detail.artifact_count} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card} title="基础信息">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="任务 ID">{detail.task.id}</Descriptions.Item>
          <Descriptions.Item label="状态">{detail.task.status}</Descriptions.Item>
          <Descriptions.Item label="工作流">{detail.workflow.name}</Descriptions.Item>
          <Descriptions.Item label="用户">{detail.user.username}</Descriptions.Item>
          <Descriptions.Item label="优先级">{detail.task.priority}</Descriptions.Item>
          <Descriptions.Item label="重试次数">{detail.task.retryCount}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{formatDateTime(detail.task.startedAt)}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{formatDateTime(detail.task.completedAt)}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(detail.task.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(detail.task.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="错误信息" span={2}>
            {detail.task.errorMessage || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div className={styles.codePanels}>
        <div className={styles.codeSidebar}>
          <Card bordered={false} className={styles.card} title="输入数据">
            <CodeViewer value={detail.task.inputData?.Data ?? detail.task.inputData ?? null} maxHeight={320} />
          </Card>

          <Card bordered={false} className={styles.card} title="错误堆栈">
            <CodeViewer value={detail.task.errorStack} language="text" maxHeight={280} />
          </Card>
        </div>

        <div className={styles.codeMain}>
          <Card bordered={false} className={styles.card} title="结果数据">
            <CodeViewer value={detail.task.result?.Data ?? detail.task.result ?? null} maxHeight={760} />
          </Card>
        </div>
      </div>

      <Card bordered={false} className={styles.card} title="任务制品">
        {artifactTotal === 0 && !loadingArtifacts ? (
          <Empty description="当前任务暂无制品" />
        ) : (
          <Table<AdminTaskArtifact>
            rowKey="id"
            loading={loadingArtifacts}
            dataSource={artifacts}
            columns={artifactColumns}
            scroll={{ x: 860 }}
            pagination={{
              current: artifactPage,
              pageSize: artifactPageSize,
              total: artifactTotal,
              showSizeChanger: true,
              showTotal: (value) => `共 ${value} 条`,
              onChange: (nextPage, nextPageSize) => {
                setArtifactPage(nextPage);
                setArtifactPageSize(nextPageSize || 10);
              },
            }}
          />
        )}
      </Card>
    </div>
  );
}
