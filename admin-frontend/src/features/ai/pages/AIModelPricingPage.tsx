import { Button, Card, Empty, Form, Input, InputNumber, Select, Space, Spin, Switch, message } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import ModelDetailNav from '../components/ModelDetailNav';
import { PRICING_TYPE_OPTIONS } from '../constants';
import styles from '../AIWorkspace.module.scss';
import { decodeParam, formatPricingType, getPricingSummary } from '../utils';
import type { AIModelPricingRule, AIModelRecord, PricingType } from '../types';

interface PricingFormValues {
  pricingType: PricingType;
  currency: string;
  isActive: boolean;
  description?: string;
  unifiedPrice?: number;
  inputPrice?: number;
  outputPrice?: number;
  audioPrice?: number;
  cacheReadPrice?: number;
  cacheWritePrice?: number;
  audioCacheReadPrice?: number;
  textToImagePrice?: number;
  imageToImagePrice?: number;
  pricePerImage?: number;
  segments?: Array<{
    contextLengthLimit?: number | null;
    inputPrice?: number;
    outputPrice?: number;
    cacheReadPrice?: number;
  }>;
}

function buildInitialValues(pricing: AIModelPricingRule): PricingFormValues {
  const data = pricing.pricingData;
  return {
    pricingType: pricing.pricingType,
    currency: pricing.currency,
    isActive: pricing.isActive,
    description: pricing.description,
    unifiedPrice: Number(data.price_per_million_tokens ?? 0),
    inputPrice: Number(data.input_price_per_million ?? 0),
    outputPrice: Number(data.output_price_per_million ?? 0),
    audioPrice: Number(data.audio_price_per_million ?? 0),
    cacheReadPrice: Number(data.cache_read_price_per_million ?? 0),
    cacheWritePrice: Number(data.cache_write_price_per_million ?? 0),
    audioCacheReadPrice: Number(data.audio_cache_read_price_per_million ?? 0),
    textToImagePrice: Number(data.text_to_image_price ?? 0),
    imageToImagePrice: Number(data.image_to_image_price ?? 0),
    pricePerImage: Number(data.price_per_image ?? 0),
    segments: Array.isArray(data.segments)
      ? data.segments.map((item) => ({
          contextLengthLimit: typeof item.context_length_limit === 'number' ? item.context_length_limit : null,
          inputPrice: Number(item.input_price_per_million ?? 0),
          outputPrice: Number(item.output_price_per_million ?? 0),
          cacheReadPrice: Number(item.cache_read_price_per_million ?? 0),
        }))
      : [{ contextLengthLimit: 128000, inputPrice: 0.4, outputPrice: 1.2, cacheReadPrice: 0.05 }],
  };
}

function buildPricingRule(provider: string, modelName: string, current: AIModelPricingRule, values: PricingFormValues): AIModelPricingRule {
  let pricingData: Record<string, unknown> = {};

  if (values.pricingType === 'unified') {
    pricingData = { price_per_million_tokens: values.unifiedPrice ?? 0 };
  } else if (values.pricingType === 'separate') {
    pricingData = {
      input_price_per_million: values.inputPrice ?? 0,
      output_price_per_million: values.outputPrice ?? 0,
    };
  } else if (values.pricingType === 'multi_type') {
    pricingData = {
      input_price_per_million: values.inputPrice ?? 0,
      output_price_per_million: values.outputPrice ?? 0,
      audio_price_per_million: values.audioPrice ?? 0,
      cache_read_price_per_million: values.cacheReadPrice ?? 0,
      cache_write_price_per_million: values.cacheWritePrice ?? 0,
      audio_cache_read_price_per_million: values.audioCacheReadPrice ?? 0,
    };
  } else if (values.pricingType === 'segmented') {
    pricingData = {
      segments: (values.segments ?? []).map((item) => ({
        context_length_limit: item.contextLengthLimit ?? null,
        input_price_per_million: item.inputPrice ?? 0,
        output_price_per_million: item.outputPrice ?? 0,
        cache_read_price_per_million: item.cacheReadPrice ?? 0,
      })),
    };
  } else {
    pricingData = {
      text_to_image_price: values.textToImagePrice ?? 0,
      image_to_image_price: values.imageToImagePrice ?? 0,
      price_per_image: values.pricePerImage ?? 0,
    };
  }

  return {
    ...current,
    provider,
    modelName,
    pricingType: values.pricingType,
    currency: values.currency,
    isActive: values.isActive,
    description: values.description,
    pricingData,
    version: current.version + 1,
  };
}

export default function AIModelPricingPage() {
  const [form] = Form.useForm<PricingFormValues>();
  const params = useParams();
  const provider = decodeParam(params.provider);
  const modelName = decodeParam(params.modelName);
  const [record, setRecord] = useState<AIModelRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pricingType = Form.useWatch('pricingType', form);

  useEffect(() => {
    let active = true;
    aiAdminApi.getModel(provider, modelName).then((data) => {
      if (!active) return;
      setRecord(data);
      if (data) {
        form.setFieldsValue(buildInitialValues(data.pricing));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [provider, modelName, form]);

  const summary = useMemo(() => (record ? getPricingSummary(record.pricing) : ''), [record]);

  async function handleSubmit(values: PricingFormValues) {
    if (!record) return;
    setSaving(true);
    try {
      const next = await aiAdminApi.updatePricing(provider, modelName, buildPricingRule(provider, modelName, record.pricing, values));
      setRecord(next);
      message.success('Pricing rule updated.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spin size="large" />;
  if (!record) {
    return (
      <Card className={styles.card}>
        <Empty description="Model not found" />
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <ModelDetailNav provider={provider} modelName={modelName} active="pricing" />
      <PageHero
        eyebrow="PRICING"
        title={`${record.meta.displayName} pricing`}
        description="Pricing is modeled independently from capability so the same provider architecture can support different rule shapes."
        tags={[formatPricingType(record.pricing.pricingType), summary, `v${record.pricing.version}`]}
      />

      <Card className={styles.card}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Pricing type" name="pricingType">
            <Select options={PRICING_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="Currency" name="currency">
            <Select options={[{ label: 'USD', value: 'USD' }, { label: 'CNY', value: 'CNY' }]} />
          </Form.Item>
          <Form.Item label="Active" name="isActive" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Description" name="description"><Input.TextArea rows={3} /></Form.Item>

          {pricingType === 'unified' ? (
            <Form.Item label="Price per million tokens" name="unifiedPrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
          ) : null}

          {pricingType === 'separate' || pricingType === 'multi_type' ? (
            <>
              <Form.Item label="Input price per million" name="inputPrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Output price per million" name="outputPrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
            </>
          ) : null}

          {pricingType === 'multi_type' ? (
            <>
              <Form.Item label="Audio price per million" name="audioPrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Cache read price per million" name="cacheReadPrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Cache write price per million" name="cacheWritePrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Audio cache read price per million" name="audioCacheReadPrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
            </>
          ) : null}

          {pricingType === 'per_image' ? (
            <>
              <Form.Item label="Text-to-image price" name="textToImagePrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Image-to-image price" name="imageToImagePrice"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Price per image" name="pricePerImage"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
            </>
          ) : null}

          {pricingType === 'segmented' ? (
            <Form.List name="segments">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Card key={field.key} size="small" title={`Segment ${field.name + 1}`} extra={<MinusCircleOutlined onClick={() => remove(field.name)} />}>
                      <Form.Item label="Context length limit" name={[field.name, 'contextLengthLimit']}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                      <Form.Item label="Input price per million" name={[field.name, 'inputPrice']}><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
                      <Form.Item label="Output price per million" name={[field.name, 'outputPrice']}><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
                      <Form.Item label="Cache read price per million" name={[field.name, 'cacheReadPrice']}><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
                    </Card>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={() => add({ contextLengthLimit: null, inputPrice: 0, outputPrice: 0, cacheReadPrice: 0 })}>
                    Add segment
                  </Button>
                </Space>
              )}
            </Form.List>
          ) : null}

          <Button type="primary" htmlType="submit" loading={saving}>Save pricing</Button>
        </Form>
      </Card>
    </div>
  );
}
