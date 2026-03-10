import { useEffect, useState } from 'react';
import { App, Button, Card, Input, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useOutletContext } from 'react-router-dom';
import { getAdminTaskLogs } from '@/api/tasks';
import type { AdminTaskLog } from '@/types/tasks';
import type { TaskDetailOutletContext } from './TaskDetailLayout';
import styles from './Tasks.module.scss';

function levelColor(level: AdminTaskLog['level']) {
  switch (level) {
    case 'debug':
      return 'default';
    case 'info':
      return 'blue';
    case 'warn':
      return 'orange';
    case 'error':
      return 'red';
    case 'fatal':
      return 'magenta';
    default:
      return 'default';
  }
}

function pretty(value: unknown) {
  if (value === null || value === undefined) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function TaskLogsPage() {
  const { message } = App.useApp();
  const { detail } = useOutletContext<TaskDetailOutletContext>();
  const [logs, setLogs] = useState<AdminTaskLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<string | undefined>();
  const [nodeIdInput, setNodeIdInput] = useState('');
  const [nodeId, setNodeId] = useState<string | undefined>();

  useEffect(() => {
    setLoading(true);
    getAdminTaskLogs(detail.task.id, {
      level,
      node_id: nodeId,
      page,
      page_size: pageSize,
    })
      .then((payload) => {
        setLogs(payload.logs);
        setTotal(payload.total);
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载任务日志失败');
      })
      .finally(() => setLoading(false));
  }, [detail.task.id, level, nodeId, page, pageSize, message]);

  const columns: ColumnsType<AdminTaskLog> = [
    { title: '时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '级别',
      dataIndex: 'level',
      width: 100,
      render: (value: AdminTaskLog['level']) => <Tag color={levelColor(value)}>{value}</Tag>,
    },
    { title: '节点', dataIndex: 'nodeId', width: 160, render: (value?: string | null) => value || '-' },
    { title: '消息', dataIndex: 'message' },
  ];

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card} title="任务日志">
        <Space wrap className={styles.filterBar} style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="日志级别"
            value={level}
            onChange={(value) => {
              setPage(1);
              setLevel(value);
            }}
            style={{ width: 140 }}
            options={['debug', 'info', 'warn', 'error', 'fatal'].map((value) => ({ value, label: value }))}
          />
          <Input
            placeholder="节点 ID"
            value={nodeIdInput}
            onChange={(event) => setNodeIdInput(event.target.value)}
            onPressEnter={() => {
              setPage(1);
              setNodeId(nodeIdInput.trim() || undefined);
            }}
            style={{ width: 200 }}
          />
          <Button
            type="primary"
            onClick={() => {
              setPage(1);
              setNodeId(nodeIdInput.trim() || undefined);
            }}
          >
            查询
          </Button>
          <Button
            onClick={() => {
              setPage(1);
              setLevel(undefined);
              setNodeIdInput('');
              setNodeId(undefined);
            }}
          >
            重置
          </Button>
        </Space>

        <Table<AdminTaskLog>
          rowKey="id"
          loading={loading}
          dataSource={logs}
          columns={columns}
          expandable={{
            expandedRowRender: (record) => (
              <div className={styles.page}>
                <Card size="small" title="Metadata">
                  <pre className={styles.jsonBlock}>{pretty(record.metadata?.Data ?? record.metadata ?? null)}</pre>
                </Card>
                <Card size="small" title="Stack Trace">
                  <pre className={styles.jsonBlock}>{record.stackTrace || '-'}</pre>
                </Card>
              </div>
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 100);
            },
          }}
        />
      </Card>
    </div>
  );
}
