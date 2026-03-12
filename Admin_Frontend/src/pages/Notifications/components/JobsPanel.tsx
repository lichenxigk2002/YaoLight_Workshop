import { EyeOutlined } from '@ant-design/icons';
import { Button, Drawer, Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  getAdminNotificationDeliveries,
  getAdminNotificationJobs,
  getAdminNotificationTemplates,
  type AdminNotificationDelivery,
  type AdminNotificationJob,
  type AdminNotificationTemplate,
} from '../api';
import styles from '../index.module.scss';

interface JobsPanelProps {
  refreshToken?: number;
}

function formatDateTime(value?: string | null, fallback = '-') {
  if (!value) {
    return fallback;
  }
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

function getJobStatusMeta(status: string, t: (key: string, params?: Record<string, string | number>) => string) {
  switch (status) {
    case 'completed':
      return { tone: 'success', label: t('notifications.jobs.statusCompleted') };
    case 'partial_failed':
      return { tone: 'warning', label: t('notifications.jobs.statusPartialFailed') };
    case 'failed':
      return { tone: 'error', label: t('notifications.jobs.statusFailed') };
    default:
      return { tone: 'info', label: status };
  }
}

function getDeliveryStatusMeta(status: string, t: (key: string, params?: Record<string, string | number>) => string) {
  switch (status) {
    case 'sent':
      return { tone: 'success', label: t('notifications.jobs.deliverySent') };
    case 'failed':
      return { tone: 'error', label: t('notifications.jobs.deliveryFailed') };
    default:
      return { tone: 'neutral', label: status };
  }
}

export default function JobsPanel({ refreshToken = 0 }: JobsPanelProps) {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AdminNotificationJob[]>([]);
  const [total, setTotal] = useState(0);
  const [templates, setTemplates] = useState<AdminNotificationTemplate[]>([]);
  const [query, setQuery] = useState({
    page: 1,
    page_size: 10,
    keyword: '',
    status: '',
    template_id: undefined as number | undefined,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AdminNotificationJob | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<AdminNotificationDelivery[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [deliveryQuery, setDeliveryQuery] = useState({
    page: 1,
    page_size: 10,
    status: '',
  });
  const jobStatusOptions = [
    { label: t('notifications.jobs.filterAllJobs'), value: '' },
    { label: t('notifications.jobs.statusCompleted'), value: 'completed' },
    { label: t('notifications.jobs.statusPartialFailed'), value: 'partial_failed' },
    { label: t('notifications.jobs.statusFailed'), value: 'failed' },
  ];
  const deliveryStatusOptions = [
    { label: t('notifications.jobs.filterAllDeliveries'), value: '' },
    { label: t('notifications.jobs.deliverySent'), value: 'sent' },
    { label: t('notifications.jobs.deliveryFailed'), value: 'failed' },
  ];

  useEffect(() => {
    let cancelled = false;
    getAdminNotificationTemplates({ page: 1, page_size: 100 })
      .then((data) => {
        if (!cancelled) {
          setTemplates(data.list);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          messageApi.error(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminNotificationJobs({
      page: query.page,
      page_size: query.page_size,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      template_id: query.template_id,
    })
      .then((data) => {
        if (!cancelled) {
          setJobs(data.list);
          setTotal(data.total);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          messageApi.error(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi, query, refreshToken]);

  useEffect(() => {
    if (!selectedJob) {
      return;
    }

    let cancelled = false;
    setDeliveryLoading(true);
    getAdminNotificationDeliveries(selectedJob.id, {
      page: deliveryQuery.page,
      page_size: deliveryQuery.page_size,
      status: deliveryQuery.status || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setDeliveries(data.list);
          setDeliveryTotal(data.total);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          messageApi.error(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDeliveryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deliveryQuery, messageApi, refreshToken, selectedJob]);

  const columns: ColumnsType<AdminNotificationJob> = [
    {
      title: t('notifications.jobs.columnJob'),
      key: 'job',
      render: (_, record) => (
        <div className={styles.titleCell}>
          <span className={styles.titleText}>{record.name || record.title}</span>
          <span className={styles.contentText}>
            {record.template_name
              ? `${t('notifications.jobs.templatePrefix')}: ${record.template_name}`
              : t('notifications.jobs.directSend')}
          </span>
        </div>
      ),
    },
    {
      title: t('notifications.jobs.columnStatus'),
      dataIndex: 'status',
      width: 130,
      render: (value: string) => {
        const meta = getJobStatusMeta(value, t);
        return <Tag bordered={false} className={`${styles.softStatusTag} ${styles[`softStatusTag${meta.tone[0].toUpperCase()}${meta.tone.slice(1)}`]}`}>{meta.label}</Tag>;
      },
    },
    { title: t('notifications.jobs.columnRecipients'), dataIndex: 'recipient_count', width: 100 },
    { title: t('notifications.jobs.columnSent'), dataIndex: 'success_count', width: 90 },
    { title: t('notifications.jobs.columnFailed'), dataIndex: 'failed_count', width: 90 },
    { title: t('notifications.jobs.columnRead'), dataIndex: 'read_count', width: 90 },
    {
      title: t('notifications.jobs.columnReadRate'),
      dataIndex: 'read_rate',
      width: 100,
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: t('notifications.jobs.columnRequestedBy'),
      key: 'requested_by',
      width: 140,
      render: (_, record) => record.requested_by_username || `#${record.requested_by}`,
    },
    {
      title: t('notifications.jobs.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: t('notifications.jobs.columnAction'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedJob(record);
            setDeliveryQuery({ page: 1, page_size: 10, status: '' });
            setDrawerOpen(true);
          }}
        >
          {t('notifications.jobs.viewDeliveries')}
        </Button>
      ),
    },
  ];

  const deliveryColumns: ColumnsType<AdminNotificationDelivery> = [
    {
      title: t('notifications.jobs.deliveryRecipient'),
      key: 'recipient',
      render: (_, record) => (
        <div className={styles.userCell}>
          <span>{record.username_snapshot || `User #${record.user_id}`}</span>
          <span className={styles.contentText}>{record.email_snapshot || t('common.none')}</span>
        </div>
      ),
    },
    {
      title: t('notifications.jobs.deliveryStatus'),
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const meta = getDeliveryStatusMeta(value, t);
        return <Tag bordered={false} className={`${styles.softStatusTag} ${styles[`softStatusTag${meta.tone[0].toUpperCase()}${meta.tone.slice(1)}`]}`}>{meta.label}</Tag>;
      },
    },
    {
      title: t('notifications.jobs.deliveryFailureReason'),
      dataIndex: 'failure_reason',
      render: (value?: string | null) => value || t('common.none'),
    },
    {
      title: t('notifications.jobs.deliverySentAt'),
      dataIndex: 'sent_at',
      width: 180,
      render: (value?: string | null) => formatDateTime(value),
    },
    {
      title: t('notifications.jobs.deliveryReadAt'),
      dataIndex: 'read_at',
      width: 180,
      render: (value?: string | null) => formatDateTime(value, t('notifications.jobs.unread')),
    },
  ];

  return (
    <>
      {contextHolder}
      <Space wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder={t('notifications.jobs.searchPlaceholder')}
          style={{ width: 260 }}
          onSearch={(value) => setQuery((current) => ({ ...current, page: 1, keyword: value.trim() }))}
        />
        <Select
          value={query.status}
          style={{ width: 160 }}
          options={jobStatusOptions}
          onChange={(value) => setQuery((current) => ({ ...current, page: 1, status: value }))}
        />
        <Select
          allowClear
          placeholder={t('notifications.jobs.filterByTemplate')}
          style={{ width: 240 }}
          value={query.template_id}
          onChange={(value) => setQuery((current) => ({ ...current, page: 1, template_id: value }))}
          options={templates.map((item) => ({ label: item.name, value: item.id }))}
        />
      </Space>

      <Table<AdminNotificationJob>
        rowKey="id"
        loading={loading}
        dataSource={jobs}
        columns={columns}
        scroll={{ x: 1300 }}
        pagination={{
          current: query.page,
          pageSize: query.page_size,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => {
            setQuery((current) => ({ ...current, page, page_size: pageSize || current.page_size }));
          },
        }}
      />

      <Drawer
        title={
          selectedJob
            ? t('notifications.jobs.drawerTitleWithName', { name: selectedJob.name || selectedJob.title })
            : t('notifications.jobs.drawerTitle')
        }
        width={960}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Space wrap className={styles.filters}>
          <Select
            value={deliveryQuery.status}
            style={{ width: 180 }}
            options={deliveryStatusOptions}
            onChange={(value) => setDeliveryQuery((current) => ({ ...current, page: 1, status: value }))}
          />
        </Space>

        <Table<AdminNotificationDelivery>
          rowKey="id"
          loading={deliveryLoading}
          dataSource={deliveries}
          columns={deliveryColumns}
          pagination={{
            current: deliveryQuery.page,
            pageSize: deliveryQuery.page_size,
            total: deliveryTotal,
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              setDeliveryQuery((current) => ({ ...current, page, page_size: pageSize || current.page_size }));
            },
          }}
        />
      </Drawer>
    </>
  );
}
