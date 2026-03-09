import { Button, Card, Descriptions, Empty, Spin, Table, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import styles from '../AIWorkspace.module.scss';
import { buildModelPath, decodeParam, getCapabilityLabels, getPricingSummary } from '../utils';
import type { AIModelRecord, AIProviderInsight } from '../types';

export default function AIProviderDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const providerName = decodeParam(params.provider);
  const [provider, setProvider] = useState<AIProviderInsight | null>(null);
  const [models, setModels] = useState<AIModelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([aiAdminApi.getProvider(providerName), aiAdminApi.getModels()]).then(([providerData, modelData]) => {
      if (!active) return;
      setProvider(providerData);
      setModels(modelData.filter((item) => item.meta.provider === providerName));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [providerName]);

  const tags = useMemo(() => {
    if (!provider) return [];
    return [`${provider.modelCount} models`, `${provider.activeModelCount} active`, provider.provider];
  }, [provider]);

  if (loading) return <Spin size="large" />;
  if (!provider) {
    return (
      <Card className={styles.card}>
        <Empty description="Provider not found" />
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="PROVIDER DETAIL"
        title={provider.name}
        description={provider.description || 'Provider template details for AI registry management.'}
        tags={tags}
        action={<Button type="primary" onClick={() => navigate('/ai-models/models/new')}>Add model</Button>}
      />

      <div className={styles.split}>
        <Card className={styles.card} title="Provider configuration">
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Provider key">{provider.provider}</Descriptions.Item>
            <Descriptions.Item label="Default base URL">{provider.defaultBaseUrl || 'Not set'}</Descriptions.Item>
            <Descriptions.Item label="Default endpoint">{provider.defaultEndpoint || 'Not set'}</Descriptions.Item>
            <Descriptions.Item label="Supported models">{provider.supportedModels.length}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card className={styles.card} title="Default config">
          <pre className={styles.jsonBox}>{JSON.stringify(provider.defaultConfig, null, 2)}</pre>
        </Card>
      </div>

      <Card className={styles.card} title="Models under this provider">
        <Table
          rowKey="key"
          dataSource={models}
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(buildModelPath(record.meta.provider, record.meta.modelName)),
          })}
          columns={[
            {
              title: 'Model',
              dataIndex: ['meta', 'displayName'],
              render: (_value, record: AIModelRecord) => (
                <div>
                  <div>{record.meta.displayName}</div>
                  <div className={styles.muted}>{record.meta.modelName}</div>
                </div>
              ),
            },
            {
              title: 'Capability',
              render: (_value, record: AIModelRecord) => (
                <div className={styles.pillRow}>
                  {getCapabilityLabels(record.capability).map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </div>
              ),
            },
            {
              title: 'Pricing',
              render: (_value, record: AIModelRecord) => getPricingSummary(record.pricing),
            },
            {
              title: 'Status',
              render: (_value, record: AIModelRecord) => (
                <Tag color={record.meta.isActive ? 'green' : 'default'}>
                  {record.meta.isActive ? 'Active' : 'Inactive'}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
