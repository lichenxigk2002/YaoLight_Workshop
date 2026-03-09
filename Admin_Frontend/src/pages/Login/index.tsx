import { App, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { adminLogin, type LoginFormValues } from '@/api/adminAuth';
import { setAdminSession } from '@/utils/storage';
import styles from './index.module.scss';

const { Title, Paragraph, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  async function handleSubmit(values: LoginFormValues) {
    try {
      const session = await adminLogin(values);
      setAdminSession(session);
      message.success('管理员登录成功');
      navigate('/', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.pitch}>
          <div className={styles.badge}>瑶光管理后台</div>
          <Title className={styles.title}>平台运营、配置、审核与排障统一入口</Title>
          <Paragraph className={styles.copy}>
            这里是独立于用户端的后台控制台，用于管理平台资源、查看运行状态，并处理模型、任务、通知和系统配置。
          </Paragraph>
          <div className={styles.note}>
            <Text>当前复用 `/api/auth/login` 登录接口，只有管理员角色可以进入后台。</Text>
          </div>
        </div>

        <Card bordered={false} className={styles.card}>
          <Title level={3}>管理员登录</Title>
          <Form layout="vertical" onFinish={handleSubmit} initialValues={{ username: 'admin' }}>
            <Form.Item
              label="账号"
              name="username"
              rules={[{ required: true, message: '请输入管理员账号' }]}
            >
              <Input placeholder="请输入账号" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              进入后台
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
