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
import { PRICING_TYPE_OPTIONS } from '@/types/aiModels';
import type { AIModelPricingRule, PricingData, PricingType } from '@/types/aiModels';
import styles from '../AIModels.module.scss';

const { Paragraph, Title } = Typography;

interface PricingRuleEditorProps {
  initialRule: AIModelPricingRule;
  onSubmit: (rule: AIModelPricingRule) => Promise<void>;
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

export default function PricingRuleEditor({ initialRule, onSubmit }: PricingRuleEditorProps) {
  const { message } = App.useApp();
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
    message.success('计费规则已保存。');
  };

  return (
    <div className={styles.editorLayout}>
      <Card bordered={false} className={styles.card}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="规则编辑器"
          description="先选择计费类型，再填写对应规则体，避免把所有计费字段一次性平铺出来。"
        />

        <Form form={form} layout="vertical" onFinish={handleFinish} onValuesChange={handleValuesChange}>
          <div className={styles.formGrid}>
            <Form.Item label="计费类型" name="pricing_type" rules={[{ required: true }]}>
              <Select options={PRICING_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item label="币种" name="currency" rules={[{ required: true }]}>
              <Select options={[{ label: 'USD', value: 'USD' }, { label: 'CNY', value: 'CNY' }]} />
            </Form.Item>
            <Form.Item label="版本" name="version" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="生效时间" name="effective_at" rules={[{ required: true }]}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item label="失效时间" name="expired_at">
              <Input placeholder="可选，YYYY-MM-DD" />
            </Form.Item>
            <Form.Item label="启用状态" name="is_active" valuePropName="checked">
              <Switch checkedChildren="生效" unCheckedChildren="停用" />
            </Form.Item>
          </div>

          <Form.Item label="规则说明" name="description">
            <Input.TextArea rows={3} placeholder="描述本次规则版本适用的计费语义。" />
          </Form.Item>

          {pricingType === 'unified' ? (
            <Card size="small" title="统一单价规则">
              <Form.Item
                label="每百万 Token 单价"
                name={['pricing_data', 'price_per_million_tokens']}
                rules={[{ required: true }]}
              >
                <InputNumber min={0} precision={4} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          ) : null}

          {pricingType === 'separate' ? (
            <Card size="small" title="输入输出分离规则">
              <div className={styles.formGrid}>
                <Form.Item
                  label="输入单价"
                  name={['pricing_data', 'input_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="输出单价"
                  name={['pricing_data', 'output_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Card>
          ) : null}

          {pricingType === 'multi_type' ? (
            <Card size="small" title="多类型计费规则">
              <div className={styles.formGrid}>
                <Form.Item
                  label="输入单价"
                  name={['pricing_data', 'input_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="输出单价"
                  name={['pricing_data', 'output_price_per_million']}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="音频单价" name={['pricing_data', 'audio_price_per_million']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="缓存读取单价" name={['pricing_data', 'cache_read_price_per_million']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="缓存写入单价" name={['pricing_data', 'cache_write_price_per_million']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="音频缓存读取单价"
                  name={['pricing_data', 'audio_cache_read_price_per_million']}
                >
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Card>
          ) : null}

          {pricingType === 'segmented' ? (
            <Card size="small" title="分段计费规则">
              <Paragraph className={styles.muted}>
                使用分段数组定义不同上下文区间的计费方式。
              </Paragraph>
              <Form.List name={['pricing_data', 'segments']}>
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={`分段 ${index + 1}`}
                        extra={
                          fields.length > 1 ? (
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                          ) : null
                        }
                      >
                        <div className={styles.formGrid}>
                          <Form.Item
                            label="上下文阈值"
                            name={[field.name, 'context_length_limit']}
                            tooltip="留空表示无上限"
                          >
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                          <div />
                          <Form.Item
                            label="输入单价"
                            name={[field.name, 'input_price_per_million']}
                            rules={[{ required: true }]}
                          >
                            <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item
                            label="输出单价"
                            name={[field.name, 'output_price_per_million']}
                            rules={[{ required: true }]}
                          >
                            <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item
                            label="缓存读取单价"
                            name={[field.name, 'cache_read_price_per_million']}
                          >
                            <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                          </Form.Item>
                        </div>
                      </Card>
                    ))}
                    <Button icon={<PlusOutlined />} onClick={() => add({ context_length_limit: null })}>
                      新增分段
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Card>
          ) : null}

          {pricingType === 'per_image' ? (
            <Card size="small" title="按图片计费规则">
              <div className={styles.formGrid}>
                <Form.Item label="文生图单价" name={['pricing_data', 'text_to_image_price']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="图生图单价" name={['pricing_data', 'image_to_image_price']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="每张图片单价" name={['pricing_data', 'price_per_image']}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Card>
          ) : null}

          <Button htmlType="submit" type="primary" style={{ marginTop: 16 }}>
            保存计费规则
          </Button>
        </Form>
      </Card>

      <Card bordered={false} className={styles.card}>
        <Title level={5}>`pricing_data` 预览</Title>
        <Paragraph className={styles.muted}>
          当前表单会被收敛成 `pricing_type + pricing_data` 结构，便于后端做版本化和类型扩展。
        </Paragraph>
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
