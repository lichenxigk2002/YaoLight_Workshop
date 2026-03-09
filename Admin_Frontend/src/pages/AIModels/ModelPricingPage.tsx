import { useEffect, useState } from 'react';
import { Card, Empty, Tag, Typography } from 'antd';
import { useOutletContext } from 'react-router-dom';
import { getAIModelPricing, saveAIModelPricing } from '@/api/aiModels';
import { PRICING_TYPE_LABELS } from '@/types/aiModels';
import type { AIModelPricingRule } from '@/types/aiModels';
import type { ModelDetailOutletContext } from './ModelDetailLayout';
import PricingRuleEditor from './components/PricingRuleEditor';
import styles from './AIModels.module.scss';

const { Paragraph, Text, Title } = Typography;

function buildDraftRule(modelId: string, provider: string, modelName: string): AIModelPricingRule {
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
    description: '新模型的首版计费规则。',
    pricing_data: {
      price_per_million_tokens: 0,
    },
  };
}

export default function ModelPricingPage() {
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
    buildDraftRule(model.id, model.provider, model.model_name);

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

      <Card bordered={false} className={styles.card} title="规则历史">
        {rules.length === 0 ? (
          <Empty
            description="当前模型还没有历史规则，保存后会在这里展示版本记录。"
            className={styles.emptyBlock}
          />
        ) : (
          <div className={styles.historyList}>
            {rules.map((rule) => (
              <div key={rule.id} className={styles.historyItem}>
                <div className={styles.resourceMeta}>
                  <div>
                    <Title level={5} style={{ marginBottom: 6 }}>
                      v{rule.version} · {PRICING_TYPE_LABELS[rule.pricing_type]}
                    </Title>
                    <Paragraph className={styles.muted}>{rule.description ?? '暂无说明'}</Paragraph>
                  </div>
                  {rule.is_active ? <Tag color="green">当前生效</Tag> : <Tag>历史版本</Tag>}
                </div>
                <div className={styles.resourceFooter}>
                  <Text type="secondary">生效：{rule.effective_at}</Text>
                  <Text type="secondary">失效：{rule.expired_at ?? '仍在生效'}</Text>
                  <Text type="secondary">币种：{rule.currency}</Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
