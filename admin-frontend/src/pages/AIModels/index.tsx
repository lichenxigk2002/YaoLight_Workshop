import { useEffect, useState } from 'react';
import { Card, Col, Row, Skeleton, Statistic, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import AIIcon from '@/components/Icons/AIIcon';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import PageHero from '@/components/PageHero';
import { getAIPricingRules, getAIOverviewModels, getAIProviders, getAIUsage } from '@/api/aiModels';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { AIAdminModel, AIProviderSummary, AIUsageRecord } from '@/types/aiModels';
import { getAIProviderLabel } from './i18n';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

const statusColorMap = {
  healthy: 'var(--admin-brand)',
  degraded: 'var(--admin-accent)',
  disabled: '#9ca3af',
} as const;

export default function AIModelsHomePage() {
  const { t } = useI18n();
  const { canView: canViewProviders } = useAdminPermission('ai_models.providers');
  const { canView: canViewPricingRules } = useAdminPermission('ai_models.pricing_rules');
  const { canView: canViewUsage } = useAdminPermission('ai_models.usage');
  const { canView: canViewModels } = useAdminPermission('ai_models.models');
  const [overviewModels, setOverviewModels] = useState<AIAdminModel[] | null>(null);
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [activeRulesCount, setActiveRulesCount] = useState<number | null>(null);
  const [usage, setUsage] = useState<AIUsageRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      const tasks: Promise<void>[] = [
        getAIOverviewModels().then((data) => {
          if (!cancelled) {
            setOverviewModels(data);
          }
        }),
      ];

      if (canViewProviders) {
        tasks.push(
          getAIProviders().then((data) => {
            if (!cancelled) {
              setProviders(data);
            }
          }),
        );
      } else if (!cancelled) {
        setProviders([]);
      }

      if (canViewPricingRules) {
        tasks.push(
          getAIPricingRules().then((data) => {
            if (!cancelled) {
              setActiveRulesCount(data.filter((rule) => rule.is_active).length);
            }
          }),
        );
      } else if (!cancelled) {
        setActiveRulesCount(null);
      }

      if (canViewUsage) {
        tasks.push(
          getAIUsage().then((data) => {
            if (!cancelled) {
              setUsage(data);
            }
          }),
        );
      } else if (!cancelled) {
        setUsage([]);
      }

      await Promise.all(tasks);
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [canViewPricingRules, canViewProviders, canViewUsage]);

  const metrics = [
    { key: 'models', title: t('aiModels.metricModels'), value: overviewModels?.length ?? 0, visible: true },
    { key: 'providers', title: t('aiModels.metricProviders'), value: providers.length, visible: canViewProviders },
    { key: 'rules', title: t('aiModels.metricActiveRules'), value: activeRulesCount ?? 0, visible: canViewPricingRules },
    {
      key: 'usage',
      title: t('aiModels.metricMonthlyCost'),
      value: usage.reduce((sum, item) => sum + item.total_cost, 0),
      visible: canViewUsage,
      prefix: '$',
      precision: 2,
    },
  ].filter((item) => item.visible);

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

      {overviewModels ? (
        <div className={styles.metrics}>
          {metrics.map((metric) => (
            <Card key={metric.key} bordered={false} className={styles.card}>
              <Statistic title={metric.title} value={metric.value} prefix={metric.prefix} precision={metric.precision} />
            </Card>
          ))}
        </div>
      ) : (
        <Skeleton active />
      )}

      <Row gutter={[16, 16]}>
        {canViewProviders ? (
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
        ) : null}
        {canViewModels ? (
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
        ) : null}
        {canViewPricingRules ? (
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
        ) : null}
      </Row>

      {canViewProviders ? (
        <Card bordered={false} className={styles.card} title={t('aiModels.snapshotTitle')}>
          <Row gutter={[16, 16]}>
            {providers.map((provider) => (
              <Col key={provider.key} xs={24} md={12} xl={8}>
                <Link to={`/ai-models/providers/${provider.key}`} className={styles.resourceLink}>
                  <Card size="small" className={styles.resourceCard}>
                    <div className={styles.resourceMeta}>
                      <div className={styles.providerHeading}>
                        <AIIcon iconKey={provider.icon} fallbackProvider={provider.key} size={24} />
                        <div className={styles.providerTextBlock}>
                          <Title level={5}>{provider.name || getAIProviderLabel(provider.key, t)}</Title>
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
      ) : null}
    </div>
  );
}
