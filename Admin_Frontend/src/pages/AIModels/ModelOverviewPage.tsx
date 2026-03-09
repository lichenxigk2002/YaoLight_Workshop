import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Statistic, Tag, Typography } from 'antd';
import { useNavigate, useOutletContext } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIModelPricing } from '@/api/aiModels';
import { PRICING_TYPE_LABELS, PROVIDER_LABELS } from '@/types/aiModels';
import type { AIModelPricingRule } from '@/types/aiModels';
import type { ModelDetailOutletContext } from './ModelDetailLayout';
import styles from './AIModels.module.scss';

const { Paragraph } = Typography;

function renderMetric(value?: number | null, suffix = '') {
  if (value == null) {
    return `--${suffix}`;
  }
  return `${value}${suffix}`;
}

function getStatusLabel(status: string) {
  if (status === 'active') {
    return '启用';
  }
  if (status === 'testing') {
    return '测试中';
  }
  return status;
}

export default function ModelOverviewPage() {
  const navigate = useNavigate();
  const { model } = useOutletContext<ModelDetailOutletContext>();
  const [activeRule, setActiveRule] = useState<AIModelPricingRule | null>(null);

  useEffect(() => {
    void getAIModelPricing(model.id).then((rules) => {
      setActiveRule(rules.find((item) => item.is_active) ?? rules[0] ?? null);
    });
  }, [model.id]);

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title="请求量" value={model.usage.requests} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="累计 Tokens" value={model.usage.tokens} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="累计成本" prefix="$" value={model.usage.total_cost} precision={2} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="平均延迟" value={renderMetric(model.usage.avg_latency_ms, ' ms')} />
        </Card>
      </div>

      <div className={styles.grid}>
        <div className={styles.span7}>
          <Card bordered={false} className={styles.card} title="基本信息">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="服务商">
                <div className={styles.providerCell}>
                  <ProviderIcon provider={model.provider} size={18} />
                  <div className={styles.providerCellText}>
                    <div>{PROVIDER_LABELS[model.provider] ?? model.provider}</div>
                    <div className={styles.providerKey}>{model.provider}</div>
                  </div>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="模型名">{model.model_name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={model.status === 'active' ? 'green' : model.status === 'testing' ? 'blue' : 'default'}>
                  {getStatusLabel(model.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="启用">{model.is_active ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="最后使用">{model.usage.last_used_at ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="成功率">{renderMetric(model.usage.success_rate, '%')}</Descriptions.Item>
            </Descriptions>
            <Paragraph className={styles.muted} style={{ marginTop: 16 }}>
              这里保留模型自身的元数据。能力开关、计费规则和统计信息通过子路由继续维护，不把不同领域字段混成一个大表单。
            </Paragraph>
          </Card>
        </div>

        <div className={styles.span5}>
          <Card
            bordered={false}
            className={styles.card}
            title="当前计费规则"
            extra={
              <Button type="link" onClick={() => navigate(`/ai-models/models/${model.id}/pricing`)}>
                编辑
              </Button>
            }
          >
            {activeRule ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="版本">v{activeRule.version}</Descriptions.Item>
                <Descriptions.Item label="类型">
                  {PRICING_TYPE_LABELS[activeRule.pricing_type]}
                </Descriptions.Item>
                <Descriptions.Item label="币种">{activeRule.currency}</Descriptions.Item>
                <Descriptions.Item label="生效时间">{activeRule.effective_at}</Descriptions.Item>
                <Descriptions.Item label="说明">{activeRule.description ?? '暂无说明'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Paragraph className={styles.muted}>尚未配置计费规则。</Paragraph>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
