import { useEffect, useState } from 'react';
import { Card, Select, Statistic, Table, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIModels, getAIUsage } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIAdminModel, AIUsageRecord } from '@/types/aiModels';
import { getAIProviderLabel } from './i18n';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

function formatNullableMetric(value?: number | null, suffix = '', fallback = '--') {
  if (value == null) {
    return fallback;
  }
  return `${value}${suffix}`;
}

export default function UsagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const [models, setModels] = useState<AIAdminModel[]>([]);
  const [usage, setUsage] = useState<AIUsageRecord[]>([]);
  const modelId = searchParams.get('modelId') ?? undefined;

  useEffect(() => {
    void Promise.all([getAIModels(), getAIUsage(modelId)]).then(([modelData, usageData]) => {
      setModels(modelData);
      setUsage(usageData);
    });
  }, [modelId]);

  const totalCost = usage.reduce((sum, item) => sum + item.total_cost, 0);
  const totalRequests = usage.reduce((sum, item) => sum + item.requests, 0);
  const totalTokens = usage.reduce((sum, item) => sum + item.total_tokens, 0);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <Title level={3} className={styles.sectionTitle}>
            {t('aiModels.usageTitle')}
          </Title>
          <Paragraph className={styles.muted}>{t('aiModels.usageDescription')}</Paragraph>
        </div>
        <div className={styles.filterBar}>
          <Select
            allowClear
            value={modelId}
            placeholder={t('aiModels.usageFilterPlaceholder')}
            style={{ minWidth: 240 }}
            options={models.map((item) => ({ label: item.display_name, value: item.id }))}
            onChange={(value) => {
              if (value) {
                setSearchParams({ modelId: value });
                return;
              }
              setSearchParams({});
            }}
          />
        </div>
      </div>

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.usageMetricRequests')} value={totalRequests} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.usageMetricTotalTokens')} value={totalTokens} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.usageMetricTotalCost')} prefix="$" value={totalCost} precision={2} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.usageMetricWindow')} value={usage[0]?.window_label ?? t('aiModels.usageWindowTotal')} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <Table
          rowKey="id"
          dataSource={usage}
          columns={[
            {
              title: t('aiModels.usageColumnProvider'),
              dataIndex: 'provider',
              render: (provider: string) => (
                <div className={styles.providerCell}>
                  <ProviderIcon provider={provider} size={18} />
                  <div className={styles.providerCellText}>
                    <div>{getAIProviderLabel(provider, t)}</div>
                    <div className={styles.providerKey}>{provider}</div>
                  </div>
                </div>
              ),
            },
            { title: t('aiModels.usageColumnModel'), dataIndex: 'model_name' },
            { title: t('aiModels.usageColumnRequests'), dataIndex: 'requests' },
            { title: t('aiModels.usageColumnInputTokens'), dataIndex: 'input_tokens' },
            { title: t('aiModels.usageColumnOutputTokens'), dataIndex: 'output_tokens' },
            { title: t('aiModels.usageColumnTotalTokens'), dataIndex: 'total_tokens' },
            {
              title: t('aiModels.usageColumnCost'),
              dataIndex: 'total_cost',
              render: (value: number) => `$${value.toFixed(2)}`,
            },
            {
              title: t('aiModels.usageColumnSuccessRate'),
              dataIndex: 'success_rate',
              render: (value?: number | null) => formatNullableMetric(value, '%', t('common.none')),
            },
            {
              title: t('aiModels.usageColumnLatency'),
              dataIndex: 'avg_latency_ms',
              render: (value?: number | null) => formatNullableMetric(value, ' ms', t('common.none')),
            },
          ]}
        />
      </Card>
    </div>
  );
}
