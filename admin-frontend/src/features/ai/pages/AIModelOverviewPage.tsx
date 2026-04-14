import { Button, Card, Descriptions, Empty, Space, Spin, Switch, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import ModelDetailNav from '../components/ModelDetailNav';
import styles from '../AIWorkspace.module.scss';
import {
  buildModelPath,
  decodeParam,
  formatMoney,
  formatPricingType,
  formatReleaseStage,
  getCapabilityLabels,
  getPricingSummary,
} from '../utils';
import type { AIModelRecord } from '../types';

export default function AIModelOverviewPage() {
  const navigate = useNavigate();
  const params = useParams();
  const provider = decodeParam(params.provider);
  const modelName = decodeParam(params.modelName);
  const [record, setRecord] = useState<AIModelRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    aiAdminApi.getModel(provider, modelName).then((data) => {
      if (!active) return;
      setRecord(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [provider, modelName]);

  const tags = useMemo(() => {
    if (!record) return [];
    return [
      record.meta.providerName,
      formatReleaseStage(record.meta.releaseStage),
      formatPricingType(record.pricing.pricingType),
      ...getCapabilityLabels(record.capability).slice(0, 3),
    ];
  }, [record]);

  async function toggleFlag(field: 'isActive' | 'isFeatured', value: boolean) {
    if (!record) return;
    const next = await aiAdminApi.updateModelMeta(record.meta.provider, record.meta.modelName, { [field]: value });
    setRecord(next);
    message.success('Model metadata updated.');
  }

  if (loading) return <Spin size="large" />;
  if (!record) {
    return (
      <Card className={styles.card}>
        <Empty description="Model not found" />
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <ModelDetailNav provider={provider} modelName={modelName} active="overview" />
      <PageHero
        eyebrow="MODEL OVERVIEW"
        title={record.meta.displayName}
        description={record.meta.description || 'Catalog metadata, pricing status, and usage health for this model.'}
        tags={tags}
        action={
          <Space>
            <Button onClick={() => navigate(buildModelPath(provider, modelName, 'capability'))}>Edit capability</Button>
            <Button type="primary" onClick={() => navigate(buildModelPath(provider, modelName, 'pricing'))}>Edit pricing</Button>
          </Space>
        }
      />

      <div className={styles.stats}>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>7d requests</div><div className={styles.metricValue}>{record.usage.last7dRequests.toLocaleString()}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Estimated revenue</div><div className={styles.metricValue}>{formatMoney(record.usage.estimatedRevenue, record.pricing.currency)}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Latency</div><div className={styles.metricValue}>{record.usage.avgLatencyMs} ms</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Error rate</div><div className={styles.metricValue}>{Math.round(record.usage.errorRate * 100)}%</div></Card>
      </div>

      <div className={styles.split}>
        <Card className={styles.card} title="Model metadata">
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Provider">{record.meta.providerName}</Descriptions.Item>
            <Descriptions.Item label="Provider key">{record.meta.provider}</Descriptions.Item>
            <Descriptions.Item label="Model name">{record.meta.modelName}</Descriptions.Item>
            <Descriptions.Item label="Source">{record.meta.source}</Descriptions.Item>
            <Descriptions.Item label="Base URL">{record.meta.defaultBaseUrl || 'Not set'}</Descriptions.Item>
            <Descriptions.Item label="Created at">{dayjs(record.meta.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="Updated at">{dayjs(record.meta.updatedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card className={styles.card} title="Quick flags">
          <Space direction="vertical" size="large">
            <div>
              <div>Active</div>
              <Switch checked={record.meta.isActive} onChange={(value) => toggleFlag('isActive', value)} />
            </div>
            <div>
              <div>Featured</div>
              <Switch checked={record.meta.isFeatured} onChange={(value) => toggleFlag('isFeatured', value)} />
            </div>
            <div>
              <div>Tags</div>
              <div className={styles.pillRow}>
                {record.meta.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </div>
          </Space>
        </Card>
      </div>

      <div className={styles.cards}>
        <Card className={styles.card} title="Capability summary">
          <div className={styles.pillRow}>
            {getCapabilityLabels(record.capability).map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
          <p className={styles.muted}>Max tokens limit: {record.capability.maxTokensLimit ?? 'Not set'}</p>
        </Card>
        <Card className={styles.card} title="Pricing summary">
          <div>{formatPricingType(record.pricing.pricingType)}</div>
          <p className={styles.muted}>{getPricingSummary(record.pricing)}</p>
        </Card>
      </div>
    </div>
  );
}
