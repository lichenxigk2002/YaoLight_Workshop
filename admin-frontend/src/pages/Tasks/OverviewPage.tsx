import { useEffect, useState } from 'react';
import { App, Card, Statistic } from 'antd';
import { getAdminTasksSummary } from '@/api/tasks';
import { useI18n } from '@/i18n';
import type { AdminTaskSummary } from '@/types/tasks';
import TaskListCard from './TaskListCard';
import styles from './Tasks.module.scss';

export default function OverviewPage() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const [summary, setSummary] = useState<AdminTaskSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    setLoadingSummary(true);
    getAdminTasksSummary()
      .then(setSummary)
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : t('tasks.loadSummaryFailed'));
      })
      .finally(() => setLoadingSummary(false));
  }, [message, t]);

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewMetricTotal')} value={summary?.total ?? 0} loading={loadingSummary} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewMetricRunning')} value={summary?.running ?? 0} loading={loadingSummary} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewMetricFailed')} value={summary?.failed ?? 0} loading={loadingSummary} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.overviewMetricFailureRate24h')} value={summary?.failure_rate_24h ?? 0} precision={2} suffix="%" loading={loadingSummary} />
        </Card>
      </div>

      <TaskListCard
        title={t('tasks.overviewListTitle')}
        description={t('tasks.overviewListDescription')}
      />
    </div>
  );
}
