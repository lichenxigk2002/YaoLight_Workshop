import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Select, Space, Switch, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PageHero from '@/components/PageHero';
import { createAIModel, getAIProviderOptions } from '@/api/aiModels';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { CreateAIModelInput } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph } = Typography;

interface AIProviderOption {
  key: string;
  name: string;
}

export default function ModelCreatePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('ai_models.models');
  const [providers, setProviders] = useState<AIProviderOption[]>([]);

  useEffect(() => {
    void getAIProviderOptions().then(setProviders);
  }, []);

  const handleFinish = async (values: CreateAIModelInput) => {
    try {
      const created = await createAIModel(values);
      message.success(t('aiModels.createSuccess'));
      navigate(`/ai-models/models/${created.id}`, { state: { draftModel: created } });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        message.error(t('aiModels.createDuplicateError'));
      } else {
        message.error(error instanceof Error ? error.message : t('aiModels.createFailed'));
      }
    }
  };

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('aiModels.createEyebrow')}
        title={t('aiModels.createTitle')}
        description={t('aiModels.createDescription')}
        tags={[t('aiModels.createTagPhase1'), t('aiModels.createTagBaseInfo')]}
      />

      <Card bordered={false} className={styles.card}>
        <Paragraph className={styles.muted}>{t('aiModels.createIntro')}</Paragraph>
        <Form<CreateAIModelInput> layout="vertical" onFinish={handleFinish} initialValues={{ is_active: true }} disabled={!canEdit}>
          <div className={styles.formGrid}>
            <Form.Item
              label={t('aiModels.formProviderLabel')}
              name="provider"
              rules={[{ required: true, message: t('aiModels.formProviderRequired') }]}
            >
              <Select
                placeholder={t('aiModels.formProviderPlaceholder')}
                options={providers.map((item) => ({ label: item.name, value: item.key }))}
              />
            </Form.Item>
            <Form.Item
              label={t('aiModels.formModelNameLabel')}
              name="model_name"
              rules={[{ required: true, message: t('aiModels.formModelNameRequired') }]}
            >
              <Input placeholder={t('aiModels.formModelNamePlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('aiModels.formDisplayNameLabel')}
              name="display_name"
              rules={[{ required: true, message: t('aiModels.formDisplayNameRequired') }]}
            >
              <Input placeholder={t('aiModels.formDisplayNamePlaceholder')} />
            </Form.Item>
            <Form.Item label={t('aiModels.formEnabledLabel')} name="is_active" valuePropName="checked">
              <Switch checkedChildren={t('aiModels.switchEnabled')} unCheckedChildren={t('aiModels.switchDisabled')} />
            </Form.Item>
          </div>

          <Form.Item label={t('aiModels.formDescriptionLabel')} name="description">
            <Input.TextArea rows={4} placeholder={t('aiModels.formDescriptionPlaceholder')} />
          </Form.Item>

          <Space>
            <Button htmlType="submit" type="primary" disabled={!canEdit}>
              {t('aiModels.submitCreateContinue')}
            </Button>
            <Button onClick={() => navigate('/ai-models/models')}>{t('aiModels.actionCancel')}</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
