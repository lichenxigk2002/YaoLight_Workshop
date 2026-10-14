import { Card, Statistic, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  getAdminNotificationAnalytics,
  type AdminNotificationAnalytics,
  type AdminNotificationFailureReasonSummary,
  type AdminNotificationStatusCount,
  type AdminNotificationTemplatePerformance,
} from '../api';
import styles from '../index.module.scss';

interface AnalyticsPanelProps {
  refreshToken?: number;
}

const emptyAnalytics: AdminNotificationAnalytics = {
  overview: {
    total_notifications: 0,
    read_notifications: 0,
    unread_notifications: 0,
    expiring_soon: 0,
    distinct_users: 0,
    total_jobs: 0,
    failed_deliveries: 0,
    active_templates: 0,
    read_rate: 0,
  },
  job_status_breakdown: [],
  template_performance: [],
  failure_reasons: [],
};

function renderStatusTag(status: string, t: (key: string, params?: Record<string, string | number>) => string) {
  switch (status) {
    case 'completed':
      return <Tag bordered={false} className={`${styles.softStatusTag} ${styles.softStatusTagSuccess}`}>{t('notifications.jobs.statusCompleted')}</Tag>;
    case 'partial_failed':
      return <Tag bordered={false} className={`${styles.softStatusTag} ${styles.softStatusTagWarning}`}>{t('notifications.jobs.statusPartialFailed')}</Tag>;
    case 'failed':
      return <Tag bordered={false} className={`${styles.softStatusTag} ${styles.softStatusTagError}`}>{t('notifications.jobs.statusFailed')}</Tag>;
    default:
      return <Tag bordered={false} className={`${styles.softStatusTag} ${styles.softStatusTagNeutral}`}>{status}</Tag>;
  }
}

export default function AnalyticsPanel({ refreshToken = 0 }: AnalyticsPanelProps) {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AdminNotificationAnalytics>(emptyAnalytics);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminNotificationAnalytics()
      .then((data) => {
        if (!cancelled) {
          setAnalytics(data);
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
  }, [messageApi, refreshToken]);

  const statusColumns: ColumnsType<AdminNotificationStatusCount> = [
    {
      title: t('notifications.analytics.columnStatus'),
      dataIndex: 'status',
      render: (value: string) => renderStatusTag(value, t),
    },
    {
      title: t('notifications.analytics.columnCount'),
      dataIndex: 'count',
      width: 120,
    },
  ];

  const templateColumns: ColumnsType<AdminNotificationTemplatePerformance> = [
    {
      title: t('notifications.analytics.columnTemplate'),
      dataIndex: 'template_name',
    },
    {
      title: t('notifications.analytics.columnJobs'),
      dataIndex: 'job_count',
      width: 100,
    },
    {
      title: t('notifications.analytics.columnDeliveries'),
      dataIndex: 'delivery_count',
      width: 100,
    },
    {
      title: t('notifications.analytics.columnFailed'),
      dataIndex: 'failed_count',
      width: 100,
    },
    {
      title: t('notifications.analytics.columnRead'),
      dataIndex: 'read_count',
      width: 100,
    },
    {
      title: t('notifications.analytics.columnReadRate'),
      dataIndex: 'read_rate',
      width: 120,
      render: (value: number) => `${value.toFixed(1)}%`,
    },
  ];

  const failureColumns: ColumnsType<AdminNotificationFailureReasonSummary> = [
    {
      title: t('notifications.analytics.columnFailureReason'),
      dataIndex: 'reason',
    },
    {
      title: t('notifications.analytics.columnCount'),
      dataIndex: 'count',
      width: 120,
    },
  ];

  return (
    <>
      {contextHolder}
      <div className={styles.analyticsGrid}>
        <Card className={styles.panel}>
          <Statistic title={t('notifications.analytics.distinctRecipients')} value={analytics.overview.distinct_users} loading={loading} />
        </Card>
        <Card className={styles.panel}>
          <Statistic title={t('notifications.analytics.readNotifications')} value={analytics.overview.read_notifications} loading={loading} />
        </Card>
        <Card className={styles.panel}>
          <Statistic title={t('notifications.analytics.failedDeliveries')} value={analytics.overview.failed_deliveries} loading={loading} />
        </Card>
        <Card className={styles.panel}>
          <Statistic title={t('notifications.analytics.activeTemplates')} value={analytics.overview.active_templates} loading={loading} />
        </Card>
      </div>

      <div className={styles.analyticsCards}>
        <Card title={t('notifications.analytics.jobStatusBreakdown')} className={styles.panel}>
          <Table<AdminNotificationStatusCount>
            rowKey="status"
            loading={loading}
            dataSource={analytics.job_status_breakdown}
            columns={statusColumns}
            pagination={false}
            size="small"
          />
        </Card>

        <Card title={t('notifications.analytics.failureReasonSummary')} className={styles.panel}>
          <Table<AdminNotificationFailureReasonSummary>
            rowKey={(record) => `${record.reason}-${record.count}`}
            loading={loading}
            dataSource={analytics.failure_reasons}
            columns={failureColumns}
            pagination={false}
            size="small"
          />
        </Card>
      </div>

      <Card title={t('notifications.analytics.templatePerformance')} className={styles.panel}>
        <Table<AdminNotificationTemplatePerformance>
          rowKey="template_id"
          loading={loading}
          dataSource={analytics.template_performance}
          columns={templateColumns}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>
    </>
  );
}
