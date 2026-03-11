import { useEffect, useState } from 'react';
import { App, Card, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useOutletContext } from 'react-router-dom';
import { getAdminTaskNodeExecutions } from '@/api/tasks';
import { useI18n } from '@/i18n';
import type { AdminTaskNodeExecution } from '@/types/tasks';
import type { TaskDetailOutletContext } from './TaskDetailLayout';
import { getTaskStatusMeta } from './taskStatus';
import styles from './Tasks.module.scss';

function pretty(value: unknown) {
  if (value === null || value === undefined) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function TaskNodesPage() {
  const { message } = App.useApp();
  const { locale } = useI18n();
  const { detail } = useOutletContext<TaskDetailOutletContext>();
  const [executions, setExecutions] = useState<AdminTaskNodeExecution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAdminTaskNodeExecutions(detail.task.id)
      .then((payload) => setExecutions(payload.executions))
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载节点执行失败');
      })
      .finally(() => setLoading(false));
  }, [detail.task.id, message]);

  const columns: ColumnsType<AdminTaskNodeExecution> = [
    { title: '节点 ID', dataIndex: 'nodeId', width: 180 },
    { title: '类型', dataIndex: 'nodeType', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const meta = getTaskStatusMeta(value, locale);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '耗时',
      dataIndex: 'executionTime',
      width: 120,
      render: (value?: number | null) => (value == null ? '-' : `${value} ms`),
    },
    { title: '开始时间', dataIndex: 'startedAt', width: 180 },
    { title: '完成时间', dataIndex: 'completedAt', width: 180 },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (value?: string | null) => value || '-',
    },
  ];

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card} title="节点执行明细">
        <Table<AdminTaskNodeExecution>
          rowKey="id"
          loading={loading}
          dataSource={executions}
          columns={columns}
          expandable={{
            expandedRowRender: (record) => (
              <div className={styles.page}>
                <Card size="small" title="输入数据">
                  <pre className={styles.jsonBlock}>{pretty(record.inputData?.Data ?? record.inputData ?? null)}</pre>
                </Card>
                <Card size="small" title="输出数据">
                  <pre className={styles.jsonBlock}>{pretty(record.outputData?.Data ?? record.outputData ?? null)}</pre>
                </Card>
              </div>
            ),
          }}
          pagination={false}
        />
      </Card>
    </div>
  );
}
