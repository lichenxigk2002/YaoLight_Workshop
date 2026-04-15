import { Card, Empty, Select, Spin, Table, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import styles from '../AIWorkspace.module.scss';
import { buildModelPath, formatPricingType, getPricingSummary } from '../utils';
import type { AIModelRecord } from '../types';

export default function AIPricingRulesPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<AIModelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

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

  const filtered = useMemo(() => {
    return models.filter((item) => typeFilter === 'all' || item.pricing.pricingType === typeFilter);
  }, [models, typeFilter]);

  if (loading) return <Spin size="large" />;

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="PRICING RULES"
        title="Pricing registry"
        description="Pricing rules are normalized at provider + model_name, so model onboarding and pricing operations can move independently."
        tags={[`${models.length} rules`, 'versioned locally', 'pricing_type + pricing_data']}
      />

      <Card className={styles.card}>
        <Select
          value={typeFilter}
          style={{ width: 240 }}
          onChange={setTypeFilter}
          options={[{ label: 'All types', value: 'all' }, { label: 'Unified', value: 'unified' }, { label: 'Separate', value: 'separate' }, { label: 'Multi type', value: 'multi_type' }, { label: 'Segmented', value: 'segmented' }, { label: 'Per image', value: 'per_image' }]}
        />
      </Card>

      <Card className={styles.card}>
        {filtered.length === 0 ? (
          <Empty description="No pricing rules" />
        ) : (
          <Table
            rowKey="key"
            dataSource={filtered}
            pagination={{ pageSize: 10 }}
            onRow={(record) => ({ onClick: () => navigate(buildModelPath(record.meta.provider, record.meta.modelName, 'pricing')) })}
            columns={[
              {
                title: 'Model',
                render: (_value, record: AIModelRecord) => (
                  <div>
                    <div>{record.meta.displayName}</div>
                    <div className={styles.muted}>{record.meta.provider}</div>
                  </div>
                ),
              },
              { title: 'Type', render: (_value, record: AIModelRecord) => <Tag>{formatPricingType(record.pricing.pricingType)}</Tag> },
              { title: 'Summary', render: (_value, record: AIModelRecord) => getPricingSummary(record.pricing) },
              { title: 'Currency', dataIndex: ['pricing', 'currency'] },
              { title: 'Version', dataIndex: ['pricing', 'version'] },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
