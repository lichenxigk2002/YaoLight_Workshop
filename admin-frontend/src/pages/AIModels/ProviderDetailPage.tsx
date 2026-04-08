import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Empty, Table, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import PageHero from '@/components/PageHero';
import { getAIProvider } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIProviderDetail } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph } = Typography;

function getModelStatusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case 'active':
      return t('aiProviders.modelStatusActive');
    case 'testing':
      return t('aiProviders.modelStatusTesting');
    case 'disabled':
      return t('aiProviders.modelStatusDisabled');
    default:
      return status;
  }
}

export default function ProviderDetailPage() {
  const { provider } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [detail, setDetail] = useState<AIProviderDetail | null | undefined>(undefined);

  useEffect(() => {
    if (!provider) {
      setDetail(null);
      return;
    }

    void getAIProvider(provider).then(setDetail);
  }, [provider]);

  const providerStatusLabels = useMemo(
    () => ({
      healthy: t('aiProviders.statusHealthy'),
      degraded: t('aiProviders.statusDegraded'),
      disabled: t('aiProviders.statusDisabled'),
    }),
    [t],
  );

  if (detail === undefined) {
    return <Card loading bordered={false} className={styles.card} />;
  }

  if (!detail) {
    return <Empty description={t('aiProviders.detailNotFound')} className={styles.emptyBlock} />;
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('aiProviders.detailEyebrow')}
        title={(
          <div className={styles.providerHeading}>
            <ProviderIcon provider={detail.key} size={28} />
            <span>{detail.name}</span>
          </div>
        )}
        description={detail.description}
        tags={[
          providerStatusLabels[detail.status],
          t('aiProviders.detailTagModelCount', { count: detail.models_count }),
          detail.default_currency,
        ]}
        action={<Button onClick={() => navigate('/ai-models/providers')}>{t('aiProviders.detailBack')}</Button>}
      />

      <div className={styles.grid}>
        <div className={styles.span5}>
          <Card bordered={false} className={styles.card} title={t('aiProviders.detailInfoTitle')}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('aiProviders.fieldKey')}>{detail.key}</Descriptions.Item>
              <Descriptions.Item label={t('aiProviders.fieldStatus')}>
                <Tag
                  color={detail.status === 'healthy' ? 'green' : detail.status === 'degraded' ? 'orange' : 'default'}
                >
                  {providerStatusLabels[detail.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('aiProviders.fieldCurrency')}>{detail.default_currency}</Descriptions.Item>
              <Descriptions.Item label={t('aiProviders.fieldActiveModels')}>
                {detail.active_models_count}/{detail.models_count}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiProviders.fieldCapabilities')}>
                {detail.capabilities.map((capability) => (
                  <Tag key={capability}>{capability}</Tag>
                ))}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>

        <div className={styles.span7}>
          <Card bordered={false} className={styles.card} title={t('aiProviders.detailModelsTitle')}>
            <Paragraph className={styles.muted}>{t('aiProviders.detailModelsDescription')}</Paragraph>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={detail.models}
              columns={[
                { title: t('aiProviders.tableDisplayName'), dataIndex: 'display_name' },
                { title: t('aiProviders.tableModelName'), dataIndex: 'model_name' },
                {
                  title: t('aiProviders.tableStatus'),
                  dataIndex: 'status',
                  render: (status: string) => (
                    <Tag color={status === 'active' ? 'green' : status === 'testing' ? 'blue' : 'default'}>
                      {getModelStatusLabel(status, t)}
                    </Tag>
                  ),
                },
                {
                  title: t('aiProviders.tableActions'),
                  key: 'actions',
                  render: (_: unknown, record: AIProviderDetail['models'][number]) => (
                    <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                      {t('aiProviders.actionViewDetail')}
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
