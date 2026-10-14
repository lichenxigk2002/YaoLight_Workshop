import { Card, Spin, Table } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import styles from '../AIWorkspace.module.scss';
import { formatMoney } from '../utils';
import type { AIModelRecord } from '../types';

export default function AIUsagePage() {
  const [models, setModels] = useState<AIModelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    aiAdminApi.getModels().then((data) => {
      if (!active) return;
      setModels(data.sort((left, right) => right.usage.requestCount - left.usage.requestCount));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalRequests = models.reduce((sum, item) => sum + item.usage.requestCount, 0);
    const totalRevenue = models.reduce((sum, item) => sum + item.usage.estimatedRevenue, 0);
    const totalTokens = models.reduce((sum, item) => sum + item.usage.totalTokens, 0);
    const avgLatency = models.length > 0 ? Math.round(models.reduce((sum, item) => sum + item.usage.avgLatencyMs, 0) / models.length) : 0;
    return { totalRequests, totalRevenue, totalTokens, avgLatency };
  }, [models]);

  if (loading) return <Spin size="large" />;

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="USAGE"
        title="Usage overview"
        description="Usage stays at model granularity so platform operations can compare pricing, demand, and quality across providers."
        tags={['request telemetry', 'latency', 'estimated revenue']}
      />

      <div className={styles.stats}>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Requests</div><div className={styles.metricValue}>{stats.totalRequests.toLocaleString()}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Tokens</div><div className={styles.metricValue}>{stats.totalTokens.toLocaleString()}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Revenue</div><div className={styles.metricValue}>{formatMoney(stats.totalRevenue)}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Avg latency</div><div className={styles.metricValue}>{stats.avgLatency} ms</div></Card>
      </div>

      <Card className={styles.card} title="Top models by requests">
        <Table
          rowKey="key"
          dataSource={models}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Model',
              render: (_value, record: AIModelRecord) => (
                <div>
                  <div>{record.meta.displayName}</div>
                  <div className={styles.muted}>{record.meta.providerName}</div>
                </div>
              ),
            },
            { title: 'Requests', render: (_value, record: AIModelRecord) => record.usage.requestCount.toLocaleString() },
            { title: '7d requests', render: (_value, record: AIModelRecord) => record.usage.last7dRequests.toLocaleString() },
            { title: 'Revenue', render: (_value, record: AIModelRecord) => formatMoney(record.usage.estimatedRevenue, record.pricing.currency) },
            { title: 'Error rate', render: (_value, record: AIModelRecord) => `${Math.round(record.usage.errorRate * 100)}%` },
            { title: 'Latency', render: (_value, record: AIModelRecord) => `${record.usage.avgLatencyMs} ms` },
          ]}
        />
      </Card>
    </div>
  );
}
