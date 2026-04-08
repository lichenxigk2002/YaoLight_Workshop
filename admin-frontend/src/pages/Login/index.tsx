import { useState } from 'react';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import LocaleSwitch from '@/components/LocaleSwitch';
import { useI18n } from '@/i18n';
import { adminLogin, type LoginFormValues } from '@/api/adminAuth';
import { setAdminSession } from '@/utils/storage';
import styles from './index.module.scss';

const { Title, Paragraph, Text } = Typography;

const pageCopy = {
  'zh-CN': {
    heroEyebrow: 'Admin Console',
    heroTitle: '后台管理控制台',
    heroDescription: '为团队运营和系统治理设计的统一入口，提供稳定、安全的管理体验。',
    previewLabel: '控制台预览',
    formEyebrow: '管理员登录',
    formTitle: '进入控制台',
    formDescription: '仅管理员账号可访问平台配置、任务巡检与系统治理能力。',
    submit: '登录',
  },
  'en-US': {
    heroEyebrow: 'Admin Console',
    heroTitle: 'Admin Control Center',
    heroDescription: 'A focused entry to the internal admin workspace, designed for reliable and secure operations.',
    previewLabel: 'Console Preview',
    formEyebrow: 'Admin Sign In',
    formTitle: 'Sign in to console',
    formDescription: 'Only admin accounts can access configuration, monitoring, and governance features.',
    submit: 'Sign in',
  },
} as const;

export default function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t, locale } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const copy = pageCopy[locale];

  async function handleSubmit(values: LoginFormValues) {
    setSubmitting(true);

    try {
      const session = await adminLogin(values);
      setAdminSession(session);
      message.success(t('login.success'));
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof Error && error.message === 'ADMIN_ONLY') {
        message.error(t('login.adminOnly'));
        return;
      }
      message.error(error instanceof Error ? error.message : t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.badge}>{t('login.badge')}</div>
            <LocaleSwitch />
          </div>

          <div className={styles.heroHeader}>
            <div className={styles.heroCopy}>
              <Text className={styles.eyebrow}>{copy.heroEyebrow}</Text>
              <Title className={styles.title}>{copy.heroTitle}</Title>
              <Paragraph className={styles.description}>{copy.heroDescription}</Paragraph>
            </div>
          </div>
        </section>

        <section className={styles.formWrap}>
          <Card bordered={false} className={styles.card}>
            <div className={styles.formHeader}>
              <Text className={styles.formEyebrow}>{copy.formEyebrow}</Text>
              <Title level={3} className={styles.formTitle}>
                {copy.formTitle}
              </Title>
              <Paragraph className={styles.formDescription}>{copy.formDescription}</Paragraph>
            </div>

            <div className={styles.note}>
              <Text>{t('login.note')}</Text>
            </div>

            <Form
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ username: 'admin' }}
              className={styles.form}
            >
              <Form.Item
                label={t('login.usernameLabel')}
                name="username"
                rules={[{ required: true, message: t('login.usernameRequired') }]}
              >
                <Input placeholder={t('login.usernamePlaceholder')} className={styles.input} />
              </Form.Item>

              <Form.Item
                label={t('login.passwordLabel')}
                name="password"
                rules={[{ required: true, message: t('login.passwordRequired') }]}
              >
                <Input.Password placeholder={t('login.passwordPlaceholder')} className={styles.input} />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={submitting}
                className={styles.submitButton}
              >
                {copy.submit}
              </Button>
            </Form>
          </Card>
        </section>
      </div>
    </div>
  );
}
