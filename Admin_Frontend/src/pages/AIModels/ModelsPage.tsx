import { useEffect, useState } from 'react';
import { App, Button, Card, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { deleteAIModel, getAIModels } from '@/api/aiModels';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { AIAdminModel } from '@/types/aiModels';
import { getAIModelStatusLabel, getAIProviderLabel, getAIPricingTypeLabel } from './i18n';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

export default function ModelsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { canEdit } = useAdminPermission('ai_models.models');
  const [models, setModels] = useState<AIAdminModel[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void getAIModels().then(setModels);
  }, []);

  const handleDelete = async (record: AIAdminModel) => {
    try {
      setDeletingId(record.id);
      await deleteAIModel(record.id);
      setModels((current) => current.filter((item) => item.id !== record.id));
      message.success(t('aiModels.deleteSuccess'));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('aiModels.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <Title level={3} className={styles.sectionTitle}>
            {t('aiModels.modelsTitle')}
          </Title>
          <Paragraph className={styles.muted}>{t('aiModels.modelsDescription')}</Paragraph>
        </div>
        {canEdit ? (
          <Button type="primary" onClick={() => navigate('/ai-models/models/new')}>
            {t('aiModels.createModel')}
          </Button>
        ) : null}
      </div>

      <Card bordered={false} className={styles.card}>
        <Table
          rowKey="id"
          dataSource={models}
          columns={[
            {
              title: t('aiModels.tableDisplayName'),
              dataIndex: 'display_name',
              render: (value: string, record: AIAdminModel) => (
                <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                  {value}
                </Button>
              ),
            },
            {
              title: t('aiModels.tableProvider'),
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
            { title: t('aiModels.tableModelName'), dataIndex: 'model_name' },
            {
              title: t('aiModels.tableStatus'),
              dataIndex: 'status',
              render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : status === 'testing' ? 'blue' : 'default'}>
                  {getAIModelStatusLabel(status, t)}
                </Tag>
              ),
            },
            {
              title: t('aiModels.tablePricing'),
              key: 'pricing_type',
              render: (_: unknown, record: AIAdminModel) =>
                record.current_pricing?.pricing_type
                  ? getAIPricingTypeLabel(record.current_pricing.pricing_type, t)
                  : t('aiModels.pricingUnconfigured'),
            },
            {
              title: t('aiModels.tableRequests'),
              key: 'requests',
              render: (_: unknown, record: AIAdminModel) => new Intl.NumberFormat(locale).format(record.usage.requests),
            },
            {
              title: t('aiModels.tableActions'),
              key: 'actions',
              render: (_: unknown, record: AIAdminModel) => (
                <Space>
                  <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                    {t('aiModels.actionOpenDetail')}
                  </Button>
                  {canEdit ? (
                    <Popconfirm
                      title={t('aiModels.deleteConfirmTitle')}
                      description={t('aiModels.deleteConfirmDescription')}
                      okText={t('aiModels.actionDelete')}
                      cancelText={t('aiModels.actionCancel')}
                      okButtonProps={{ danger: true, loading: deletingId === record.id }}
                      onConfirm={() => void handleDelete(record)}
                    >
                      <Button type="link" danger loading={deletingId === record.id}>
                        {t('aiModels.actionDelete')}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
