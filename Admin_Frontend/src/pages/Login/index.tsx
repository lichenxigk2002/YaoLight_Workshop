import { App, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import LocaleSwitch from '@/components/LocaleSwitch';
import { useI18n } from '@/i18n';
import { adminLogin, type LoginFormValues } from '@/api/adminAuth';
import { setAdminSession } from '@/utils/storage';
import styles from './index.module.scss';

const { Title, Paragraph, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();

  async function handleSubmit(values: LoginFormValues) {
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
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.pitch}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div className={styles.badge}>{t('login.badge')}</div>
            <LocaleSwitch />
          </div>
          <Title className={styles.title}>{t('login.title')}</Title>
          <Paragraph className={styles.copy}>{t('login.description')}</Paragraph>
          <div className={styles.note}>
            <Text>{t('login.note')}</Text>
          </div>
        </div>

        <Card bordered={false} className={styles.card}>
          <Title level={3}>{t('login.formTitle')}</Title>
          <Form layout="vertical" onFinish={handleSubmit} initialValues={{ username: 'admin' }}>
            <Form.Item
              label={t('login.usernameLabel')}
              name="username"
              rules={[{ required: true, message: t('login.usernameRequired') }]}
            >
              <Input placeholder={t('login.usernamePlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('login.passwordLabel')}
              name="password"
              rules={[{ required: true, message: t('login.passwordRequired') }]}
            >
              <Input.Password placeholder={t('login.passwordPlaceholder')} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              {t('login.submit')}
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
