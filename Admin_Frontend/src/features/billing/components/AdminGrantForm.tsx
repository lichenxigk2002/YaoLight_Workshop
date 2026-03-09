import { Button, Form, Input, InputNumber, message } from 'antd';
import type { GrantQuotaPayload } from '../types';

interface AdminGrantFormProps {
  onSubmit: (payload: GrantQuotaPayload) => Promise<void>;
  loading?: boolean;
}

export default function AdminGrantForm({ onSubmit, loading }: AdminGrantFormProps) {
  const [form] = Form.useForm<GrantQuotaPayload>();

  async function handleFinish(values: GrantQuotaPayload) {
    try {
      await onSubmit(values);
      message.success('赠送配额已提交，流水已记录');
      form.resetFields();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交失败');
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ quota_delta: 1000 }}
    >
      <Form.Item
        name="user_id"
        label="用户 ID"
        rules={[{ required: true, message: '请输入用户 ID' }]}
      >
        <Input placeholder="例如：user-001" />
      </Form.Item>
      <Form.Item
        name="quota_delta"
        label="赠送配额数量"
        rules={[{ required: true, message: '请输入赠送数量' }, { type: 'number', min: 1, message: '至少为 1' }]}
      >
        <InputNumber min={1} style={{ width: '100%' }} placeholder="正整数" />
      </Form.Item>
      <Form.Item
        name="campaign_id"
        label="活动/活动 ID（选填）"
      >
        <Input placeholder="例如：campaign-spring-2025" />
      </Form.Item>
      <Form.Item
        name="remark"
        label="赠送原因/备注"
        rules={[{ required: true, message: '请填写原因（将记入流水）' }]}
      >
        <Input.TextArea rows={3} placeholder="例如：春季活动赠送、投诉补偿" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          提交赠送
        </Button>
      </Form.Item>
    </Form>
  );
}
