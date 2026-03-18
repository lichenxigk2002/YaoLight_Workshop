import { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Avatar, Modal, App, Dropdown, Collapse } from 'antd';
import type { MenuProps } from 'antd';
import {
  UserOutlined,
  EditOutlined,
  CameraOutlined,
  GithubOutlined,
  GoogleOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  LoginOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  IdcardOutlined,
  LeftOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { userApi } from '@/api/user';
import type { UserAvatarHistory } from '@/types/user';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import styles from './index.module.scss';

const getOAuthBaseUrl = () => {
  const base = import.meta.env.VITE_BASE_URL || '/api';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const isUnboundEmail = (email?: string) => !email || email.startsWith('unbound_');

export default function ProfileInfo() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, setUser, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [oauthBindings, setOauthBindings] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  const [avatarHistory, setAvatarHistory] = useState<UserAvatarHistory[]>([]);
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivateStep, setDeactivateStep] = useState(0);
  const [deactivateCodeSent, setDeactivateCodeSent] = useState(false);
  const [deactivateCountdown, setDeactivateCountdown] = useState(0);
  const [emailChangeModalOpen, setEmailChangeModalOpen] = useState(false);
  const [emailChangeIsBind, setEmailChangeIsBind] = useState(false);
  const [emailChangeCodeSent, setEmailChangeCodeSent] = useState(false);
  const [emailChangeCountdown, setEmailChangeCountdown] = useState(0);
  const [emailUnbindModalOpen, setEmailUnbindModalOpen] = useState(false);
  const [emailUnbindCodeSent, setEmailUnbindCodeSent] = useState(false);
  const [emailUnbindCountdown, setEmailUnbindCountdown] = useState(0);
  const [formDeactivate] = Form.useForm();
  const [formEmailChange] = Form.useForm();
  const [formEmailUnbind] = Form.useForm();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [formPassword] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<1 | 2>(1);
  const [forgotPasswordCountdown, setForgotPasswordCountdown] = useState(0);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [formForgotPassword] = Form.useForm();

  const refreshUserInfo = async () => {
    try {
      const userData = await userApi.getCurrentUser();
      setUser(userData);
    } catch (error: any) {
      message.error(t('profile.getUserInfoFailed'));
    }
  };

  const refreshOAuthBindings = async () => {
    try {
      const data = await userApi.getOAuthBindings();
      setOauthBindings(data);
    } catch {
      setOauthBindings({ github: false, google: false });
    }
  };

  const refreshAvatarHistory = async () => {
    try {
      const list = await userApi.getAvatarHistory();
      setAvatarHistory(Array.isArray(list) ? list : []);
    } catch {
      setAvatarHistory([]);
    }
  };

  useEffect(() => {
    refreshUserInfo();
    refreshOAuthBindings();
    refreshAvatarHistory();
  }, []);

  // 处理 OAuth 绑定回调：?oauth=bound 或 ?error=bind_*
  useEffect(() => {
    const oauth = searchParams.get('oauth');
    const err = searchParams.get('error');
    if (oauth === 'bound') {
      message.success(t('profile.oauthBindSuccess'));
      setSearchParams((p) => {
        p.delete('oauth');
        return p;
      }, { replace: true });
      refreshOAuthBindings();
      refreshUserInfo();
      return;
    }
    if (err && err.startsWith('bind_')) {
      message.error(err === 'bind_expired' ? t('profile.oauthBindExpired') : t('profile.oauthBindFailed'));
      setSearchParams((p) => {
        p.delete('error');
        return p;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, message, t]);

  useEffect(() => {
    if (deactivateCountdown <= 0) return;
    const t = setTimeout(() => setDeactivateCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [deactivateCountdown]);
  useEffect(() => {
    if (emailChangeCountdown <= 0) return;
    const t = setTimeout(() => setEmailChangeCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [emailChangeCountdown]);
  useEffect(() => {
    if (emailUnbindCountdown <= 0) return;
    const t = setTimeout(() => setEmailUnbindCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [emailUnbindCountdown]);
  useEffect(() => {
    if (forgotPasswordCountdown <= 0) return;
    const timer = setTimeout(() => setForgotPasswordCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [forgotPasswordCountdown]);

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

  const baseURL = import.meta.env.VITE_BASE_URL || '/api';
  const uploadsBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

  // 获取头像 URL（当前用户或历史项）
  const getAvatarUrl = (url?: string | null) => {
    const u = url ?? user?.avatar_url;
    if (!u) return undefined;
    if (u.startsWith('http')) return u;
    return `${uploadsBase}/uploads/${u}`;
  };

  // 处理头像上传
  const handleAvatarUpload = async (file: File) => {
    try {
      setUploading(true);
      await userApi.uploadAvatar(file);
      message.success(t('profile.uploadAvatarSuccess') || '头像上传成功');
      await refreshUserInfo();
      await refreshAvatarHistory();
    } catch (error: any) {
      message.error(error.message || t('profile.uploadAvatarFailed') || '头像上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleUseAvatar = async (historyId: number) => {
    try {
      await userApi.useAvatar(historyId);
      message.success(i18n.language === 'zh-CN' ? '已切换为该头像' : 'Avatar updated');
      await refreshUserInfo();
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
    }
  };

  const handleDeleteAvatarHistory = async (id: number) => {
    try {
      await userApi.deleteAvatarHistory(id);
      message.success(i18n.language === 'zh-CN' ? '已删除' : 'Deleted');
      await refreshAvatarHistory();
      await refreshUserInfo();
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
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

  const handleBindOAuth = async (provider: 'github' | 'google') => {
    try {
      const res = await userApi.requestOAuthBind(provider);
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      }
    } catch (e: any) {
      message.error(e.message || t('profile.oauthBindFailed'));
    }
  };

  const handleUnbindOAuth = async (provider: 'github' | 'google') => {
    try {
      await userApi.unbindOAuth(provider);
      message.success(t('profile.oauthUnbindSuccess'));
      refreshOAuthBindings();
    } catch (e: any) {
      message.error(e.message || t('profile.oauthUnbindFailed'));
    }
  };

  const handleSendDeactivateCode = async () => {
    try {
      await userApi.sendDeactivateCode();
      message.success(t('profile.sendCodeSuccess'));
      setDeactivateCodeSent(true);
      setDeactivateStep(1);
      setDeactivateCountdown(60);
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
    }
  };

  const handleConfirmDeactivate = async (values: { code: string; confirmText: string }) => {
    try {
      setLoading(true);
      await userApi.confirmDeactivate({ code: values.code, confirmText: (values.confirmText ?? '').toString().trim() });
      message.success(t('profile.deactivateSuccess'));
      setDeactivateModalOpen(false);
      setDeactivateStep(0);
      setDeactivateCodeSent(false);
      formDeactivate.resetFields();
      logout();
      navigate('/login', { replace: true });
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailChangeCode = async () => {
    try {
      const newEmail = formEmailChange.getFieldValue('newEmail')?.trim();
      if (!newEmail) {
        message.error(t('login.emailRequired'));
        return;
      }
      if (emailChangeIsBind) {
        await userApi.sendEmailBindCode(newEmail);
      } else {
        await userApi.sendEmailChangeCodeToNew(newEmail);
      }
      message.success(t('profile.sendCodeSuccess'));
      setEmailChangeCodeSent(true);
      setEmailChangeCountdown(60);
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
    }
  };

  const handleConfirmEmailChange = async (values: { code?: string; newEmail?: string }) => {
    try {
      setLoading(true);
      const newEmail = (values.newEmail ?? formEmailChange.getFieldValue('newEmail') ?? '').toString().trim();
      if (!newEmail) {
        message.error(t('login.emailRequired'));
        return;
      }
      await userApi.confirmEmailChange({ code: values.code ?? '', newEmail });
      message.success(emailChangeIsBind ? t('profile.bindEmailSuccess') : t('profile.changeEmailSuccess'));
      setEmailChangeModalOpen(false);
      setEmailChangeCodeSent(false);
      formEmailChange.resetFields();
      await refreshUserInfo();
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailUnbindCode = async () => {
    try {
      await userApi.sendEmailUnbindCode();
      message.success(t('profile.sendCodeSuccess'));
      setEmailUnbindCodeSent(true);
      setEmailUnbindCountdown(60);
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
    }
  };

  const handleConfirmEmailUnbind = async (values: { code: string }) => {
    try {
      setLoading(true);
      await userApi.confirmEmailUnbind({ code: values.code });
      message.success(t('profile.unbindEmailSuccess'));
      setEmailUnbindModalOpen(false);
      setEmailUnbindCodeSent(false);
      formEmailUnbind.resetFields();
      await refreshUserInfo();
    } catch (e: any) {
      message.error(e.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const displayEmail = user?.email && !isUnboundEmail(user.email) ? user.email : t('profile.emailUnboundDisplay');

  const handlePasswordSubmit = async (values: { oldPassword?: string; newPassword: string; confirmPassword?: string }) => {
    try {
      setPasswordLoading(true);
      await userApi.changePassword({
        oldPassword: user?.has_password ? values.oldPassword : undefined,
        newPassword: values.newPassword,
      });
      message.success(user?.has_password ? t('profile.passwordUpdated', '密码已更新') : t('profile.setPasswordSuccess', '密码设置成功'));
      setPasswordModalOpen(false);
      formPassword.resetFields();
      await refreshUserInfo();
    } catch (e: any) {
      message.error(e?.message || t('common.operationFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleForgotPasswordSendCode = async () => {
    const email = user?.email;
    if (!email || isUnboundEmail(email)) {
      message.error(t('profile.forgotPasswordNeedEmail', '请先绑定邮箱后再使用忘记密码'));
      return;
    }
    try {
      await userApi.sendForgotPasswordCode(email);
      message.success(t('profile.forgotCodeSent', '验证码已发送，请查收邮件'));
      setForgotPasswordStep(2);
      setForgotPasswordCountdown(60);
    } catch (e: any) {
      message.error(e?.message || t('common.operationFailed'));
    }
  };

  const handleForgotPasswordReset = async (values: { code: string; newPassword: string; confirmPassword: string }) => {
    const email = user?.email;
    if (!email || isUnboundEmail(email)) {
      message.error(t('profile.forgotPasswordNeedEmail', '请先绑定邮箱后再使用忘记密码'));
      return;
    }
    try {
      setForgotPasswordLoading(true);
      await userApi.resetPasswordByEmail({
        email,
        code: values.code,
        newPassword: values.newPassword,
      });
      message.success(t('profile.resetPasswordSuccess', '密码已重置'));
      setForgotPasswordModalOpen(false);
      setForgotPasswordStep(1);
      formForgotPassword.resetFields();
      await refreshUserInfo();
    } catch (e: any) {
      message.error(e?.message || t('common.operationFailed'));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const detailItems: { key: string; label: string; value: string; icon: React.ReactNode }[] = [
    { key: 'username', label: t('profile.username'), value: user?.username ?? '', icon: <UserOutlined /> },
    { key: 'email', label: t('profile.email'), value: displayEmail, icon: <MailOutlined /> },
    { key: 'userNo', label: t('profile.userNo'), value: user?.user_no != null ? String(user.user_no) : t('profile.unknown'), icon: <IdcardOutlined /> },
    { key: 'phone', label: t('profile.phone'), value: user?.phone || t('profile.notBound'), icon: <PhoneOutlined /> },
    {
      key: 'role',
      label: t('profile.role'),
      value: user?.role === 'admin' ? t('profile.admin') : t('profile.normalUser'),
      icon: <TeamOutlined />,
    },
    {
      key: 'status',
      label: t('profile.accountStatus'),
      value: user?.status === 'active' ? t('profile.active') : t('profile.inactive'),
      icon: <CheckCircleOutlined />,
    },
    { key: 'loginCount', label: t('profile.loginCount'), value: String(user?.login_count ?? 0), icon: <LoginOutlined /> },
    {
      key: 'lastLogin',
      label: t('profile.lastLogin'),
      value: user?.last_login_at
        ? new Date(user.last_login_at).toLocaleString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US')
        : t('profile.noRecord'),
      icon: <ClockCircleOutlined />,
    },
    {
      key: 'registrationTime',
      label: t('profile.registrationTime'),
      value: user?.created_at
        ? new Date(user.created_at).toLocaleString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US')
        : t('profile.unknown'),
      icon: <CalendarOutlined />,
    },
  ];

  return (
    <div className={styles.container}>
      <SettingsPageTitle title={t('settings.profile')} />

      <div className={styles.avatarSection}>
        <div className={styles.avatarWrapper}>
          <Avatar
            size={56}
            src={getAvatarUrl(undefined)}
            icon={<UserOutlined />}
            className={styles.avatar}
            onClick={() => fileInputRef.current?.click()}
          />
          <button
            type="button"
            className={styles.avatarUploadBtn}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label={i18n.language === 'zh-CN' ? '更换头像' : 'Change avatar'}
          >
            {uploading ? (
              <span className={styles.avatarUploadSpinner} />
            ) : (
              <CameraOutlined className={styles.avatarUploadIcon} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user?.username || t('profile.unknownUser')}</span>
          <span className={styles.userEmail}>{displayEmail}</span>
          <Button
            type="default"
            size="small"
            icon={<EditOutlined />}
            className={styles.modifyBtn}
            onClick={() => {
              form.setFieldsValue({ username: user?.username });
              setModalVisible(true);
            }}
          >
            {t('profile.modifyUsername')}
          </Button>
        </div>
      </div>

      <div className={styles.avatarHistorySection}>
        <Collapse
          bordered={false}
          className={styles.avatarHistoryCollapse}
          expandIconPosition="end"
          items={[
            {
              key: 'history',
              label: (
                <span className={styles.collapseLabel}>
                  <CameraOutlined />
                  {i18n.language === 'zh-CN' ? '头像历史' : 'Avatar history'}
                  {avatarHistory.length > 0 && (
                    <span className={styles.collapseCount}>（{avatarHistory.length}）</span>
                  )}
                </span>
              ),
              children:
                avatarHistory.length === 0 ? (
                  <div className={styles.avatarHistoryEmpty}>
                    {i18n.language === 'zh-CN' ? '暂无历史头像，上传新头像后会显示在这里' : 'No avatar history yet. Upload a new avatar to see it here.'}
                  </div>
                ) : (
                  <div className={styles.avatarHistoryGrid}>
                    {avatarHistory.map((item) => (
                      <div key={item.id} className={styles.avatarHistoryItem}>
                        <Avatar
                          size={48}
                          src={getAvatarUrl(item.avatar_url)}
                          icon={<UserOutlined />}
                          className={styles.avatarHistoryThumb}
                        />
                        <div className={styles.avatarHistoryActions}>
                          <Button type="primary" size="small" onClick={() => handleUseAvatar(item.id)}>
                            {i18n.language === 'zh-CN' ? '使用' : 'Use'}
                          </Button>
                          <Button size="small" danger onClick={() => handleDeleteAvatarHistory(item.id)}>
                            {i18n.language === 'zh-CN' ? '删除' : 'Delete'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
            },
          ]}
          expandIcon={({ isActive }) => (
            <span className={styles.collapseArrow}>
              <LeftOutlined style={{ fontSize: 10 }} rotate={isActive ? -90 : 0} />
            </span>
          )}
        />
      </div>

      <div className={styles.detailCard}>
        {detailItems.map(({ key, label, value, icon }) => (
          <div key={key} className={styles.detailRow}>
            <span className={styles.detailLabel}>
              <span className={styles.detailIcon}>{icon}</span>
              {label}
            </span>
            <span className={styles.detailValue}>
              {key === 'email' ? (
                <Dropdown
                  menu={{
                    items: isUnboundEmail(user?.email)
                      ? [
                        {
                          key: 'bind',
                          label: t('profile.bindEmail'),
                          onClick: () => { setEmailChangeModalOpen(true); setEmailChangeCodeSent(false); setEmailChangeIsBind(true); formEmailChange.resetFields(); },
                        },
                      ]
                      : [
                        {
                          key: 'change',
                          label: t('profile.changeEmail'),
                          onClick: () => { setEmailChangeModalOpen(true); setEmailChangeCodeSent(false); setEmailChangeIsBind(false); formEmailChange.resetFields(); },
                        },
                        {
                          key: 'unbind',
                          label: t('profile.unbindEmail'),
                          danger: true,
                          onClick: () => { setEmailUnbindModalOpen(true); setEmailUnbindCodeSent(false); formEmailUnbind.resetFields(); },
                        },
                      ],
                  } as { items: MenuProps['items'] }}
                  trigger={['hover', 'click']}
                  placement="bottomRight"
                >
                  <span className={styles.emailTrigger}>{value}</span>
                </Dropdown>
              ) : (
                value
              )}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.detailCard} style={{ marginTop: 16 }}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            <span className={styles.detailIcon}><LockOutlined /></span>
            {t('profile.password', '登录密码')}
          </span>
          <span className={styles.detailValue}>
            {user?.has_password
              ? t('profile.passwordSet', '已设置')
              : t('profile.passwordNotSet', '未设置（建议设置后可使用账号密码登录）')}
            <Button
              type="link"
              size="small"
              style={{ marginLeft: 8 }}
              onClick={() => {
                formPassword.resetFields();
                setPasswordModalOpen(true);
              }}
            >
              {user?.has_password ? t('profile.changePassword', '修改密码') : t('profile.setPassword', '设置密码')}
            </Button>
            {user?.has_password && (
              <Button
                type="link"
                size="small"
                style={{ marginLeft: 4 }}
                onClick={() => {
                  setForgotPasswordStep(1);
                  formForgotPassword.resetFields();
                  setForgotPasswordModalOpen(true);
                }}
              >
                {t('profile.forgotPassword', '忘记密码？')}
              </Button>
            )}
          </span>
        </div>
      </div>

      <div className={styles.detailCard} style={{ marginTop: 16 }}>
        <div className={styles.detailRow} style={{ borderBottom: 'none', paddingBottom: 6, marginBottom: 2 }}>
          <span className={styles.detailLabel} style={{ fontWeight: 600 }}>
            <span className={styles.detailIcon}><LinkOutlined /></span>
            {t('profile.oauthBindings')}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            <span className={styles.detailIcon}><GithubOutlined /></span>
            {t('profile.github')}
          </span>
          <span className={styles.detailValue}>
            {oauthBindings.github ? (
              <Button type="link" size="small" danger onClick={() => handleUnbindOAuth('github')}>
                {t('profile.unbind')}
              </Button>
            ) : (
              <Button type="link" size="small" onClick={() => handleBindOAuth('github')}>
                {t('profile.bind')}
              </Button>
            )}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>
            <span className={styles.detailIcon}><GoogleOutlined /></span>
            {t('profile.google')}
          </span>
          <span className={styles.detailValue}>
            {oauthBindings.google ? (
              <Button type="link" size="small" danger onClick={() => handleUnbindOAuth('google')}>
                {t('profile.unbind')}
              </Button>
            ) : (
              <Button type="link" size="small" onClick={() => handleBindOAuth('google')}>
                {t('profile.bind')}
              </Button>
            )}
          </span>
        </div>
      </div>

      <div className={styles.detailCard} style={{ marginTop: 16 }}>
        <div className={styles.detailRow} style={{ borderBottom: 'none', paddingBottom: 6, marginBottom: 2 }}>
          <span className={styles.detailLabel} style={{ fontWeight: 600 }}>
            <span className={styles.detailIcon}><ExclamationCircleOutlined /></span>
            {t('profile.deactivateAccount')}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel} style={{ color: 'var(--color-text-secondary)' }}>{t('profile.deactivateWarning')}</span>
          <span className={styles.detailValue}>
            <Button type="primary" danger size="small" onClick={() => { setDeactivateModalOpen(true); setDeactivateStep(0); setDeactivateCodeSent(false); formDeactivate.resetFields(); }}>
              {t('profile.deactivateAccount')}
            </Button>
          </span>
        </div>
      </div>

      <Modal
        title={user?.has_password ? t('profile.changePassword', '修改密码') : t('profile.setPassword', '设置密码')}
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          formPassword.resetFields();
        }}
        footer={null}
        destroyOnClose
        className={styles.centeredModal}
      >
        <div className={styles.modalFormWrap}>
          <Form
            form={formPassword}
            layout="vertical"
            onFinish={handlePasswordSubmit}
          >
            {user?.has_password && (
              <Form.Item
                name="oldPassword"
                label={t('profile.oldPassword', '当前密码')}
                rules={[{ required: true, message: t('profile.oldPasswordRequired', '请输入当前密码') }]}
              >
                <Input.Password placeholder={t('profile.oldPasswordPlaceholder', '请输入当前密码')} size="small" autoComplete="current-password" />
              </Form.Item>
            )}
            <Form.Item
              name="newPassword"
              label={t('profile.newPassword', '新密码')}
              rules={[
                { required: true, message: t('profile.newPasswordRequired', '请输入新密码') },
                { min: 6, message: t('profile.passwordMinLength', '密码至少 6 位') },
              ]}
            >
              <Input.Password placeholder={t('profile.newPasswordPlaceholder', '至少 6 位')} size="small" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label={t('profile.confirmPassword', '确认新密码')}
              dependencies={['newPassword']}
              rules={[
                { required: true, message: t('profile.confirmPasswordRequired', '请再次输入新密码') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                    return Promise.reject(new Error(t('profile.passwordMismatch', '两次输入的密码不一致')));
                  },
                }),
              ]}
            >
              <Input.Password placeholder={t('profile.confirmPasswordPlaceholder', '再次输入新密码')} size="small" autoComplete="new-password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" size="small" htmlType="submit" loading={passwordLoading} style={{ marginRight: 8 }}>
                {t('common.ok')}
              </Button>
              <Button size="small" onClick={() => { setPasswordModalOpen(false); formPassword.resetFields(); }}>
                {t('common.cancel')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      <Modal
        title={t('profile.forgotPassword', '忘记密码？')}
        open={forgotPasswordModalOpen}
        onCancel={() => {
          setForgotPasswordModalOpen(false);
          setForgotPasswordStep(1);
          formForgotPassword.resetFields();
        }}
        footer={null}
        destroyOnClose
        className={styles.centeredModal}
      >
        <div className={styles.modalFormWrap}>
          {forgotPasswordStep === 1 ? (
            <>
              <Form layout="vertical">
                <Form.Item label={t('profile.email')}>
                  <Input value={user?.email && !isUnboundEmail(user.email) ? user.email : ''} readOnly size="small" />
                </Form.Item>
                {isUnboundEmail(user?.email) ? (
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                    {t('profile.forgotPasswordNeedEmail', '请先绑定邮箱后再使用忘记密码')}
                  </p>
                ) : null}
              </Form>
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  size="small"
                  onClick={handleForgotPasswordSendCode}
                  disabled={isUnboundEmail(user?.email)}
                >
                  {t('profile.getCode', '获取验证码')}
                </Button>
                <Button size="small" style={{ marginLeft: 8 }} onClick={() => { setForgotPasswordModalOpen(false); setForgotPasswordStep(1); }}>
                  {t('common.cancel')}
                </Button>
              </div>
            </>
          ) : (
            <Form
              form={formForgotPassword}
              layout="vertical"
              onFinish={handleForgotPasswordReset}
            >
              <Form.Item label={t('profile.email')}>
                <Input value={user?.email} readOnly size="small" />
              </Form.Item>
              <Form.Item
                name="code"
                label={t('profile.verifyCode', '验证码')}
                rules={[
                  { required: true, message: t('profile.codeRequired', '请输入验证码') },
                  { len: 6, message: t('profile.codeInvalid', '验证码为 6 位') },
                ]}
              >
                <Input placeholder={t('profile.codePlaceholder', '请输入 6 位验证码')} maxLength={6} size="small" />
              </Form.Item>
              <div style={{ marginTop: -16, marginBottom: 16 }}>
                <Button
                  type="link"
                  size="small"
                  onClick={handleForgotPasswordSendCode}
                  disabled={forgotPasswordCountdown > 0}
                >
                  {forgotPasswordCountdown > 0 ? `${forgotPasswordCountdown} s` : t('profile.resendCode', '重新发送')}
                </Button>
              </div>
              <Form.Item
                name="newPassword"
                label={t('profile.newPassword', '新密码')}
                rules={[
                  { required: true, message: t('profile.newPasswordRequired', '请输入新密码') },
                  { min: 6, message: t('profile.passwordMinLength', '密码至少 6 位') },
                ]}
              >
                <Input.Password placeholder={t('profile.newPasswordPlaceholder', '至少 6 位')} size="small" autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label={t('profile.confirmPassword', '确认新密码')}
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: t('profile.confirmPasswordRequired', '请再次输入新密码') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                      return Promise.reject(new Error(t('profile.passwordMismatch', '两次输入的密码不一致')));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder={t('profile.confirmPasswordPlaceholder', '再次输入新密码')} size="small" autoComplete="new-password" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" size="small" htmlType="submit" loading={forgotPasswordLoading} style={{ marginRight: 8 }}>
                  {t('profile.resetPasswordButton', '重置密码')}
                </Button>
                <Button
                  size="small"
                  onClick={() => { setForgotPasswordStep(1); formForgotPassword.resetFields(); }}
                >
                  {t('profile.changeEmail', '更换邮箱')}
                </Button>
              </Form.Item>
            </Form>
          )}
        </div>
      </Modal>

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

      <Modal
        title={t('profile.deactivateAccount')}
        open={deactivateModalOpen}
        onCancel={() => {
          setDeactivateModalOpen(false);
          setDeactivateStep(0);
          setDeactivateCodeSent(false);
          formDeactivate.resetFields();
        }}
        footer={null}
        destroyOnHidden
        className={styles.centeredModal}
      >
        <div className={styles.modalFormWrap}>
          {deactivateStep === 0 ? (
            <>
              <p style={{ marginBottom: 12, fontSize: 13 }}>{t('profile.deactivateWarning')}</p>
              <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {t('profile.deactivateConfirmTip', { username: user?.username || '' })}
              </p>
              <Button type="primary" danger size="small" onClick={handleSendDeactivateCode} loading={loading}>
                {t('profile.getCode')}
              </Button>
            </>
          ) : (
            <Form form={formDeactivate} layout="vertical" onFinish={handleConfirmDeactivate}>
              <Form.Item
                name="code"
                label={t('login.code')}
                rules={[{ required: true, message: t('login.codeRequired') }, { len: 6, message: t('login.codeInvalid') }]}
              >
                <Input placeholder={t('login.codePlaceholder')} maxLength={6} size="small" />
              </Form.Item>
              <Form.Item
                name="confirmText"
                label={t('profile.confirmTextPlaceholder')}
                rules={[{ required: true, message: t('profile.usernameRequired') }]}
              >
                <Input placeholder={t('profile.confirmTextPlaceholder')} size="small" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" danger size="small" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
                  {t('profile.deactivateAccount')}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setDeactivateStep(0);
                    setDeactivateCodeSent(false);
                    formDeactivate.resetFields();
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </Form.Item>
            </Form>
          )}
        </div>
      </Modal>

      <Modal
        title={emailChangeIsBind ? t('profile.bindEmail') : t('profile.changeEmail')}
        open={emailChangeModalOpen}
        onCancel={() => {
          setEmailChangeModalOpen(false);
          setEmailChangeCodeSent(false);
          formEmailChange.resetFields();
        }}
        footer={null}
        destroyOnHidden
        className={styles.centeredModal}
      >
        <div className={styles.modalFormWrap}>
          <Form form={formEmailChange} layout="vertical" onFinish={emailChangeCodeSent ? handleConfirmEmailChange : undefined}>
            <Form.Item
              name="newEmail"
              label={t('profile.newEmail')}
              rules={[{ required: true, message: t('login.emailRequired') }, { type: 'email', message: t('login.emailInvalid') }]}
            >
              <Input placeholder={t('profile.newEmailPlaceholder')} size="small" />
            </Form.Item>
            {!emailChangeCodeSent ? (
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" size="small" onClick={handleSendEmailChangeCode} loading={loading}>
                  {t('profile.getCode')}
                </Button>
              </Form.Item>
            ) : (
              <>
                <Form.Item
                  name="code"
                  label={t('login.code')}
                  rules={[{ required: true, message: t('login.codeRequired') }, { len: 6, message: t('login.codeInvalid') }]}
                >
                  <Input placeholder={t('login.codePlaceholder')} maxLength={6} size="small" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button type="primary" size="small" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
                    {t('common.ok')}
                  </Button>
                  <Button size="small" onClick={() => setEmailChangeModalOpen(false)}>{t('common.cancel')}</Button>
                </Form.Item>
              </>
            )}
          </Form>
        </div>
      </Modal>

      <Modal
        title={t('profile.unbindEmail')}
        open={emailUnbindModalOpen}
        onCancel={() => {
          setEmailUnbindModalOpen(false);
          setEmailUnbindCodeSent(false);
          formEmailUnbind.resetFields();
        }}
        footer={null}
        destroyOnHidden
        className={styles.centeredModal}
      >
        <div className={styles.modalFormWrap}>
          {!emailUnbindCodeSent ? (
            <Button type="primary" danger size="small" onClick={handleSendEmailUnbindCode} loading={loading}>
              {t('profile.getCode')}
            </Button>
          ) : (
            <Form form={formEmailUnbind} layout="vertical" onFinish={handleConfirmEmailUnbind}>
              <Form.Item
                name="code"
                label={t('login.code')}
                rules={[{ required: true, message: t('login.codeRequired') }, { len: 6, message: t('login.codeInvalid') }]}
              >
                <Input placeholder={t('login.codePlaceholder')} maxLength={6} size="small" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" danger size="small" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
                  {t('profile.unbindEmail')}
                </Button>
                <Button size="small" onClick={() => setEmailUnbindModalOpen(false)}>{t('common.cancel')}</Button>
              </Form.Item>
            </Form>
          )}
        </div>
      </Modal>
    </div>
  );
}
