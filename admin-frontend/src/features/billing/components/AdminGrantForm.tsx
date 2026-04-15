import { Button, Form, Input, InputNumber, message } from 'antd';
import { useI18n } from '@/i18n';
import BillingUserSelect from './BillingUserSelect';
import type { GrantQuotaPayload } from '../types';

interface AdminGrantFormProps {
  onSubmit: (payload: GrantQuotaPayload) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export default function AdminGrantForm({ onSubmit, loading, disabled }: AdminGrantFormProps) {
  const { t } = useI18n();
  const [form] = Form.useForm<GrantQuotaPayload>();

  async function handleFinish(values: GrantQuotaPayload) {
    try {
      await onSubmit(values);
      message.success(t('billing.formGrantSuccess'));
      form.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('billing.formSubmitFailed'));
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ quota_delta: 1000 }} disabled={disabled}>
      <Form.Item
        name="user_id"
        label={t('billing.formUserIdLabel')}
        rules={[{ required: true, message: t('billing.formUserIdRequired') }]}
        extra={t('billing.formUserIdHelp')}
      >
        <BillingUserSelect placeholder={t('billing.formUserIdPlaceholder')} />
      </Form.Item>
      <Form.Item
        name="quota_delta"
        label={t('billing.formQuotaDeltaLabelGrant')}
        rules={[
          { required: true, message: t('billing.formQuotaDeltaRequiredGrant') },
          { type: 'number', min: 1, message: t('billing.formQuotaDeltaMin') },
        ]}
      >
        <InputNumber min={1} style={{ width: '100%' }} placeholder={t('billing.formQuotaDeltaPlaceholder')} />
      </Form.Item>
      <Form.Item name="campaign_id" label={t('billing.formCampaignIdLabel')}>
        <Input placeholder={t('billing.formCampaignIdPlaceholder')} />
      </Form.Item>
      <Form.Item
        name="remark"
        label={t('billing.formRemarkLabel')}
        rules={[{ required: true, message: t('billing.formRemarkRequired') }]}
      >
        <Input.TextArea rows={3} placeholder={t('billing.formRemarkPlaceholder')} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} disabled={disabled}>
          {t('billing.formSubmitGrant')}
        </Button>
      </Form.Item>
    </Form>
  );
}
