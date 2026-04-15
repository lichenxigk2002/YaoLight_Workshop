import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useNavigate, useOutletContext } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIModelPricing, updateAIModel } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIAdminModel, AIModelPricingRule } from '@/types/aiModels';
import { getAIModelStatusLabel, getAIProviderLabel, getAIPricingTypeLabel } from './i18n';
import type { ModelDetailOutletContext } from './ModelDetailLayout';
import styles from './AIModels.module.scss';

const { Paragraph } = Typography;

function renderMetric(value?: number | null, suffix = '', fallback = '--') {
  if (value == null) {
    return `${fallback}${suffix}`;
  }
  return `${value}${suffix}`;
}

export default function ModelOverviewPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const { model, canEdit, setModel } = useOutletContext<ModelDetailOutletContext>();
  const [form] = Form.useForm<
    Pick<AIAdminModel, 'display_name' | 'status' | 'is_active' | 'sort_order' | 'description'>
  >();
  const [activeRule, setActiveRule] = useState<AIModelPricingRule | null>(null);
  const [updatingActive, setUpdatingActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleToggleActive = async (checked: boolean) => {
    try {
      setUpdatingActive(true);
      const updated = await updateAIModel(model.id, { is_active: checked });
      setModel(updated);
      message.success(checked ? t('aiModels.overviewToggleEnabled') : t('aiModels.overviewToggleDisabled'));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('aiModels.overviewToggleFailed'));
    } finally {
      setUpdatingActive(false);
    }
  };

  useEffect(() => {
    void getAIModelPricing(model.id).then((rules) => {
      setActiveRule(rules.find((item) => item.is_active) ?? rules[0] ?? null);
    });
  }, [model.id]);

  useEffect(() => {
    form.setFieldsValue({
      display_name: model.display_name,
      status: model.status,
      is_active: model.is_active,
      sort_order: model.sort_order,
      description: model.description,
    });
  }, [form, model]);

  const handleSave = async (values: Pick<AIAdminModel, 'display_name' | 'status' | 'is_active' | 'sort_order' | 'description'>) => {
    try {
      setSaving(true);
      const updated = await updateAIModel(model.id, {
        display_name: values.display_name.trim(),
        status: values.status,
        is_active: values.is_active,
        sort_order: values.sort_order ?? 0,
        description: values.description?.trim() || null,
      });
      setModel(updated);
      setEditing(false);
      message.success(t('aiModels.editSuccess'));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('aiModels.editFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    form.setFieldsValue({
      display_name: model.display_name,
      status: model.status,
      is_active: model.is_active,
      sort_order: model.sort_order,
      description: model.description,
    });
    setEditing(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.overviewMetricRequests')} value={model.usage.requests} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.overviewMetricTokens')} value={model.usage.tokens} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.overviewMetricCost')} prefix="$" value={model.usage.total_cost} precision={2} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('aiModels.overviewMetricLatency')} value={renderMetric(model.usage.avg_latency_ms, ' ms')} />
        </Card>
      </div>

      <div className={styles.grid}>
        <div className={styles.span7}>
          <Card
            bordered={false}
            className={styles.card}
            title={t('aiModels.overviewBasicInfoTitle')}
            extra={
              editing ? (
                <Space>
                  <Button onClick={handleCancelEdit}>{t('aiModels.actionCancel')}</Button>
                  <Button type="primary" loading={saving} onClick={() => void form.submit()}>
                    {t('aiModels.actionSave')}
                  </Button>
                </Space>
              ) : (
                canEdit ? (
                  <Button type="link" onClick={() => setEditing(true)}>
                    {t('aiModels.overviewEdit')}
                  </Button>
                ) : null
              )
            }
          >
            {editing ? (
              <Form form={form} layout="vertical" onFinish={handleSave}>
                <div className={styles.formGrid}>
                  <Form.Item label={t('aiModels.overviewProvider')}>
                    <Input value={getAIProviderLabel(model.provider, t)} disabled />
                  </Form.Item>
                  <Form.Item label={t('aiModels.overviewModelName')}>
                    <Input value={model.model_name} disabled />
                  </Form.Item>
                  <Form.Item
                    label={t('aiModels.formDisplayNameLabel')}
                    name="display_name"
                    rules={[{ required: true, message: t('aiModels.formDisplayNameRequired') }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('aiModels.overviewStatus')} name="status" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { label: getAIModelStatusLabel('active', t), value: 'active' },
                        { label: getAIModelStatusLabel('testing', t), value: 'testing' },
                        { label: getAIModelStatusLabel('disabled', t), value: 'disabled' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('aiModels.overviewEnabled')} name="is_active" valuePropName="checked">
                    <Switch
                      checkedChildren={t('aiModels.switchEnabled')}
                      unCheckedChildren={t('aiModels.switchDisabled')}
                    />
                  </Form.Item>
                  <Form.Item label={t('aiModels.overviewSortOrder')} name="sort_order">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </div>
                <Form.Item label={t('aiModels.formDescriptionLabel')} name="description">
                  <Input.TextArea rows={4} placeholder={t('aiModels.formDescriptionPlaceholder')} />
                </Form.Item>
              </Form>
            ) : (
              <Descriptions column={2} size="small">
                <Descriptions.Item label={t('aiModels.overviewProvider')}>
                  <div className={styles.providerCell}>
                    <ProviderIcon provider={model.provider} size={18} />
                    <div className={styles.providerCellText}>
                      <div>{getAIProviderLabel(model.provider, t)}</div>
                      <div className={styles.providerKey}>{model.provider}</div>
                    </div>
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewModelName')}>{model.model_name}</Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewDisplayName')}>{model.display_name}</Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewStatus')}>
                  <Tag color={model.status === 'active' ? 'green' : model.status === 'testing' ? 'blue' : 'default'}>
                    {getAIModelStatusLabel(model.status, t)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewEnabled')}>
                  <Switch
                    checked={model.is_active}
                    loading={updatingActive}
                    disabled={!canEdit}
                    checkedChildren={t('aiModels.switchEnabled')}
                    unCheckedChildren={t('aiModels.switchDisabled')}
                    onChange={handleToggleActive}
                  />
                </Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewSortOrder')}>{model.sort_order}</Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewLastUsed')}>
                  {model.usage.last_used_at ?? t('common.none')}
                </Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewSuccessRate')}>
                  {renderMetric(model.usage.success_rate, '%', t('common.none'))}
                </Descriptions.Item>
                <Descriptions.Item label={t('aiModels.formDescriptionLabel')} span={2}>
                  {model.description || t('aiModels.overviewNoDescription')}
                </Descriptions.Item>
              </Descriptions>
            )}
            <Paragraph className={styles.muted} style={{ marginTop: 16 }}>
              {t('aiModels.overviewDescription')}
            </Paragraph>
          </Card>
        </div>

        <div className={styles.span5}>
          <Card
            bordered={false}
            className={styles.card}
            title={t('aiModels.overviewPricingTitle')}
            extra={
              canEdit ? (
                <Button type="link" onClick={() => navigate(`/ai-models/models/${model.id}/pricing`)}>
                  {t('aiModels.overviewEdit')}
                </Button>
              ) : null
            }
          >
            {activeRule ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t('aiModels.overviewPricingVersion')}>v{activeRule.version}</Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewPricingType')}>
                  {getAIPricingTypeLabel(activeRule.pricing_type, t)}
                </Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewPricingCurrency')}>{activeRule.currency}</Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewPricingEffectiveAt')}>
                  {activeRule.effective_at}
                </Descriptions.Item>
                <Descriptions.Item label={t('aiModels.overviewPricingDescription')}>
                  {activeRule.description ?? t('aiModels.overviewNoDescription')}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Paragraph className={styles.muted}>{t('aiModels.overviewPricingEmpty')}</Paragraph>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
