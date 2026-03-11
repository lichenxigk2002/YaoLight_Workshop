import { useEffect, useState } from 'react';
import { Card, Col, Empty, Row, Skeleton, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIProviders } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIProviderSummary } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

export default function ProvidersPage() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<AIProviderSummary[] | null>(null);

  useEffect(() => {
    void getAIProviders().then(setProviders);
  }, []);

  if (!providers) {
    return <Skeleton active />;
  }

  if (providers.length === 0) {
    return <Empty description={t('aiProviders.providersEmpty')} className={styles.emptyBlock} />;
  }

  const statusLabelMap = {
    healthy: t('aiProviders.statusHealthy'),
    degraded: t('aiProviders.statusDegraded'),
    disabled: t('aiProviders.statusDisabled'),
  } as const;

  return (
    <div className={styles.page}>
      <div className={styles.sectionHeader}>
        <div>
          <Title level={3} className={styles.sectionTitle}>
            {t('aiProviders.providersTitle')}
          </Title>
          <Paragraph className={styles.muted}>{t('aiProviders.providersDescription')}</Paragraph>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {providers.map((provider) => (
          <Col key={provider.key} xs={24} md={12} xl={8}>
            <Link to={`/ai-models/providers/${provider.key}`} className={styles.resourceLink}>
              <Card bordered={false} className={styles.resourceCard}>
                <div className={styles.resourceMeta}>
                  <div className={styles.providerHeading}>
                    <ProviderIcon provider={provider.key} size={28} />
                    <div className={styles.providerTextBlock}>
                      <Title level={4}>{provider.name}</Title>
                      <Paragraph className={styles.muted}>{provider.description}</Paragraph>
                    </div>
                  </div>
                  <Tag
                    color={
                      provider.status === 'healthy'
                        ? 'green'
                        : provider.status === 'degraded'
                          ? 'orange'
                          : 'default'
                    }
                  >
                    {statusLabelMap[provider.status]}
                  </Tag>
                </div>
                <div className={styles.resourceFooter}>
                  <span className={styles.muted}>
                    {t('aiProviders.activeModels', {
                      active: provider.active_models_count,
                      total: provider.models_count,
                    })}
                  </span>
                  <Tag>{provider.default_currency}</Tag>
                </div>
                <div className={styles.resourceFooter}>
                  <div>
                    {provider.capabilities.map((capability) => (
                      <Tag key={capability}>{capability}</Tag>
                    ))}
                  </div>
                </div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  );
}
