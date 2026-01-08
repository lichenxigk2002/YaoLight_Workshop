import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Descriptions, Avatar, Modal } from 'antd';
import { UserOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/redux/auth';
import { userApi } from '@/api/user';
import styles from './index.module.scss';

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 刷新用户信息
  const refreshUserInfo = async () => {
    try {
      const userData = await userApi.getCurrentUser();
      setUser(userData);
    } catch (error: any) {
      message.error(t('profile.getUserInfoFailed'));
    }
  };

  useEffect(() => {
    refreshUserInfo();
  }, []);

  // 修改用户名
  const handleUpdateUsername = async (values: { username: string }) => {
    try {
      setLoading(true);
      await userApi.updateUsername(values.username);
      message.success(t('profile.updateUsernameSuccess'));
      setModalVisible(false);
      form.resetFields();
      // 刷新用户信息
      await refreshUserInfo();
    } catch (error: any) {
      message.error(error.message || t('profile.updateUsernameFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card title={t('profile.title')} className={styles.card}>
        <div className={styles.avatarSection}>
          <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#000' }} />
          <div className={styles.userInfo}>
            <h2>{user?.username || t('profile.unknownUser')}</h2>
            <p className={styles.email}>{user?.email}</p>
          </div>
        </div>

        <Descriptions column={1} className={styles.descriptions}>
          <Descriptions.Item label={t('profile.username')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>{user?.username}</span>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  form.setFieldsValue({ username: user?.username });
                  setModalVisible(true);
                }}
              >
                {t('profile.modify')}
              </Button>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label={t('profile.email')}>{user?.email}</Descriptions.Item>
          <Descriptions.Item label={t('profile.phone')}>{user?.phone || t('profile.notBound')}</Descriptions.Item>
          <Descriptions.Item label={t('profile.role')}>
            {user?.role === 'admin' ? t('profile.admin') : t('profile.normalUser')}
          </Descriptions.Item>
          <Descriptions.Item label={t('profile.accountStatus')}>
            {user?.status === 'active' ? t('profile.active') : t('profile.inactive')}
          </Descriptions.Item>
          <Descriptions.Item label={t('profile.loginCount')}>{user?.login_count || 0}</Descriptions.Item>
          <Descriptions.Item label={t('profile.lastLogin')}>
            {user?.last_login_at
              ? new Date(user.last_login_at).toLocaleString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US')
              : t('profile.noRecord')}
          </Descriptions.Item>
          <Descriptions.Item label={t('profile.registrationTime')}>
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US')
              : t('profile.unknown')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Modal
        title={t('profile.modifyUsername')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        okText={t('common.ok')}
        cancelText={t('common.cancel')}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateUsername}>
          <Form.Item
            name="username"
            label={t('profile.newUsername')}
            rules={[
              { required: true, message: t('profile.usernameRequired') },
              { min: 3, message: t('profile.usernameMinLength') },
              { max: 50, message: t('profile.usernameMaxLength') },
              {
                pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
                message: t('profile.usernamePattern'),
              },
            ]}
          >
            <Input placeholder={t('profile.newUsernamePlaceholder')} maxLength={50} />
          </Form.Item>
          <div style={{ color: '#999', fontSize: '12px' }}>
            {t('profile.usernameTip')}
          </div>
        </Form>
      </Modal>
    </div>
  );
}

