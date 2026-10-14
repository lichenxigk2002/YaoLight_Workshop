import { useEffect, useMemo, useState } from 'react';
import { Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { userApi } from '@/api/user';
import type { ModelTokenStats, TokenStats } from '@/types/user';
import { ProviderIcon } from '@/components/Icons';
import styles from './statistics.module.scss';

function formatNumber(value?: number) {
  return (value || 0).toLocaleString();
}

export default function Statistics() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TokenStats | null>(null);

  useEffect(() => {
    void fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await userApi.getTokenStats();
      setStats(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnsType<ModelTokenStats>>(
    () => [
      {
        title: t('settings.model'),
        key: 'model',
        width: 220,
        render: (_, record) => (
          <div className={styles.modelCell}>
            {record.provider ? <ProviderIcon provider={record.provider} size={20} /> : null}
            <span>{record.display_name || record.model_name}</span>
          </div>
        ),
      },
      {
        title: t('settings.todayInput'),
        dataIndex: ['today', 'input_tokens'],
        key: 'today_input',
        render: (value: number) => formatNumber(value),
      },
      {
        title: t('settings.todayOutput'),
        dataIndex: ['today', 'output_tokens'],
        key: 'today_output',
        render: (value: number) => formatNumber(value),
      },
      {
        title: t('settings.todayTotal'),
        dataIndex: ['today', 'total_tokens'],
        key: 'today_total',
        render: (value: number) => formatNumber(value),
      },
      {
        title: t('settings.totalInput'),
        dataIndex: ['total', 'input_tokens'],
        key: 'total_input',
        render: (value: number) => formatNumber(value),
      },
      {
        title: t('settings.totalOutput'),
        dataIndex: ['total', 'output_tokens'],
        key: 'total_output',
        render: (value: number) => formatNumber(value),
      },
      {
        title: t('settings.totalTotal'),
        dataIndex: ['total', 'total_tokens'],
        key: 'total_total',
        render: (value: number) => formatNumber(value),
      },
    ],
    [t],
  );

  if (loading && !stats) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div>
        <div className={styles.eyebrow}>{t('settings.usageStatistics')}</div>
        <h2 className={styles.title}>{t('settings.usageStatistics')}</h2>
        <p className={styles.desc}>
          {t('settings.usageStatisticsDesc')}
        </p>
      </div>

      <div className={styles.summaryGrid}>
        <section className={styles.summaryPanel}>
          <div className={styles.summaryTitle}>{t('settings.todayConsumption')}</div>
          <div className={styles.metricsRow}>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>{t('settings.inputTokens')}</span>
              <strong className={styles.metricValue}>{formatNumber(stats?.today.input_tokens)}</strong>
            </div>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>{t('settings.outputTokens')}</span>
              <strong className={styles.metricValue}>{formatNumber(stats?.today.output_tokens)}</strong>
            </div>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>{t('settings.totalTokens')}</span>
              <strong className={styles.metricValue}>{formatNumber(stats?.today.total_tokens)}</strong>
            </div>
          </div>
        </section>

        <section className={styles.summaryPanel}>
          <div className={styles.summaryTitle}>{t('settings.cumulativeConsumption')}</div>
          <div className={styles.metricsRow}>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>{t('settings.inputTokens')}</span>
              <strong className={styles.metricValue}>{formatNumber(stats?.total.input_tokens)}</strong>
            </div>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>{t('settings.outputTokens')}</span>
              <strong className={styles.metricValue}>{formatNumber(stats?.total.output_tokens)}</strong>
            </div>
            <div className={styles.metricBlock}>
              <span className={styles.metricLabel}>{t('settings.totalTokens')}</span>
              <strong className={styles.metricValue}>{formatNumber(stats?.total.total_tokens)}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>{t('settings.modelAnalytics')}</div>
          <div className={styles.tableDesc}>
            {t('settings.modelAnalyticsDesc')}
          </div>
        </div>
        <div className={styles.tableShell}>
          <Table<ModelTokenStats>
            rowKey={(record) => `${record.provider}-${record.model_name}`}
            columns={columns}
            dataSource={stats?.models || []}
            pagination={false}
            size="small"
            scroll={{ x: 900 }}
          />
        </div>
      </section>
    </div>
  );
}
