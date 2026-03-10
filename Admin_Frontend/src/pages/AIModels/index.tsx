import { useEffect, useState } from 'react';
import { Card, Col, Row, Skeleton, Statistic, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import PageHero from '@/components/PageHero';
import { getAIModelsOverview, getAIProviders } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIModelsOverview, AIProviderSummary } from '@/types/aiModels';
import { getAIProviderLabel } from './i18n';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

const statusColorMap = {
  healthy: '#8b5cf6',
  degraded: '#60a5fa',
  disabled: '#9ca3af',
} as const;

export default function AIModelsHomePage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<AIModelsOverview | null>(null);
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);

  useEffect(() => {
    void Promise.all([getAIModelsOverview(), getAIProviders()]).then(([overviewData, providerData]) => {
      setOverview(overviewData);
      setProviders(providerData);
    });
  }, []);

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('aiModels.homeEyebrow')}
        title={t('aiModels.homeTitle')}
        description={t('aiModels.homeDescription')}
        tags={[
          t('aiModels.homeTagProviders'),
          t('aiModels.homeTagModels'),
          t('aiModels.homeTagCapabilities'),
          t('aiModels.homeTagPricing'),
          t('aiModels.homeTagUsage'),
        ]}
      />

      {overview ? (
        <div className={styles.metrics}>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('aiModels.metricProviders')} value={overview.providers_count} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('aiModels.metricModels')} value={overview.models_count} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('aiModels.metricActiveRules')} value={overview.active_rules_count} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title={t('aiModels.metricMonthlyCost')} prefix="$" value={overview.monthly_cost} precision={2} />
          </Card>
        </div>
      ) : (
        <Skeleton active />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Link to="/ai-models/providers" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>{t('aiModels.cardProvidersTitle')}</Title>
                  <Paragraph className={styles.muted}>{t('aiModels.cardProvidersDescription')}</Paragraph>
                </div>
                <Tag color="cyan">{providers.length}</Tag>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>{t('aiModels.cardProvidersAction')}</span>
              </div>
            </Card>
          </Link>
        </Col>
        <Col xs={24} lg={8}>
          <Link to="/ai-models/models" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>{t('aiModels.cardModelsTitle')}</Title>
                  <Paragraph className={styles.muted}>{t('aiModels.cardModelsDescription')}</Paragraph>
                </div>
                <Tag color="geekblue">{t('aiModels.cardModelsBadge')}</Tag>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>{t('aiModels.cardModelsAction')}</span>
              </div>
            </Card>
          </Link>
        </Col>
        <Col xs={24} lg={8}>
          <Link to="/ai-models/pricing-rules" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>{t('aiModels.cardPricingTitle')}</Title>
                  <Paragraph className={styles.muted}>{t('aiModels.cardPricingDescription')}</Paragraph>
                </div>
                <Tag color="volcano">{t('aiModels.cardPricingBadge')}</Tag>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>{t('aiModels.cardPricingAction')}</span>
              </div>
            </Card>
          </Link>
        </Col>
      </Row>

      <Card bordered={false} className={styles.card} title={t('aiModels.snapshotTitle')}>
        <Row gutter={[16, 16]}>
          {providers.map((provider) => (
            <Col key={provider.key} xs={24} md={12} xl={8}>
              <Link to={`/ai-models/providers/${provider.key}`} className={styles.resourceLink}>
                <Card size="small" className={styles.resourceCard}>
                  <div className={styles.resourceMeta}>
                    <div className={styles.providerHeading}>
                      <ProviderIcon provider={provider.key} size={24} />
                      <div className={styles.providerTextBlock}>
                        <Title level={5}>{getAIProviderLabel(provider.key, t)}</Title>
                        <Paragraph className={styles.muted}>{provider.description}</Paragraph>
                      </div>
                    </div>
                    <span className={styles.statusDot} style={{ backgroundColor: statusColorMap[provider.status] }} />
                  </div>
                  <div className={styles.resourceFooter}>
                    <span className={styles.muted}>
                      {t('aiModels.providerActiveModels', {
                        active: provider.active_models_count,
                        total: provider.models_count,
                      })}
                    </span>
                    <Tag>{provider.default_currency}</Tag>
                  </div>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
