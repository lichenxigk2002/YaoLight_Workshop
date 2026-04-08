import { useEffect } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { buildDefaultPricingData } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIModelPricingRule, PricingData, PricingType } from '@/types/aiModels';
import { getAIPricingTypeOptions } from '../i18n';
import styles from '../AIModels.module.scss';

const { Paragraph, Title } = Typography;

interface PricingRuleEditorProps {
  initialRule: AIModelPricingRule;
  onSubmit: (rule: AIModelPricingRule) => Promise<void>;
  disabled?: boolean;
}

interface PricingRuleFormValues {
  pricing_type: PricingType;
  currency: string;
  version: number;
  effective_at: string;
  expired_at?: string | null;
  description?: string;
  is_active: boolean;
  pricing_data: Record<string, any>;
}

function normalizePricingData(type: PricingType, rawData: Record<string, any> | undefined): PricingData {
  const fallback = buildDefaultPricingData(type) as Record<string, any>;
  const nextData = rawData ?? {};

  if (type === 'segmented') {
    return {
      segments:
        Array.isArray(nextData.segments) && nextData.segments.length > 0
          ? (nextData.segments as Array<Record<string, any>>).map((segment) => ({
              context_length_limit:
                typeof segment.context_length_limit === 'number' ? segment.context_length_limit : null,
              input_price_per_million:
                typeof segment.input_price_per_million === 'number' ? segment.input_price_per_million : 0,
              output_price_per_million:
                typeof segment.output_price_per_million === 'number' ? segment.output_price_per_million : 0,
              cache_read_price_per_million:
                typeof segment.cache_read_price_per_million === 'number'
                  ? segment.cache_read_price_per_million
                  : 0,
            }))
          : ((fallback.segments as Array<Record<string, any>>) ?? []),
    };
  }

  return {
    ...fallback,
    ...nextData,
  };
}

function buildFormValues(rule: AIModelPricingRule): PricingRuleFormValues {
  return {
    pricing_type: rule.pricing_type,
    currency: rule.currency,
    version: rule.version,
    effective_at: rule.effective_at,
    expired_at: rule.expired_at ?? undefined,
    description: rule.description,
    is_active: rule.is_active,
    pricing_data: normalizePricingData(rule.pricing_type, rule.pricing_data as Record<string, any>) as Record<
      string,
      any
    >,
  };
}

export default function PricingRuleEditor({ initialRule, onSubmit, disabled = false }: PricingRuleEditorProps) {
  const { message } = App.useApp();
  const { t } = useI18n();
  const [form] = Form.useForm<PricingRuleFormValues>();
  const pricingType = Form.useWatch('pricing_type', form) ?? initialRule.pricing_type;
  const watchedValues = Form.useWatch([], form);

  useEffect(() => {
    form.setFieldsValue(buildFormValues(initialRule));
  }, [form, initialRule]);

  const handleValuesChange = (changedValues: Partial<PricingRuleFormValues>) => {
    if (changedValues.pricing_type) {
      form.setFieldValue('pricing_data', buildDefaultPricingData(changedValues.pricing_type));
    }
  };

  const handleFinish = async (values: PricingRuleFormValues) => {
    await onSubmit({
      ...initialRule,
      pricing_type: values.pricing_type,
      currency: values.currency,
      version: values.version,
      effective_at: values.effective_at,
      expired_at: values.expired_at || null,
      description: values.description,
      is_active: values.is_active,
      pricing_data: normalizePricingData(values.pricing_type, values.pricing_data),
    });

    message.success(t('aiModels.editorSuccess'));
  };

  return (
    <div className={styles.editorLayout}>
      <Card bordered={false} className={styles.card}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('aiModels.editorAlertTitle')}
          description={t('aiModels.editorAlertDescription')}
        />

        <Form form={form} layout="vertical" onFinish={handleFinish} onValuesChange={handleValuesChange} disabled={disabled}>
          <div className={styles.formGrid}>
            <Form.Item label={t('aiModels.editorTypeLabel')} name="pricing_type" rules={[{ required: true }]}>
              <Select options={getAIPricingTypeOptions(t)} />
            </Form.Item>
            <Form.Item label={t('aiModels.editorCurrencyLabel')} name="currency" rules={[{ required: true }]}>
              <Select options={[{ label: 'USD', value: 'USD' }, { label: 'CNY', value: 'CNY' }]} />
            </Form.Item>
            <Form.Item label={t('aiModels.editorVersionLabel')} name="version" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('aiModels.editorEffectiveAtLabel')} name="effective_at" rules={[{ required: true }]}>
              <Input placeholder={t('aiModels.editorDatePlaceholder')} />
            </Form.Item>
            <Form.Item label={t('aiModels.editorExpiredAtLabel')} name="expired_at">
              <Input placeholder={t('aiModels.editorExpiredPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('aiModels.editorEnabledLabel')} name="is_active" valuePropName="checked">
              <Switch checkedChildren={t('aiModels.editorSwitchActive')} unCheckedChildren={t('aiModels.editorSwitchInactive')} />
            </Form.Item>
          </div>

          <Form.Item label={t('aiModels.editorDescriptionLabel')} name="description">
            <Input.TextArea rows={3} placeholder={t('aiModels.editorDescriptionPlaceholder')} />
          </Form.Item>

          {pricingType === 'unified' ? (
            <Card size="small" title={t('aiModels.editorSectionUnified')}>
              <Form.Item
                label={t('aiModels.editorUnifiedPrice')}
                name={['pricing_data', 'price_per_million_tokens']}
                rules={[{ required: true }]}
              >
                <InputNumber min={0} precision={4} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          ) : null}

          {pricingType === 'separate' ? (
            <Card size="small" title={t('aiModels.editorSectionSeparate')}>
              <div className={styles.formGrid}>
                <Form.Item
                  label={t('aiModels.editorInputPrice')}
                  name={['pricing_data', 'input_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label={t('aiModels.editorOutputPrice')}
                  name={['pricing_data', 'output_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Card>
          ) : null}

          {pricingType === 'multi_type' ? (
            <Card size="small" title={t('aiModels.editorSectionMultiType')}>
              <div className={styles.formGrid}>
                <Form.Item
                  label={t('aiModels.editorInputPrice')}
                  name={['pricing_data', 'input_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label={t('aiModels.editorOutputPrice')}
                  name={['pricing_data', 'output_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={t('aiModels.editorAudioPrice')} name={['pricing_data', 'audio_price_per_million']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={t('aiModels.editorCacheReadPrice')} name={['pricing_data', 'cache_read_price_per_million']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={t('aiModels.editorCacheWritePrice')} name={['pricing_data', 'cache_write_price_per_million']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label={t('aiModels.editorAudioCacheReadPrice')}
                  name={['pricing_data', 'audio_cache_read_price_per_million']}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Card>
          ) : null}

          {pricingType === 'segmented' ? (
            <Card size="small" title={t('aiModels.editorSectionSegmented')}>
              <Paragraph className={styles.muted}>{t('aiModels.editorSegmentedDescription')}</Paragraph>
              <Form.List name={['pricing_data', 'segments']}>
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={t('aiModels.editorSegmentTitle', { index: index + 1 })}
                        extra={
                          fields.length > 1 ? (
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} disabled={disabled} />
                          ) : null
                        }
                      >
                        <div className={styles.formGrid}>
                          <Form.Item
                            label={t('aiModels.editorContextLimit')}
                            name={[field.name, 'context_length_limit']}
                            tooltip={t('aiModels.editorContextLimitTooltip')}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                          <div />
                          <Form.Item
                            label={t('aiModels.editorInputPrice')}
                            name={[field.name, 'input_price_per_million']}
                            rules={[{ required: true }]}
                          >
                            <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item
                            label={t('aiModels.editorOutputPrice')}
                            name={[field.name, 'output_price_per_million']}
                            rules={[{ required: true }]}
                          >
                            <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item
                            label={t('aiModels.editorCacheReadPrice')}
                            name={[field.name, 'cache_read_price_per_million']}
                          >
                            <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                          </Form.Item>
                        </div>
                      </Card>
                    ))}
                    <Button icon={<PlusOutlined />} onClick={() => add({ context_length_limit: null })} disabled={disabled}>
                      {t('aiModels.editorAddSegment')}
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Card>
          ) : null}

          {pricingType === 'per_image' ? (
            <Card size="small" title={t('aiModels.editorSectionPerImage')}>
              <div className={styles.formGrid}>
                <Form.Item label={t('aiModels.editorTextToImagePrice')} name={['pricing_data', 'text_to_image_price']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={t('aiModels.editorImageToImagePrice')} name={['pricing_data', 'image_to_image_price']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={t('aiModels.editorPricePerImage')} name={['pricing_data', 'price_per_image']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Card>
          ) : null}

          <Button htmlType="submit" type="primary" style={{ marginTop: 16 }} disabled={disabled}>
            {t('aiModels.editorSubmit')}
          </Button>
        </Form>
      </Card>

      <Card bordered={false} className={styles.card}>
        <Title level={5}>{t('aiModels.editorPreviewTitle')}</Title>
        <Paragraph className={styles.muted}>{t('aiModels.editorPreviewDescription')}</Paragraph>
        <pre className={styles.jsonPreview}>
          {JSON.stringify(
            {
              pricing_type: pricingType,
              pricing_data: normalizePricingData(
                pricingType,
                (watchedValues?.pricing_data as Record<string, any> | undefined) ?? {},
              ),
            },
            null,
            2,
          )}
        </pre>
      </Card>
    </div>
  );
}
