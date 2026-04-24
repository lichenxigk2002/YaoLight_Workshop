import { useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Space, Statistic, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useOutletContext } from 'react-router-dom';
import { downloadAdminTaskArtifact, getAdminTaskArtifacts } from '@/api/tasks';
import CodeViewer from '@/components/CodeViewer';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
  const { detail } = useOutletContext<TaskDetailOutletContext>();
  const [artifacts, setArtifacts] = useState<AdminTaskArtifact[]>([]);
  const [artifactTotal, setArtifactTotal] = useState(0);
  const [artifactPage, setArtifactPage] = useState(1);
  const [artifactPageSize, setArtifactPageSize] = useState(10);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [errorStackExpanded, setErrorStackExpanded] = useState(false);

  useEffect(() => {
    setLoadingArtifacts(true);
    getAdminTaskArtifacts(detail.task.id, { page: artifactPage, page_size: artifactPageSize })
      .then((payload) => {
        setArtifacts(payload.list);
        setArtifactTotal(payload.total);
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : t('tasks.loadArtifactsFailed'));
      })
      .finally(() => setLoadingArtifacts(false));
  }, [artifactPage, artifactPageSize, detail.task.id, message]);

  const artifactColumns: ColumnsType<AdminTaskArtifact> = [
    { title: t('tasks.columnName'), dataIndex: 'name' },
    { title: t('tasks.columnType'), dataIndex: 'kind', width: 120, render: (value: string) => <Tag>{value}</Tag> },
    { title: t('tasks.columnNode'), dataIndex: 'node_id', width: 160, render: (value: string) => value || '-' },
    { title: t('tasks.columnSize'), dataIndex: 'size', width: 120, render: (value: number) => formatBytes(value) },
    { title: t('tasks.columnCreatedAt'), dataIndex: 'created_at', width: 180, render: (value: string) => formatDateTime(value) },
    {
      title: t('tasks.columnActions'),
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          onClick={async () => {
            try {
              await downloadAdminTaskArtifact(record.id, record.name);
            } catch (error: unknown) {
              message.error(error instanceof Error ? error.message : t('tasks.downloadArtifactFailed'));
            }
          }}
        >
          {t('tasks.download')}
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewProgress')} value={detail.task.progress} suffix="%" />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewNodeExecutionCount')} value={detail.node_execution_count} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewLogCount')} value={detail.log_count} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewArtifactCount')} value={detail.artifact_count} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card} title={t('tasks.cardBasicInfo')}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label={t('tasks.fieldTaskId')}>{detail.task.id}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldStatus')}>{detail.task.status}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldWorkflow')}>{detail.workflow.name}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldUser')}>{detail.user.username}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldPriority')}>{detail.task.priority}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldRetryCount')}>{detail.task.retryCount}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldStartedAt')}>{formatDateTime(detail.task.startedAt)}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldCompletedAt')}>{formatDateTime(detail.task.completedAt)}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldCreatedAt')}>{formatDateTime(detail.task.createdAt)}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldUpdatedAt')}>{formatDateTime(detail.task.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.fieldErrorMessage')} span={2}>
            {detail.task.errorMessage || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div className={styles.codePanels}>
        <div className={styles.codeSidebar}>
          <Card bordered={false} className={styles.card} title={t('tasks.inputData')}>
            <CodeViewer value={detail.task.inputData?.Data ?? detail.task.inputData ?? null} maxHeight={320} />
          </Card>

          {detail.task.errorStack?.trim() ? (
            <Card
              bordered={false}
              className={styles.card}
              title={t('tasks.errorStack')}
              extra={
                <Space size={4} className={styles.stackActions}>
                  <Button
                    size="small"
                    type="text"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(detail.task.errorStack ?? '');
                        message.success(t('tasks.errorStackCopied'));
                      } catch {
                        message.error(t('tasks.copyFailed'));
                      }
                    }}
                  >
                    {t('tasks.copy')}
                  </Button>
                  <Button size="small" type="text" onClick={() => setErrorStackExpanded((current) => !current)}>
                    {errorStackExpanded ? t('tasks.collapse') : t('tasks.expand')}
                  </Button>
                </Space>
              }
            >
              {errorStackExpanded ? (
                <CodeViewer value={detail.task.errorStack} language="text" maxHeight={280} />
              ) : (
                <div className={styles.stackCollapsed}>{t('tasks.stackCollapsedHint')}</div>
              )}
            </Card>
          ) : null}
        </div>

        <div className={styles.codeMain}>
          <Card bordered={false} className={styles.card} title={t('tasks.resultData')}>
            <CodeViewer value={detail.task.result?.Data ?? detail.task.result ?? null} maxHeight={760} />
          </Card>
        </div>
      </div>

      <Card bordered={false} className={styles.card} title={t('tasks.artifactsTitle')}>
        {artifactTotal === 0 && !loadingArtifacts ? (
          <Empty description={t('tasks.artifactsEmpty')} />
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
              showTotal: (value) => t('tasks.paginationTotal', { total: value }),
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
