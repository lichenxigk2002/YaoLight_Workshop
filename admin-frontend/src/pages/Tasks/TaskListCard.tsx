import { useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Input, InputNumber, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  listAdminTasks,
  listFailedAdminTasks,
  listRunningAdminTasks,
  type ListAdminTaskFailuresParams,
  type ListAdminTasksParams,
} from '@/api/tasks';
import { useI18n } from '@/i18n';
import type { AdminTaskListItem, AdminTaskListResponse } from '@/types/tasks';
import { getTaskStatusMeta } from './taskStatus';
import styles from './Tasks.module.scss';

const { Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

type TaskListMode = 'all' | 'running' | 'failures';

interface TaskListCardProps {
  title: string;
  description: string;
  mode?: TaskListMode;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export default function TaskListCard({ title, description, mode = 'all' }: TaskListCardProps) {
  const { message } = App.useApp();
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [loadingList, setLoadingList] = useState(false);
  const [tasks, setTasks] = useState<AdminTaskListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [userIdInput, setUserIdInput] = useState<number | null>(null);
  const [workflowIdInput, setWorkflowIdInput] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | undefined>();
  const [workflowId, setWorkflowId] = useState<number | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [startedFrom, setStartedFrom] = useState<string | undefined>();
  const [startedTo, setStartedTo] = useState<string | undefined>();
  const [nodeTypeInput, setNodeTypeInput] = useState('');
  const [nodeType, setNodeType] = useState<string | undefined>();
  const [errorKeywordInput, setErrorKeywordInput] = useState('');
  const [errorKeyword, setErrorKeyword] = useState<string | undefined>();

  useEffect(() => {
    setPage(1);
  }, [mode]);

  useEffect(() => {
    setLoadingList(true);

    const baseParams: Omit<ListAdminTasksParams, 'status'> = {
      keyword: keyword || undefined,
      user_id: userId,
      workflow_id: workflowId,
      started_from: startedFrom,
      started_to: startedTo,
      page,
      page_size: pageSize,
    };

    let request: Promise<AdminTaskListResponse>;
    if (mode === 'running') {
      request = listRunningAdminTasks(baseParams);
    } else if (mode === 'failures') {
      const failureParams: ListAdminTaskFailuresParams = {
        ...baseParams,
        error_keyword: errorKeyword || undefined,
        node_type: nodeType || undefined,
      };
      request = listFailedAdminTasks(failureParams);
    } else {
      request = listAdminTasks({
        ...baseParams,
        status,
      });
    }

    request
      .then((payload) => {
        setTasks(payload.list);
        setTotal(payload.total);
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : t('tasks.loadListFailed'));
      })
      .finally(() => setLoadingList(false));
  }, [errorKeyword, keyword, message, mode, nodeType, page, pageSize, refreshKey, startedFrom, startedTo, status, t, userId, workflowId]);

  const columns: ColumnsType<AdminTaskListItem> = [
    {
      title: t('tasks.columnTaskId'),
      dataIndex: 'id',
      width: 100,
      render: (value: number, record) => (
        <Button type="link" onClick={() => navigate(`/tasks/${record.id}`)}>
          #{value}
        </Button>
      ),
    },
    {
      title: t('tasks.columnWorkflow'),
      dataIndex: 'workflow_name',
      render: (value: string, record) => (
        <div>
          <div>{value}</div>
          <Text type="secondary">{t('tasks.workflowId', { id: record.workflow_id })}</Text>
        </div>
      ),
    },
    {
      title: t('tasks.columnUser'),
      dataIndex: 'username',
      render: (value: string, record) => (
        <div>
          <div>{value}</div>
          <Text type="secondary">
            {t('tasks.userIdAndNo', { id: record.user_id, userNo: record.user_no })}
          </Text>
        </div>
      ),
    },
    {
      title: t('tasks.columnStatus'),
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const meta = getTaskStatusMeta(value, locale);
        return (
          <Tag color={meta.color} className={styles.statusTag}>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: t('tasks.columnProgress'),
      dataIndex: 'progress',
      width: 90,
      render: (value: number) => `${value}%`,
    },
    {
      title: t('tasks.columnDuration'),
      dataIndex: 'actual_duration',
      width: 120,
      render: (value?: number | null) => (value == null ? '-' : `${value} ms`),
    },
    {
      title: t('tasks.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: t('tasks.columnErrorMessage'),
      dataIndex: 'error_message',
      ellipsis: true,
      render: (value?: string | null) => value || '-',
    },
  ];

  return (
    <Card bordered={false} className={styles.card}>
      <div className={styles.toolbar}>
        <div>
          <Paragraph className={styles.toolbarTitle}>{title}</Paragraph>
          <Paragraph className={styles.muted}>{description}</Paragraph>
        </div>
        <Space>
          <Button onClick={() => setRefreshKey((current) => current + 1)}>{t('tasks.refreshList')}</Button>
        </Space>
      </div>

      <div className={styles.filterBar} style={{ marginBottom: 16 }}>
        <Input
          allowClear
          placeholder={t('tasks.keywordPlaceholder')}
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onPressEnter={() => {
            setPage(1);
            setKeyword(keywordInput.trim());
          }}
          style={{ width: 280 }}
        />
        {mode === 'all' ? (
          <Select
            allowClear
            placeholder={t('tasks.statusPlaceholder')}
            value={status}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
            }}
            style={{ width: 140 }}
            options={['pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timeout'].map(
              (value) => ({ value, label: getTaskStatusMeta(value, locale).label }),
            )}
          />
        ) : null}
        {mode === 'failures' ? (
          <Input
            allowClear
            placeholder={t('tasks.nodeTypePlaceholder')}
            value={nodeTypeInput}
            onChange={(event) => setNodeTypeInput(event.target.value)}
            onPressEnter={() => {
              setPage(1);
              setNodeType(nodeTypeInput.trim() || undefined);
            }}
            style={{ width: 160 }}
          />
        ) : null}
        {mode === 'failures' ? (
          <Input
            allowClear
            placeholder={t('tasks.errorKeywordPlaceholder')}
            value={errorKeywordInput}
            onChange={(event) => setErrorKeywordInput(event.target.value)}
            onPressEnter={() => {
              setPage(1);
              setErrorKeyword(errorKeywordInput.trim() || undefined);
            }}
            style={{ width: 180 }}
          />
        ) : null}
        <InputNumber
          placeholder={t('tasks.userIdPlaceholder')}
          value={userIdInput}
          onChange={(value) => setUserIdInput(value)}
          style={{ width: 120 }}
        />
        <InputNumber
          placeholder={t('tasks.workflowIdPlaceholder')}
          value={workflowIdInput}
          onChange={(value) => setWorkflowIdInput(value)}
          style={{ width: 140 }}
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
        <Button
          type="primary"
          onClick={() => {
            setPage(1);
            setKeyword(keywordInput.trim());
            setUserId(userIdInput ?? undefined);
            setWorkflowId(workflowIdInput ?? undefined);
            setStartedFrom(range?.[0]?.format('YYYY-MM-DD'));
            setStartedTo(range?.[1]?.format('YYYY-MM-DD'));
            if (mode === 'failures') {
              setNodeType(nodeTypeInput.trim() || undefined);
              setErrorKeyword(errorKeywordInput.trim() || undefined);
            }
          }}
        >
          {t('tasks.query')}
        </Button>
        <Button
          onClick={() => {
            setKeywordInput('');
            setKeyword('');
            setStatus(undefined);
            setUserIdInput(null);
            setWorkflowIdInput(null);
            setUserId(undefined);
            setWorkflowId(undefined);
            setRange(null);
            setStartedFrom(undefined);
            setStartedTo(undefined);
            setNodeTypeInput('');
            setNodeType(undefined);
            setErrorKeywordInput('');
            setErrorKeyword(undefined);
            setPage(1);
          }}
        >
          {t('tasks.reset')}
        </Button>
      </div>

      <Table<AdminTaskListItem>
        rowKey="id"
        loading={loadingList}
        dataSource={tasks}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => t('tasks.paginationTotal', { total: value }),
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize || 20);
          },
        }}
      />
    </Card>
  );
}
