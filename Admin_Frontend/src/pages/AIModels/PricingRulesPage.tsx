import { useEffect, useState } from 'react';
import { Button, Card, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIPricingRules, getAIModels } from '@/api/aiModels';
import { PRICING_TYPE_LABELS, PROVIDER_LABELS } from '@/types/aiModels';
import type { AIAdminModel, AIModelPricingRule } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

export default function PricingRulesPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AIModelPricingRule[]>([]);
  const [models, setModels] = useState<AIAdminModel[]>([]);

  useEffect(() => {
    void Promise.all([getAIPricingRules(), getAIModels()]).then(([ruleData, modelData]) => {
      setRules(ruleData);
      setModels(modelData);
    });
  }, []);

  return (
    <div className={styles.page}>
      <div>
        <Title level={3} className={styles.sectionTitle}>
          计费规则
        </Title>
        <Paragraph className={styles.muted}>
          这里展示规则资源本身，方便做版本管理、历史回溯和全局搜索，不与模型基础信息混在一起。
        </Paragraph>
      </div>

      <Card bordered={false} className={styles.card}>
        <Table
          rowKey="id"
          dataSource={rules}
          columns={[
            {
              title: '服务商',
              dataIndex: 'provider',
              render: (provider: string) => (
                <div className={styles.providerCell}>
                  <ProviderIcon provider={provider} size={18} />
                  <div className={styles.providerCellText}>
                    <div>{PROVIDER_LABELS[provider] ?? provider}</div>
                    <div className={styles.providerKey}>{provider}</div>
                  </div>
                </div>
              ),
            },
            { title: '模型名', dataIndex: 'model_name' },
            {
              title: '类型',
              dataIndex: 'pricing_type',
              render: (type: AIModelPricingRule['pricing_type']) => PRICING_TYPE_LABELS[type],
            },
            {
              title: '版本',
              dataIndex: 'version',
              render: (version: number) => `v${version}`,
            },
            { title: '币种', dataIndex: 'currency' },
            {
              title: '状态',
              dataIndex: 'is_active',
              render: (isActive: boolean) => (
                <Tag color={isActive ? 'green' : 'default'}>{isActive ? '生效中' : '历史版本'}</Tag>
              ),
            },
            { title: '生效时间', dataIndex: 'effective_at' },
            {
              title: '操作',
              key: 'actions',
              render: (_, rule) => {
                const model = models.find(
                  (item) => item.provider === rule.provider && item.model_name === rule.model_name,
                );

                return model ? (
                  <Button type="link" onClick={() => navigate(`/ai-models/models/${model.id}/pricing`)}>
                    前往模型规则页
                  </Button>
                ) : (
                  '-'
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
