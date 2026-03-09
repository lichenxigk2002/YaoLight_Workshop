import { Button, Form, Input, InputNumber, message } from 'antd';
import type { RecoverQuotaPayload } from '../types';

interface QuotaRecoveryFormProps {
  onSubmit: (payload: RecoverQuotaPayload) => Promise<void>;
  loading?: boolean;
}

export default function QuotaRecoveryForm({ onSubmit, loading }: QuotaRecoveryFormProps) {
  const [form] = Form.useForm<RecoverQuotaPayload>();

  async function handleFinish(values: RecoverQuotaPayload) {
    try {
      await onSubmit(values);
      message.success('补救配额已提交，流水已记录');
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
        name="order_id"
        label="订单 ID"
        rules={[{ required: true, message: '请输入订单 ID（用于幂等与审计）' }]}
      >
        <Input placeholder="例如：order-pay-fail-001" />
      </Form.Item>
      <Form.Item
        name="user_id"
        label="用户 ID"
        rules={[{ required: true, message: '请输入用户 ID' }]}
      >
        <Input placeholder="例如：user-001" />
      </Form.Item>
      <Form.Item
        name="quota_delta"
        label="补发配额数量"
        rules={[{ required: true, message: '请输入补发数量' }, { type: 'number', min: 1, message: '至少为 1' }]}
      >
        <InputNumber min={1} style={{ width: '100%' }} placeholder="正整数" />
      </Form.Item>
      <Form.Item
        name="reason"
        label="补救原因"
        rules={[{ required: true, message: '请填写原因（将记入流水）' }]}
      >
        <Input.TextArea rows={3} placeholder="例如：支付回调超时，用户已扣款，补发配额" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          提交补救
        </Button>
      </Form.Item>
    </Form>
  );
}
