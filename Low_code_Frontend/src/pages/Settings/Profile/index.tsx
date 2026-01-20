import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Descriptions, Avatar, Modal, App, Space } from 'antd';
import { UserOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { userApi } from '@/api/user';
import styles from './index.module.scss';

export default function ProfileInfo() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

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

  const handleUpdateUsername = async (values: { username: string }) => {
    try {
      setLoading(true);
      await userApi.updateUsername(values.username);
      message.success(t('profile.updateUsernameSuccess'));
      setModalVisible(false);
      form.resetFields();
      await refreshUserInfo();
    } catch (error: any) {
      message.error(error.message || t('profile.updateUsernameFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('settings.profile')}</h2>
      
      <div className={styles.avatarSection}>
        <Avatar size={80} icon={<UserOutlined />} className={styles.avatar} />
        <div className={styles.userInfo}>
          <h3>{user?.username || t('profile.unknownUser')}</h3>
          <p>{user?.email}</p>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => {
              form.setFieldsValue({ username: user?.username });
              setModalVisible(true);
            }}
          >
            {t('profile.modifyUsername')}
          </Button>
        </div>
      </div>

      <Descriptions column={1} className={styles.descriptions}>
        <Descriptions.Item label={t('profile.username')}>{user?.username}</Descriptions.Item>
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
            ]}
          >
            <Input placeholder={t('profile.newUsernamePlaceholder')} maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
