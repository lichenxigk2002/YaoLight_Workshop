import { Button, Card, Empty, Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import styles from '../AIWorkspace.module.scss';
import { buildProviderPath } from '../utils';
import type { AIProviderInsight } from '../types';

export default function AIProvidersPage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<AIProviderInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    aiAdminApi.getProviders().then((data) => {
      if (!active) return;
      setProviders(data);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <Spin size="large" />;
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="AI REGISTRY"
        title="Provider architecture"
        description="Providers are the top-level templates. Each provider fans out into model catalog entries, capability configs, and pricing rules."
        tags={[`${providers.length} providers`, 'template-driven', 'admin workspace']}
        action={<Button type="primary" onClick={() => navigate('/ai-models/models/new')}>New model</Button>}
      />

      {providers.length === 0 ? (
        <Card className={styles.card}>
          <Empty description="No providers available" />
        </Card>
      ) : (
        <div className={styles.cards}>
          {providers.map((provider) => (
            <Card
              key={provider.provider}
              className={styles.card}
              title={provider.name}
              extra={<Tag color={provider.isActive ? 'green' : 'default'}>{provider.isActive ? 'Active' : 'Inactive'}</Tag>}
              actions={[
                <Button type="link" key="details" onClick={() => navigate(buildProviderPath(provider.provider))}>
                  View details
                </Button>,
                <Button type="link" key="models" onClick={() => navigate('/ai-models/models')}>
                  View models
                </Button>,
              ]}
            >
              <p className={styles.muted}>{provider.description || 'No provider description.'}</p>
              <div className={styles.stack}>
                <div className={styles.pillRow}>
                  <Tag>{provider.provider}</Tag>
                  <Tag>{provider.modelCount} models</Tag>
                  <Tag>{provider.activeModelCount} active</Tag>
                  <Tag>{provider.thinkingModelCount} thinking</Tag>
                  <Tag>{provider.imageModelCount} image or vision</Tag>
                </div>
                <div>
                  <strong>Base URL</strong>
                  <div className={styles.muted}>{provider.defaultBaseUrl || 'Inherited from model config'}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
