import { useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Input, InputNumber, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type Dayjs } from 'dayjs';
import { getAdminTaskFailureStats } from '@/api/tasks';
import { useI18n } from '@/i18n';
import type {
  AdminTaskFailureCountItem,
  AdminTaskFailureStats,
  AdminTaskFailureTrendPoint,
  AdminTaskWorkflowFailureItem,
} from '@/types/tasks';
import styles from './Tasks.module.scss';

const { Paragraph } = Typography;
const { RangePicker } = DatePicker;

function useFailureStats() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const [stats, setStats] = useState<AdminTaskFailureStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nodeTypeInput, setNodeTypeInput] = useState('');
  const [nodeType, setNodeType] = useState<string | undefined>();
  const [errorKeywordInput, setErrorKeywordInput] = useState('');
  const [errorKeyword, setErrorKeyword] = useState<string | undefined>();
  const [workflowIdInput, setWorkflowIdInput] = useState<number | null>(null);
  const [workflowId, setWorkflowId] = useState<number | undefined>();
  const [userIdInput, setUserIdInput] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [startedFrom, setStartedFrom] = useState<string | undefined>();
  const [startedTo, setStartedTo] = useState<string | undefined>();

  useEffect(() => {
    setLoading(true);
    getAdminTaskFailureStats({
      node_type: nodeType,
      error_keyword: errorKeyword,
      workflow_id: workflowId,
      user_id: userId,
      started_from: startedFrom,
      started_to: startedTo,
    })
      .then(setStats)
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : t('tasks.loadFailureStatsFailed'));
      })
      .finally(() => setLoading(false));
  }, [errorKeyword, message, nodeType, refreshKey, startedFrom, startedTo, t, userId, workflowId]);

  return {
    stats,
    loading,
    refresh: () => setRefreshKey((current) => current + 1),
    nodeTypeInput,
    setNodeTypeInput,
    errorKeywordInput,
    setErrorKeywordInput,
    workflowIdInput,
    setWorkflowIdInput,
    userIdInput,
    setUserIdInput,
    range,
    setRange,
    applyFilters: () => {
      setNodeType(nodeTypeInput.trim() || undefined);
      setErrorKeyword(errorKeywordInput.trim() || undefined);
      setWorkflowId(workflowIdInput ?? undefined);
      setUserId(userIdInput ?? undefined);
      setStartedFrom(range?.[0]?.format('YYYY-MM-DD'));
      setStartedTo(range?.[1]?.format('YYYY-MM-DD'));
    },
    resetFilters: () => {
      setNodeTypeInput('');
      setNodeType(undefined);
      setErrorKeywordInput('');
      setErrorKeyword(undefined);
      setWorkflowIdInput(null);
      setWorkflowId(undefined);
      setUserIdInput(null);
      setUserId(undefined);
      setRange(null);
      setStartedFrom(undefined);
      setStartedTo(undefined);
    },
  };
}

export default function FailureInsightsPanel() {
  const { t } = useI18n();
  const {
    stats,
    loading,
    refresh,
    nodeTypeInput,
    setNodeTypeInput,
    errorKeywordInput,
    setErrorKeywordInput,
    workflowIdInput,
    setWorkflowIdInput,
    userIdInput,
    setUserIdInput,
    range,
    setRange,
    applyFilters,
    resetFilters,
  } = useFailureStats();

  const countColumns: ColumnsType<AdminTaskFailureCountItem> = [
    { title: t('tasks.columnItem'), dataIndex: 'label' },
    { title: t('tasks.columnCount'), dataIndex: 'count', width: 100 },
  ];

  const workflowColumns: ColumnsType<AdminTaskWorkflowFailureItem> = [
    { title: t('tasks.columnWorkflow'), dataIndex: 'workflow_name' },
    { title: t('tasks.columnWorkflowId'), dataIndex: 'workflow_id', width: 90 },
    { title: t('tasks.columnFailureCount'), dataIndex: 'count', width: 100 },
  ];

  const trendColumns: ColumnsType<AdminTaskFailureTrendPoint> = [
    { title: t('tasks.columnDate'), dataIndex: 'day' },
    {
      title: t('tasks.columnFailureCount'),
      dataIndex: 'count',
      width: 120,
      render: (value: number) => <Tag color={value > 0 ? 'red' : 'default'}>{value}</Tag>,
    },
  ];

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>{t('tasks.failureTitle')}</Paragraph>
            <Paragraph className={styles.muted}>{t('tasks.failureDescription')}</Paragraph>
          </div>
          <Space>
            <Button onClick={refresh}>{t('tasks.refreshFailureAnalysis')}</Button>
          </Space>
        </div>

        <div className={styles.filterBar} style={{ marginBottom: 16 }}>
          <Input
            allowClear
            placeholder={t('tasks.nodeTypePlaceholder')}
            value={nodeTypeInput}
            onChange={(event) => setNodeTypeInput(event.target.value)}
            style={{ width: 160 }}
          />
          <Input
            allowClear
            placeholder={t('tasks.errorKeywordPlaceholder')}
            value={errorKeywordInput}
            onChange={(event) => setErrorKeywordInput(event.target.value)}
            style={{ width: 180 }}
          />
          <InputNumber
            placeholder={t('tasks.workflowIdPlaceholder')}
            value={workflowIdInput}
            onChange={(value) => setWorkflowIdInput(value)}
            style={{ width: 140 }}
          />
          <InputNumber
            placeholder={t('tasks.userIdPlaceholder')}
            value={userIdInput}
            onChange={(value) => setUserIdInput(value)}
            style={{ width: 120 }}
          />
          <RangePicker
            value={range}
            onChange={(values) => {
              if (values?.[0] && values?.[1]) {
                setRange([values[0], values[1]]);
                return;
              }
              setRange(null);
            }}
          />
          <Button type="primary" onClick={applyFilters}>
            {t('tasks.analyze')}
          </Button>
          <Button onClick={resetFilters}>{t('tasks.reset')}</Button>
        </div>

        <div className={styles.metrics}>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('tasks.metricFailureTasks')} value={stats?.total_failures ?? 0} loading={loading} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('tasks.metricTimeoutCount')} value={stats?.timeout_count ?? 0} loading={loading} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('tasks.metricUniqueWorkflows')} value={stats?.unique_workflows ?? 0} loading={loading} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('tasks.metricUniqueUsers')} value={stats?.unique_users ?? 0} loading={loading} />
          </Card>
        </div>
      </Card>

      <div className={styles.analysisGrid}>
        <Card bordered={false} className={styles.card} title={t('tasks.topNodeTypes')}>
          <Table<AdminTaskFailureCountItem>
            rowKey="label"
            loading={loading}
            dataSource={stats?.top_node_types ?? []}
            columns={countColumns}
            pagination={false}
            size="small"
          />
        </Card>
        <Card bordered={false} className={styles.card} title={t('tasks.topWorkflows')}>
          <Table<AdminTaskWorkflowFailureItem>
            rowKey="workflow_id"
            loading={loading}
            dataSource={stats?.top_workflows ?? []}
            columns={workflowColumns}
            pagination={false}
            size="small"
          />
        </Card>
        <Card bordered={false} className={styles.card} title={t('tasks.topErrors')}>
          <Table<AdminTaskFailureCountItem>
            rowKey="label"
            loading={loading}
            dataSource={stats?.top_errors ?? []}
            columns={countColumns}
            pagination={false}
            size="small"
          />
        </Card>
        <Card bordered={false} className={styles.card} title={t('tasks.recentFailureTrend')}>
          <Table<AdminTaskFailureTrendPoint>
            rowKey="day"
            loading={loading}
            dataSource={stats?.daily_trend ?? []}
            columns={trendColumns}
            pagination={false}
            size="small"
          />
        </Card>
      </div>
    </div>
  );
}
