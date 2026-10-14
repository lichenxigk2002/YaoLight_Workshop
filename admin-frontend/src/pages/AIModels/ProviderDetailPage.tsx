import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Form, Input, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import AIIcon from '@/components/Icons/AIIcon';
import PageHero from '@/components/PageHero';
import { getAIProvider, updateAIProvider } from '@/api/aiModels';
import { getAIIconOptions } from '@/features/ai/iconCatalog';
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
  const { message } = App.useApp();
  const [detail, setDetail] = useState<AIProviderDetail | null | undefined>(undefined);
  const [form] = Form.useForm<Pick<AIProviderDetail, 'name' | 'icon' | 'description'>>();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const providerIconOptions = getAIIconOptions(['provider', 'model']);

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

  useEffect(() => {
    if (!detail) return;
    form.setFieldsValue({
      name: detail.name,
      icon: detail.icon,
      description: detail.description,
    });
  }, [detail, form]);

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
            <AIIcon iconKey={detail.icon} fallbackProvider={detail.key} size={28} />
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
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={async (values) => {
                  if (!provider) return;
                  try {
                    setSaving(true);
                    const updated = await updateAIProvider(provider, {
                      name: values.name?.trim(),
                      icon: values.icon?.trim() || null,
                      description: values.description?.trim() || null,
                    });
                    setDetail(updated);
                    setEditing(false);
                    message.success(t('aiProviders.editSuccess'));
                  } catch (error: unknown) {
                    message.error(error instanceof Error ? error.message : t('aiProviders.editFailed'));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <div className={styles.formGrid}>
                  <Form.Item label={t('aiProviders.fieldKey')}>
                    <Input value={detail.key} disabled />
                  </Form.Item>
                  <Form.Item label={t('aiProviders.fieldStatus')}>
                    <Switch checked={detail.status !== 'disabled'} disabled />
                  </Form.Item>
                  <Form.Item
                    label={t('aiProviders.formNameLabel')}
                    name="name"
                    rules={[{ required: true, message: t('aiProviders.formNameRequired') }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label={t('aiProviders.formIconLabel')}
                    name="icon"
                    tooltip={t('aiProviders.formIconTooltip')}
                  >
                    <Select
                      allowClear
                      showSearch
                      placeholder={t('aiProviders.formIconPlaceholder')}
                      options={providerIconOptions}
                      filterOption={(input, option) =>
                        typeof option?.searchText === 'string' && option.searchText.includes(input.trim().toLowerCase())
                      }
                      optionRender={(option) => {
                        const data = option.data as (typeof providerIconOptions)[number];
                        return (
                          <Space>
                            {data.preview}
                            <span>{data.label}</span>
                          </Space>
                        );
                      }}
                      optionLabelProp="label"
                    />
                  </Form.Item>
                </div>
                <Form.Item label={t('aiModels.formDescriptionLabel')} name="description">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Space>
                  <Button onClick={() => setEditing(false)}>{t('aiModels.actionCancel')}</Button>
                  <Button type="primary" loading={saving} onClick={() => void form.submit()}>
                    {t('aiModels.actionSave')}
                  </Button>
                </Space>
              </Form>
            ) : (
              <>
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
                <div style={{ marginTop: 16 }}>
                  <Button type="link" onClick={() => setEditing(true)}>{t('aiProviders.actionEdit')}</Button>
                </div>
              </>
            )}
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
                {
                  title: t('aiProviders.tableDisplayName'),
                  dataIndex: 'display_name',
                  render: (value: string, record: AIProviderDetail['models'][number]) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <AIIcon iconKey={record.model_icon || record.provider_icon} fallbackProvider={record.provider} size={16} />
                      <span>{value}</span>
                    </span>
                  ),
                },
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
