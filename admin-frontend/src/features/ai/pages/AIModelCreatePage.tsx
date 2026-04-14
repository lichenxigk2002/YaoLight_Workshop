import { Button, Card, Form, Input, Select, Switch, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import { RELEASE_STAGE_OPTIONS } from '../constants';
import styles from '../AIWorkspace.module.scss';
import { buildModelPath } from '../utils';
import type { AIModelRecord, AIProviderInsight, CreateAIModelPayload } from '../types';

export default function AIModelCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<CreateAIModelPayload>();
  const [providers, setProviders] = useState<AIProviderInsight[]>([]);
  const [models, setModels] = useState<AIModelRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([aiAdminApi.getProviders(), aiAdminApi.getModels()]).then(([providerData, modelData]) => {
      setProviders(providerData);
      setModels(modelData);
    });
  }, []);

  const providerOptions = useMemo(
    () => providers.map((item) => ({ label: item.name, value: item.provider })),
    [providers],
  );

  async function handleSubmit(values: CreateAIModelPayload) {
    const exists = models.some(
      (item) => item.meta.provider === values.provider && item.meta.modelName === values.modelName,
    );

    if (exists) {
      message.error('A model with the same provider and model name already exists.');
      return;
    }

    setSubmitting(true);
    try {
      const record = await aiAdminApi.createModel({
        ...values,
        tags: values.tags ?? [],
      });
      message.success('Model draft created.');
      navigate(buildModelPath(record.meta.provider, record.meta.modelName));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="NEW MODEL"
        title="Register model"
        description="New models are created against an existing provider template. Capability and pricing can be refined on the detail pages after the record is created."
        tags={['step 1 basic info', 'step 2 capability', 'step 3 pricing']}
      />

      <Card className={styles.card}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ releaseStage: 'beta', isActive: true }}
          onFinish={handleSubmit}
        >
          <Form.Item label="Provider" name="provider" rules={[{ required: true, message: 'Provider is required' }]}>
            <Select options={providerOptions} placeholder="Select provider" />
          </Form.Item>
          <Form.Item label="Model name" name="modelName" rules={[{ required: true, message: 'Model name is required' }]}>
            <Input placeholder="gpt-4o-mini" />
          </Form.Item>
          <Form.Item label="Display name" name="displayName" rules={[{ required: true, message: 'Display name is required' }]}>
            <Input placeholder="GPT-4o mini" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={4} placeholder="What this model is used for" />
          </Form.Item>
          <Form.Item label="Release stage" name="releaseStage">
            <Select options={RELEASE_STAGE_OPTIONS} />
          </Form.Item>
          <Form.Item label="Tags" name="tags" tooltip="Press Enter to add tags">
            <Select mode="tags" open={false} tokenSeparators={[',']} placeholder="reasoning, multimodal" />
          </Form.Item>
          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Create model
          </Button>
        </Form>
      </Card>
    </div>
  );
}
