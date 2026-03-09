import { useEffect, useState } from 'react';
import { Card, Select, Statistic, Table, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIModels, getAIUsage } from '@/api/aiModels';
import { PROVIDER_LABELS } from '@/types/aiModels';
import type { AIAdminModel, AIUsageRecord } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

function formatNullableMetric(value?: number | null, suffix = '') {
  if (value == null) {
    return '--';
  }
  return `${value}${suffix}`;
}

export default function UsagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
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
            使用统计
          </Title>
          <Paragraph className={styles.muted}>
            统计页作为独立资源保留全局视角，同时支持通过 `modelId` 过滤到某个模型上下文。
          </Paragraph>
        </div>
        <div className={styles.filterBar}>
          <Select
            allowClear
            value={modelId}
            placeholder="按模型筛选"
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
          <Statistic title="请求量" value={totalRequests} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="总 Tokens" value={totalTokens} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="总成本" prefix="$" value={totalCost} precision={2} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="统计窗口" value={usage[0]?.window_label ?? '累计'} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <Table
          rowKey="id"
          dataSource={usage}
          columns={[
            {
              title: '服务商',
              dataIndex: 'provider',
              render: (provider: string) => (
                <div className={styles.providerCell}>
                  <ProviderIcon provider={provider} size={18} />
                  <div className={styles.providerCellText}>
                    <div>{PROVIDER_LABELS[provider] ?? provider}</div>
                    <div className={styles.providerKey}>{provider}</div>
                  </div>
                </div>
              ),
            },
            { title: '模型', dataIndex: 'model_name' },
            { title: '请求量', dataIndex: 'requests' },
            { title: '输入 Tokens', dataIndex: 'input_tokens' },
            { title: '输出 Tokens', dataIndex: 'output_tokens' },
            { title: '总 Tokens', dataIndex: 'total_tokens' },
            {
              title: '总成本',
              dataIndex: 'total_cost',
              render: (value: number) => `$${value.toFixed(2)}`,
            },
            {
              title: '成功率',
              dataIndex: 'success_rate',
              render: (value?: number | null) => formatNullableMetric(value, '%'),
            },
            {
              title: '平均延迟',
              dataIndex: 'avg_latency_ms',
              render: (value?: number | null) => formatNullableMetric(value, ' ms'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
