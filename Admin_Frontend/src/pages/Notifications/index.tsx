import { ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Statistic, message } from 'antd';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useI18n } from '@/i18n';
import { getAdminNotificationSummary, type AdminNotificationSummary } from './api';
import type { NotificationsOutletContext } from './outletContext';
import styles from './index.module.scss';

const emptySummary: AdminNotificationSummary = {
  total_notifications: 0,
  read_notifications: 0,
  unread_notifications: 0,
  expiring_soon: 0,
  distinct_users: 0,
  total_jobs: 0,
  failed_deliveries: 0,
  active_templates: 0,
  read_rate: 0,
};

export default function NotificationsLayout() {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<AdminNotificationSummary>(emptySummary);
  const [refreshToken, setRefreshToken] = useState(0);

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const data = await getAdminNotificationSummary();
      setSummary(data);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  function triggerRefresh() {
    setRefreshToken((current) => current + 1);
    void loadSummary();
  }

  const outletContext: NotificationsOutletContext = {
    refreshToken,
    triggerRefresh,
  };

  return (
    <div className={styles.page}>
      {contextHolder}

      <PageHero
        eyebrow={t('notifications.layoutEyebrow')}
        title={t('notifications.layoutTitle')}
        description={t('notifications.layoutDescription')}
        tags={[
          t('notifications.layoutTagJobs'),
          t('notifications.layoutTagTemplates'),
          t('notifications.layoutTagAnalytics'),
        ]}
        action={
          <Button icon={<ReloadOutlined />} onClick={triggerRefresh} loading={summaryLoading}>
            {t('notifications.refresh')}
          </Button>
        }
      />

      <div className={styles.metrics}>
        <Card className={styles.panel}>
          <Statistic
            title={t('notifications.metricTotalNotifications')}
            value={summary.total_notifications}
            loading={summaryLoading}
          />
        </Card>
        <Card className={styles.panel}>
          <Statistic
            title={t('notifications.metricUnreadNotifications')}
            value={summary.unread_notifications}
            loading={summaryLoading}
          />
        </Card>
        <Card className={styles.panel}>
          <Statistic
            title={t('notifications.metricReadRate')}
            value={summary.read_rate}
            precision={1}
            suffix="%"
            loading={summaryLoading}
          />
        </Card>
        <Card className={styles.panel}>
          <Statistic title={t('notifications.metricSendJobs')} value={summary.total_jobs} loading={summaryLoading} />
        </Card>
      </div>

      <Card className={styles.panel}>
        <Outlet context={outletContext} />
      </Card>
    </div>
  );
}
