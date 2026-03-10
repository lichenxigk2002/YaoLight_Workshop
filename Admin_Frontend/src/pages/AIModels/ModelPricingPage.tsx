import { useEffect, useState } from 'react';
import { Card, Empty, Tag, Typography } from 'antd';
import { useOutletContext } from 'react-router-dom';
import { getAIModelPricing, saveAIModelPricing } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIModelPricingRule } from '@/types/aiModels';
import { getAIPricingTypeLabel } from './i18n';
import type { ModelDetailOutletContext } from './ModelDetailLayout';
import PricingRuleEditor from './components/PricingRuleEditor';
import styles from './AIModels.module.scss';

const { Paragraph, Text, Title } = Typography;

function buildDraftRule(
  modelId: string,
  provider: string,
  modelName: string,
  description: string,
): AIModelPricingRule {
  return {
    id: `rule-${modelId}-v1`,
    provider,
    model_name: modelName,
    pricing_type: 'unified',
    currency: 'USD',
    is_active: true,
    version: 1,
    effective_at: new Date().toISOString().slice(0, 10),
    expired_at: null,
    description,
    pricing_data: {
      price_per_million_tokens: 0,
    },
  };
}

export default function ModelPricingPage() {
  const { t } = useI18n();
  const { model } = useOutletContext<ModelDetailOutletContext>();
  const [rules, setRules] = useState<AIModelPricingRule[]>([]);

  useEffect(() => {
    void getAIModelPricing(model.id).then((data) => {
      setRules(data);
    });
  }, [model.id]);

  const currentRule =
    rules.find((item) => item.is_active) ??
    rules[0] ??
    buildDraftRule(model.id, model.provider, model.model_name, t('aiModels.pricingDraftDescription'));

  const handleSave = async (rule: AIModelPricingRule) => {
    const saved = await saveAIModelPricing(model.id, rule);
    setRules((prev) => {
      const others = prev
        .filter((item) => item.id !== saved.id)
        .map((item) => ({
          ...item,
          is_active: false,
        }));
      return [saved, ...others];
    });
  };

  return (
    <div className={styles.page}>
      <PricingRuleEditor initialRule={currentRule} onSubmit={handleSave} />

      <Card bordered={false} className={styles.card} title={t('aiModels.pricingHistoryTitle')}>
        {rules.length === 0 ? (
          <Empty description={t('aiModels.pricingHistoryEmpty')} className={styles.emptyBlock} />
        ) : (
          <div className={styles.historyList}>
            {rules.map((rule) => (
              <div key={rule.id} className={styles.historyItem}>
                <div className={styles.resourceMeta}>
                  <div>
                    <Title level={5} style={{ marginBottom: 6 }}>
                      v{rule.version} · {getAIPricingTypeLabel(rule.pricing_type, t)}
                    </Title>
                    <Paragraph className={styles.muted}>{rule.description ?? t('aiModels.overviewNoDescription')}</Paragraph>
                  </div>
                  {rule.is_active ? (
                    <Tag color="green">{t('aiModels.pricingHistoryCurrent')}</Tag>
                  ) : (
                    <Tag>{t('aiModels.pricingHistoryVersion')}</Tag>
                  )}
                </div>
                <div className={styles.resourceFooter}>
                  <Text type="secondary">{t('aiModels.pricingEffective', { value: rule.effective_at })}</Text>
                  <Text type="secondary">
                    {t('aiModels.pricingExpired', { value: rule.expired_at ?? t('aiModels.pricingStillActive') })}
                  </Text>
                  <Text type="secondary">{rule.currency}</Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
