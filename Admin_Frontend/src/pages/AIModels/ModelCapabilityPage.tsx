import { useEffect } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Switch, Typography } from 'antd';
import { useOutletContext } from 'react-router-dom';
import { getAIModelCapability, saveAIModelCapability } from '@/api/aiModels';
import { useI18n } from '@/i18n';
import type { AIModelCapabilityConfig } from '@/types/aiModels';
import type { ModelDetailOutletContext } from './ModelDetailLayout';
import styles from './AIModels.module.scss';

const { Paragraph } = Typography;

type CapabilityFormValues = AIModelCapabilityConfig & {
  capability_options?: Record<string, any>;
  capability_options_text?: string;
};

export default function ModelCapabilityPage() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const { model } = useOutletContext<ModelDetailOutletContext>();
  const [form] = Form.useForm<CapabilityFormValues>();

  useEffect(() => {
    void getAIModelCapability(model.id).then((capability) => {
      const nextValues = capability ?? model.capability;
      form.setFieldsValue({
        ...nextValues,
        capability_options_text: nextValues.capability_options
          ? JSON.stringify(nextValues.capability_options, null, 2)
          : '',
      });
    });
  }, [form, model.capability, model.id]);

  const handleSave = async (values: CapabilityFormValues) => {
    const { capability_options_text, ...rest } = values;

    let capabilityOptions: Record<string, unknown> | undefined;
    if (capability_options_text) {
      try {
        capabilityOptions = JSON.parse(capability_options_text) as Record<string, any>;
      } catch {
        message.error(t('aiModels.capabilityInvalidJson'));
        return;
      }
    }

    await saveAIModelCapability(model.id, {
      ...rest,
      capability_options: capabilityOptions,
    });

    message.success(t('aiModels.capabilitySaved'));
  };

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card}>
        <Paragraph className={styles.muted}>{t('aiModels.capabilityIntro')}</Paragraph>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className={styles.formGrid}>
            <Form.Item label={t('aiModels.capabilityMaxTokens')} name="max_tokens_limit">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <div />
            <Form.Item label={t('aiModels.capabilitySupportTemperature')} name="support_temperature" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={t('aiModels.capabilitySupportMaxTokens')} name="support_max_tokens" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={t('aiModels.capabilitySupportTopP')} name="support_top_p" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={t('aiModels.capabilitySupportStream')} name="support_stream" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={t('aiModels.capabilitySupportThinking')} name="support_thinking" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('aiModels.capabilitySupportThinkingLevel')}
              name="support_thinking_level"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('aiModels.capabilitySupportEnableThinking')}
              name="support_enable_thinking"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('aiModels.capabilitySupportFrequencyPenalty')}
              name="support_frequency_penalty"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('aiModels.capabilitySupportPresencePenalty')}
              name="support_presence_penalty"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('aiModels.capabilitySupportStopSequences')}
              name="support_stop_sequences"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item label={t('aiModels.capabilitySupportVision')} name="support_vision" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('aiModels.capabilitySupportImageGeneration')}
              name="support_image_generation"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>

          <Form.Item label={t('aiModels.capabilityOptionsLabel')} name="capability_options_text">
            <Input.TextArea rows={8} placeholder={t('aiModels.capabilityOptionsPlaceholder')} />
          </Form.Item>

          <Button htmlType="submit" type="primary">
            {t('aiModels.capabilitySubmit')}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
