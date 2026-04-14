import { useEffect, useState } from 'react';
import { App, Card, Statistic } from 'antd';
import { getAdminTasksSummary } from '@/api/tasks';
import type { AdminTaskSummary } from '@/types/tasks';
import TaskListCard from './TaskListCard';
import styles from './Tasks.module.scss';

export default function OverviewPage() {
  const { message } = App.useApp();
  const [summary, setSummary] = useState<AdminTaskSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    setLoadingSummary(true);
    getAdminTasksSummary()
      .then(setSummary)
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载任务概览失败');
      })
      .finally(() => setLoadingSummary(false));
  }, [message]);

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title="总任务数" value={summary?.total ?? 0} loading={loadingSummary} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="运行中" value={summary?.running ?? 0} loading={loadingSummary} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="失败数" value={summary?.failed ?? 0} loading={loadingSummary} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="24h 失败率" value={summary?.failure_rate_24h ?? 0} precision={2} suffix="%" loading={loadingSummary} />
        </Card>
      </div>

      <TaskListCard
        title="全局任务列表"
        description="按平台维度查看所有任务，并直接下钻到任务详情、节点执行和日志页面。"
      />
    </div>
  );
}
