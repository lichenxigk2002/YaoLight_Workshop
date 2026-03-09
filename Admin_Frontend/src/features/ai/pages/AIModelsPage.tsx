import { Button, Card, Input, Select, Space, Spin, Table, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import styles from '../AIWorkspace.module.scss';
import { buildModelPath, formatPricingType, formatReleaseStage, getCapabilityLabels, getPricingSummary } from '../utils';
import type { AIModelRecord } from '../types';

export default function AIModelsPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<AIModelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    aiAdminApi.getModels().then((data) => {
      if (!active) return;
      setModels(data);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const providerOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(models.map((item) => item.meta.provider)))];
  }, [models]);

  const filteredModels = useMemo(() => {
    return models.filter((item) => {
      const hitProvider = providerFilter === 'all' || item.meta.provider === providerFilter;
      const keyword = search.trim().toLowerCase();
      const hitKeyword =
        keyword === '' ||
        item.meta.displayName.toLowerCase().includes(keyword) ||
        item.meta.modelName.toLowerCase().includes(keyword);
      return hitProvider && hitKeyword;
    });
  }, [models, providerFilter, search]);

  if (loading) return <Spin size="large" />;

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="MODEL CATALOG"
        title="Model registry"
        description="This view manages the platform model catalog, not user-owned API key bindings. Model records are composed from provider templates plus admin workspace overrides."
        tags={[`${models.length} models`, `${models.filter((item) => item.meta.isActive).length} active`, 'provider + model_name']}
        action={<Button type="primary" onClick={() => navigate('/ai-models/models/new')}>New model</Button>}
      />

      <div className={styles.stats}>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Total models</div><div className={styles.metricValue}>{models.length}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Featured</div><div className={styles.metricValue}>{models.filter((item) => item.meta.isFeatured).length}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Thinking-ready</div><div className={styles.metricValue}>{models.filter((item) => item.capability.supportThinking).length}</div></Card>
        <Card className={styles.metricCard}><div className={styles.metricLabel}>Vision/Image</div><div className={styles.metricValue}>{models.filter((item) => item.capability.supportVision || item.capability.supportImageGeneration).length}</div></Card>
      </div>

      <Card className={styles.card}>
        <Space wrap>
          <Input.Search placeholder="Search model" allowClear onChange={(event) => setSearch(event.target.value)} style={{ width: 240 }} />
          <Select value={providerFilter} style={{ width: 220 }} onChange={setProviderFilter} options={providerOptions.map((item) => ({ label: item, value: item }))} />
        </Space>
      </Card>

      <Card className={styles.card}>
        <Table
          rowKey="key"
          dataSource={filteredModels}
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({ onClick: () => navigate(buildModelPath(record.meta.provider, record.meta.modelName)) })}
          columns={[
            {
              title: 'Model',
              render: (_value, record: AIModelRecord) => (
                <div>
                  <div>{record.meta.displayName}</div>
                  <div className={styles.muted}>{record.meta.modelName}</div>
                </div>
              ),
            },
            { title: 'Provider', dataIndex: ['meta', 'providerName'] },
            {
              title: 'Stage',
              render: (_value, record: AIModelRecord) => <Tag>{formatReleaseStage(record.meta.releaseStage)}</Tag>,
            },
            {
              title: 'Capability',
              render: (_value, record: AIModelRecord) => (
                <div className={styles.pillRow}>
                  {getCapabilityLabels(record.capability).slice(0, 4).map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </div>
              ),
            },
            {
              title: 'Pricing',
              render: (_value, record: AIModelRecord) => (
                <div className={styles.tableSummary}>
                  <strong>{formatPricingType(record.pricing.pricingType)}</strong>
                  <span className={styles.muted}>{getPricingSummary(record.pricing)}</span>
                </div>
              ),
            },
            {
              title: '7d requests',
              render: (_value, record: AIModelRecord) => record.usage.last7dRequests.toLocaleString(),
            },
          ]}
        />
      </Card>
    </div>
  );
}
