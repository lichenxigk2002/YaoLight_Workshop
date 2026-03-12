import { Button, Form, Input, InputNumber, message } from 'antd';
import { useI18n } from '@/i18n';
import AdminUserSelect from '@/features/users/components/AdminUserSelect';
import type { RecoverQuotaPayload } from '../types';

interface QuotaRecoveryFormProps {
  onSubmit: (payload: RecoverQuotaPayload) => Promise<void>;
  loading?: boolean;
}

export default function QuotaRecoveryForm({ onSubmit, loading }: QuotaRecoveryFormProps) {
  const { t } = useI18n();
  const [form] = Form.useForm<RecoverQuotaPayload>();

  async function handleFinish(values: RecoverQuotaPayload) {
    try {
      await onSubmit(values);
      message.success(t('billing.formRecoverySuccess'));
      form.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('billing.formSubmitFailed'));
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ quota_delta: 1000 }}>
      <Form.Item
        name="order_id"
        label={t('billing.formOrderIdLabel')}
        rules={[{ required: true, message: t('billing.formOrderIdRequired') }]}
      >
        <Input placeholder={t('billing.formOrderIdPlaceholder')} />
      </Form.Item>
      <Form.Item
        name="user_id"
        label={t('billing.formUserIdLabel')}
        rules={[{ required: true, message: t('billing.formUserIdRequired') }]}
        extra={t('billing.formUserIdHelp')}
      >
        <AdminUserSelect placeholder={t('billing.formUserIdPlaceholder')} />
      </Form.Item>
      <Form.Item
        name="quota_delta"
        label={t('billing.formQuotaDeltaLabelRecovery')}
        rules={[
          { required: true, message: t('billing.formQuotaDeltaRequiredRecovery') },
          { type: 'number', min: 1, message: t('billing.formQuotaDeltaMin') },
        ]}
      >
        <InputNumber min={1} style={{ width: '100%' }} placeholder={t('billing.formQuotaDeltaPlaceholder')} />
      </Form.Item>
      <Form.Item
        name="reason"
        label={t('billing.formReasonLabel')}
        rules={[{ required: true, message: t('billing.formReasonRequired') }]}
      >
        <Input.TextArea rows={3} placeholder={t('billing.formReasonPlaceholder')} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          {t('billing.formSubmitRecovery')}
        </Button>
      </Form.Item>
    </Form>
  );
}
