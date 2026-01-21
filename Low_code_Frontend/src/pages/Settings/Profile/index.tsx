import { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Descriptions, Avatar, Modal, App } from 'antd';
import { UserOutlined, EditOutlined, CameraOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { userApi } from '@/api/user';
import styles from './index.module.scss';

export default function ProfileInfo() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 获取头像 URL
  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      // 如果是绝对路径（http/https），直接返回
      if (user.avatar_url.startsWith('http')) {
        return user.avatar_url;
      }
      // 如果是相对路径，拼接 API 基础路径
      const baseURL = import.meta.env.VITE_BASE_URL || '/api';
      return `${baseURL}/uploads/${user.avatar_url}`;
    }
    return undefined;
  };

  // 处理头像上传
  const handleAvatarUpload = async (file: File) => {
    try {
      setUploading(true);
      await userApi.uploadAvatar(file);
      message.success(t('profile.uploadAvatarSuccess') || '头像上传成功');
      await refreshUserInfo();
    } catch (error: any) {
      message.error(error.message || t('profile.uploadAvatarFailed') || '头像上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error(t('profile.avatarFormatError') || '只能上传图片文件');
      e.target.value = '';
      return;
    }

    // 验证文件大小（5MB）
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error(t('profile.avatarSizeError') || '图片大小不能超过 5MB');
      e.target.value = '';
      return;
    }

    handleAvatarUpload(file);
    // 清空 input，以便可以重复选择同一文件
    e.target.value = '';
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('settings.profile')}</h2>

      <div className={styles.avatarSection}>
        <div className={styles.avatarWrapper}>
          <Avatar
            size={80}
            src={getAvatarUrl()}
            icon={<UserOutlined />}
            className={styles.avatar}
            onClick={() => fileInputRef.current?.click()}
          />
          <Button
            type="primary"
            shape="circle"
            icon={<CameraOutlined />}
            size="small"
            className={styles.avatarUploadBtn}
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
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
          {user?.created_at
            ? new Date(user.created_at).toLocaleString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US')
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
