import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Select, Space, Switch, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { createAIModel, getAIProviders } from '@/api/aiModels';
import type { AIProviderSummary, CreateAIModelInput } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph } = Typography;

export default function ModelCreatePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);

  useEffect(() => {
    void getAIProviders().then(setProviders);
  }, []);

  const handleFinish = async (values: CreateAIModelInput) => {
    const created = await createAIModel(values);
    message.success('模型基础信息已创建，请继续配置能力和计费规则。');
    navigate(`/ai-models/models/${created.id}`, { state: { draftModel: created } });
  };

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="新建模型"
        title="新建模型"
        description="第一阶段只录入服务商、模型名、显示名、启用状态和说明。创建成功后进入详情页继续配置。"
        tags={['第一阶段', '基础信息']}
      />

      <Card bordered={false} className={styles.card}>
        <Paragraph className={styles.muted}>
          这样拆分后，新建模型时不会被大量能力开关和计费字段淹没，也更方便后续做规则版本化。
        </Paragraph>
        <Form<CreateAIModelInput> layout="vertical" onFinish={handleFinish} initialValues={{ is_active: true }}>
          <div className={styles.formGrid}>
            <Form.Item label="服务商" name="provider" rules={[{ required: true, message: '请选择服务商' }]}>
              <Select
                placeholder="请选择服务商"
                options={providers.map((item) => ({ label: item.name, value: item.key }))}
              />
            </Form.Item>
            <Form.Item label="模型名" name="model_name" rules={[{ required: true, message: '请输入模型名' }]}>
              <Input placeholder="例如 gpt-4.1-mini" />
            </Form.Item>
            <Form.Item label="显示名" name="display_name" rules={[{ required: true, message: '请输入显示名' }]}>
              <Input placeholder="例如 GPT-4.1 Mini" />
            </Form.Item>
            <Form.Item label="启用状态" name="is_active" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </div>

          <Form.Item label="说明" name="description">
            <Input.TextArea rows={4} placeholder="记录该模型的定位、适用场景或运营说明。" />
          </Form.Item>

          <Space>
            <Button htmlType="submit" type="primary">
              创建并进入详情
            </Button>
            <Button onClick={() => navigate('/ai-models/models')}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
