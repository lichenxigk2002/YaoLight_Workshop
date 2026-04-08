import { useEffect, useState } from 'react';
import { Button, Card, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIPricingRules, getAIModels } from '@/api/aiModels';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { AIAdminModel, AIModelPricingRule } from '@/types/aiModels';
import { getAIProviderLabel, getAIPricingTypeLabel } from './i18n';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

export default function PricingRulesPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { canView: canViewModels } = useAdminPermission('ai_models.models');
  const [rules, setRules] = useState<AIModelPricingRule[]>([]);
  const [models, setModels] = useState<AIAdminModel[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      const tasks: Promise<void>[] = [
        getAIPricingRules().then((ruleData) => {
          if (!cancelled) {
            setRules(ruleData);
          }
        }),
      ];

      if (canViewModels) {
        tasks.push(
          getAIModels().then((modelData) => {
            if (!cancelled) {
              setModels(modelData);
            }
          }),
        );
      } else if (!cancelled) {
        setModels([]);
      }

      await Promise.all(tasks);
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [canViewModels]);

  return (
    <div className={styles.page}>
      <div>
        <Title level={3} className={styles.sectionTitle}>
          {t('aiModels.rulesTitle')}
        </Title>
        <Paragraph className={styles.muted}>{t('aiModels.rulesDescription')}</Paragraph>
      </div>

      <Card bordered={false} className={styles.card}>
        <Table
          rowKey="id"
          dataSource={rules}
          columns={[
            {
              title: t('aiModels.rulesColumnProvider'),
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
            { title: t('aiModels.rulesColumnModelName'), dataIndex: 'model_name' },
            {
              title: t('aiModels.rulesColumnType'),
              dataIndex: 'pricing_type',
              render: (type: AIModelPricingRule['pricing_type']) => getAIPricingTypeLabel(type, t),
            },
            {
              title: t('aiModels.rulesColumnVersion'),
              dataIndex: 'version',
              render: (version: number) => `v${version}`,
            },
            { title: t('aiModels.rulesColumnCurrency'), dataIndex: 'currency' },
            {
              title: t('aiModels.rulesColumnStatus'),
              dataIndex: 'is_active',
              render: (isActive: boolean) => (
                <Tag color={isActive ? 'green' : 'default'}>
                  {isActive ? t('aiModels.rulesStatusActive') : t('aiModels.rulesStatusHistory')}
                </Tag>
              ),
            },
            { title: t('aiModels.rulesColumnEffectiveAt'), dataIndex: 'effective_at' },
            {
              title: t('aiModels.rulesColumnActions'),
              key: 'actions',
              render: (_: unknown, rule: AIModelPricingRule) => {
                const model = models.find(
                  (item) => item.provider === rule.provider && item.model_name === rule.model_name,
                );

                return model ? (
                  <Button type="link" onClick={() => navigate(`/ai-models/models/${model.id}/pricing`)}>
                    {t('aiModels.rulesGoModelPricing')}
                  </Button>
                ) : (
                  t('common.none')
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
