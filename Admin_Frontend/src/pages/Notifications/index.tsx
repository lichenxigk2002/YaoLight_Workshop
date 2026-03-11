import { CheckCircleFilled, DownOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Statistic, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useI18n } from '@/i18n';
import { getAdminNotificationSummary, type AdminNotificationSummary } from './api';
import { getNotificationTodoChecklist } from './checklist';
import type { NotificationsOutletContext } from './outletContext';
import styles from './index.module.scss';

const { Text } = Typography;

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

const tabRouteMap = {
  send: '/notifications/send',
  jobs: '/notifications/jobs',
  log: '/notifications/log',
  analytics: '/notifications/analytics',
  templates: '/notifications/templates',
};

export default function NotificationsLayout() {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<AdminNotificationSummary>(emptySummary);
  const [refreshToken, setRefreshToken] = useState(0);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const notificationTodoChecklist = useMemo(() => getNotificationTodoChecklist(t), [t]);
  const completedCount = useMemo(
    () => notificationTodoChecklist.filter((item) => item.done).length,
    [notificationTodoChecklist],
  );

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
          t('notifications.layoutTagCompleted', {
            completed: completedCount,
            total: notificationTodoChecklist.length,
          }),
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

      <Card
        title={t('notifications.checklist.title')}
        className={styles.panel}
        extra={
          <Button
            type="text"
            size="small"
            icon={<DownOutlined rotate={checklistExpanded ? 180 : 0} />}
            onClick={() => setChecklistExpanded((current) => !current)}
          >
            {checklistExpanded ? t('notifications.checklist.hide') : t('notifications.checklist.show')}
          </Button>
        }
      >
        <Text className={styles.muted}>{t('notifications.checklist.description')}</Text>
        {checklistExpanded ? (
          <div className={styles.checklist}>
            {notificationTodoChecklist.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.checklistItem} ${styles.checklistDone}`}
                onClick={() => navigate(tabRouteMap[item.target])}
              >
                <CheckCircleFilled className={styles.checkIcon} />
                <div>
                  <div className={styles.checklistTitle}>{item.title}</div>
                  <div className={styles.checklistDetail}>{item.detail}</div>
                </div>
                <div>
                  <Tag color="success">{t('notifications.checklist.done')}</Tag>
                  <div className={styles.checklistHint}>{t('notifications.checklist.openSection')}</div>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className={styles.panel}>
        <Outlet context={outletContext} />
      </Card>
    </div>
  );
}
