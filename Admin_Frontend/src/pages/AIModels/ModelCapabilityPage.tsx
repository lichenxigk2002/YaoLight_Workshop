import { useEffect } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Switch, Typography } from 'antd';
import { useOutletContext } from 'react-router-dom';
import { getAIModelCapability, saveAIModelCapability } from '@/api/aiModels';
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
    const payload: AIModelCapabilityConfig = {
      ...rest,
      capability_options: capability_options_text
        ? (JSON.parse(capability_options_text) as Record<string, unknown>)
        : undefined,
    };

    await saveAIModelCapability(model.id, payload);
    message.success('能力配置已保存。');
  };

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card}>
        <Paragraph className={styles.muted}>
          能力配置与模型基础信息分离维护，便于前后端按 `capability` 领域独立演进。
        </Paragraph>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className={styles.formGrid}>
            <Form.Item label="最大 Token 上限" name="max_tokens_limit">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <div />
            <Form.Item label="支持温度参数" name="support_temperature" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持最大 Token 参数" name="support_max_tokens" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持 Top P 采样参数" name="support_top_p" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持流式输出" name="support_stream" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持思考模式" name="support_thinking" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持思考等级" name="support_thinking_level" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持启用思考开关" name="support_enable_thinking" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持频率惩罚" name="support_frequency_penalty" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持存在惩罚" name="support_presence_penalty" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持停止序列" name="support_stop_sequences" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持视觉输入" name="support_vision" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="支持图像生成" name="support_image_generation" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <Form.Item label="能力扩展配置（JSON）" name="capability_options_text">
            <Input.TextArea rows={8} placeholder='例如 {"modalities":["text","image"]}' />
          </Form.Item>

          <Button htmlType="submit" type="primary">
            保存能力配置
          </Button>
        </Form>
      </Card>
    </div>
  );
}
