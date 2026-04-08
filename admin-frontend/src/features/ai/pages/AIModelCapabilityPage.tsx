import { Button, Card, Empty, Form, Input, InputNumber, Spin, Switch, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import ModelDetailNav from '../components/ModelDetailNav';
import styles from '../AIWorkspace.module.scss';
import { decodeParam, getCapabilityLabels, safeJsonParse } from '../utils';
import type { AIModelCapability, AIModelRecord } from '../types';

interface CapabilityFormValues {
  displayName?: string;
  sortOrder?: number;
  maxTokensLimit?: number;
  isActive?: boolean;
  supportTemperature?: boolean;
  supportMaxTokens?: boolean;
  supportTopP?: boolean;
  supportStream?: boolean;
  supportThinking?: boolean;
  supportThinkingLevel?: boolean;
  supportEnableThinking?: boolean;
  supportFrequencyPenalty?: boolean;
  supportPresencePenalty?: boolean;
  supportStopSequences?: boolean;
  supportVision?: boolean;
  supportImageGeneration?: boolean;
  capabilityOptionsText?: string;
}

export default function AIModelCapabilityPage() {
  const [form] = Form.useForm<CapabilityFormValues>();
  const params = useParams();
  const provider = decodeParam(params.provider);
  const modelName = decodeParam(params.modelName);
  const [record, setRecord] = useState<AIModelRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    aiAdminApi.getModel(provider, modelName).then((data) => {
      if (!active) return;
      setRecord(data);
      if (data) {
        form.setFieldsValue({
          displayName: data.capability.displayName,
          sortOrder: data.capability.sortOrder,
          maxTokensLimit: data.capability.maxTokensLimit,
          isActive: data.capability.isActive,
          supportTemperature: data.capability.supportTemperature,
          supportMaxTokens: data.capability.supportMaxTokens,
          supportTopP: data.capability.supportTopP,
          supportStream: data.capability.supportStream,
          supportThinking: data.capability.supportThinking,
          supportThinkingLevel: data.capability.supportThinkingLevel,
          supportEnableThinking: data.capability.supportEnableThinking,
          supportFrequencyPenalty: data.capability.supportFrequencyPenalty,
          supportPresencePenalty: data.capability.supportPresencePenalty,
          supportStopSequences: data.capability.supportStopSequences,
          supportVision: data.capability.supportVision,
          supportImageGeneration: data.capability.supportImageGeneration,
          capabilityOptionsText: JSON.stringify(data.capability.capabilityOptions ?? {}, null, 2),
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [provider, modelName, form]);

  async function handleSubmit(values: CapabilityFormValues) {
    if (!record) return;
    setSaving(true);
    try {
      const next = await aiAdminApi.updateCapability(provider, modelName, {
        displayName: values.displayName,
        sortOrder: values.sortOrder,
        maxTokensLimit: values.maxTokensLimit,
        isActive: values.isActive,
        supportTemperature: values.supportTemperature,
        supportMaxTokens: values.supportMaxTokens,
        supportTopP: values.supportTopP,
        supportStream: values.supportStream,
        supportThinking: values.supportThinking,
        supportThinkingLevel: values.supportThinkingLevel,
        supportEnableThinking: values.supportEnableThinking,
        supportFrequencyPenalty: values.supportFrequencyPenalty,
        supportPresencePenalty: values.supportPresencePenalty,
        supportStopSequences: values.supportStopSequences,
        supportVision: values.supportVision,
        supportImageGeneration: values.supportImageGeneration,
        capabilityOptions: safeJsonParse(values.capabilityOptionsText || '{}', {}),
      } as AIModelCapability);
      setRecord(next);
      message.success('Capability configuration saved.');
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
      <ModelDetailNav provider={provider} modelName={modelName} active="capability" />
      <PageHero
        eyebrow="CAPABILITY"
        title={`${record.meta.displayName} capability`}
        description="Capability config is stored at provider + model_name and controls what the runtime can expose to users and nodes."
        tags={getCapabilityLabels(record.capability)}
      />

      <Card className={styles.card}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Display name" name="displayName">
            <Input />
          </Form.Item>
          <Form.Item label="Sort order" name="sortOrder">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Max tokens limit" name="maxTokensLimit">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Active" name="isActive" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support temperature" name="supportTemperature" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support max tokens" name="supportMaxTokens" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support top p" name="supportTopP" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support stream" name="supportStream" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support thinking" name="supportThinking" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support thinking level" name="supportThinkingLevel" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support enable thinking" name="supportEnableThinking" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support frequency penalty" name="supportFrequencyPenalty" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support presence penalty" name="supportPresencePenalty" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support stop sequences" name="supportStopSequences" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support vision" name="supportVision" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Support image generation" name="supportImageGeneration" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="Capability options JSON" name="capabilityOptionsText">
            <Input.TextArea rows={10} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Save capability</Button>
        </Form>
      </Card>
    </div>
  );
}
