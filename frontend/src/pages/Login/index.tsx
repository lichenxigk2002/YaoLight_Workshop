import { useEffect, useMemo, useState } from 'react';
import { Form, Input, Button, Tabs, Select, Divider, App, Typography } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  GlobalOutlined,
  GithubOutlined,
  GoogleOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { userApi } from '@/api/user';
import { useTranslation } from 'react-i18next';
import type { LoginRequest } from '@/types/user';
import LoginWorkflowCanvas from '@/components/LoginWorkflowCanvas';
import SplitText from '@/components/SplitText';
import { ICP_ICON_URL, ICP_NUMBER, ICP_URL } from '@/config/legal';
import styles from './index.module.scss';

const { Option } = Select;
const { Text } = Typography;

const getOAuthBaseUrl = () => {
  const base = import.meta.env.VITE_BASE_URL || '/api';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login: loginStore, isAuthenticated, setToken, setUser } = useAuthStore();
  const { message } = App.useApp();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh-CN';
  const inviteCode = searchParams.get('invite') || '';

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [countdown, setCountdown] = useState(0);
  const [emailForm] = Form.useForm();

  const copy = useMemo(
    () => ({
      brandName: t('common.brandName'),
      brandNameEn: t('common.brandNameEn', 'YaoLight Workshop'),
      copyright: t('common.copyright'),
      brandTitle: t('login.title'),
      brandSubtitle: t('login.subtitle'),
      welcomeTitle: t('login.welcomeTitle'),
      welcomeSubtitle: t('login.welcomeSubtitle'),
      accountTab: t('login.tabLogin'),
      emailTab: t('login.tabEmailLogin'),
      usernamePlaceholder: t('login.usernamePlaceholder'),
      passwordPlaceholder: t('login.passwordPlaceholder'),
      emailPlaceholder: t('login.emailPlaceholder'),
      codePlaceholder: t('login.codePlaceholder'),
      loginButton: t('login.loginButton'),
      emailButton: t('login.loginRegisterButton'),
      sendCode: t('login.getCode'),
      codeCountdown: t('login.codeCountdown'),
      socialLogin: t('login.socialLogin'),
      githubLogin: t('login.githubLogin'),
      googleLogin: t('login.googleLogin'),
      firstTimeNote: t('login.firstTimeNote'),
      usernameRequired: t('login.usernameRequired'),
      passwordRequired: t('login.passwordRequired'),
      emailRequired: t('login.emailRequired'),
      emailInvalid: t('login.emailInvalid'),
      codeRequired: t('login.codeRequired'),
      codeInvalid: t('login.codeInvalid'),
      inviteLabel: isZh ? '邀请码已生效' : 'Invite code applied',
      previewLabel: isZh ? '灵感画布' : 'Inspiration canvas',
      previewMeta: isZh ? '把想法拖成一条可执行的路径' : 'Shape ideas into a path you can run',
      loginSuccess: isZh ? '登录成功' : 'Signed in successfully.',
      loginInvalid: isZh ? '登录失败，请检查用户名和密码' : 'Sign in failed. Please check your username and password.',
      oauthNotConfigured: isZh ? 'OAuth 未配置' : 'OAuth is not configured.',
      oauthMissingCode: isZh ? '授权未完成' : 'Authorization was not completed.',
      oauthFailed: isZh ? '第三方登录失败' : 'Third-party sign in failed.',
      oauthTokenInvalid: isZh ? '登录已过期，请重试' : 'The sign-in session expired. Please try again.',
      sendCodeSuccess: isZh ? '验证码已发送，请查收邮件' : 'Verification code sent. Please check your inbox.',
      sendCodeEmpty: isZh ? '请输入邮箱地址' : 'Please enter your email address.',
      sendCodeFailed: isZh ? '发送验证码失败' : 'Failed to send verification code.',
    }),
    [isZh, t],
  );

  const titleText = useMemo(
    () => copy.brandTitle.replace(/<br\s*\/?>/gi, '\n'),
    [copy.brandTitle],
  );
  const subtitleText = useMemo(
    () => copy.brandSubtitle.replace(/<br\s*\/?>/gi, '\n'),
    [copy.brandSubtitle],
  );

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      const errorMessage =
        error === 'google_not_configured' || error === 'github_not_configured'
          ? copy.oauthNotConfigured
          : error === 'missing_code'
            ? copy.oauthMissingCode
            : copy.oauthFailed;
      message.error(errorMessage);

      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
      return;
    }

    if (!token) return;

    setToken(token);
    const next = new URLSearchParams(searchParams);
    next.delete('token');
    setSearchParams(next, { replace: true });

    setTimeout(() => {
      userApi
        .getCurrentUser()
        .then((user) => {
          setUser(user);
          message.success(copy.loginSuccess);
          navigate('/', { replace: true });
        })
        .catch(() => {
          message.error(copy.oauthTokenInvalid);
          useAuthStore.getState().logout();
        });
    }, 0);
  }, [
    copy.loginSuccess,
    copy.oauthFailed,
    copy.oauthMissingCode,
    copy.oauthNotConfigured,
    copy.oauthTokenInvalid,
    message,
    navigate,
    searchParams,
    setSearchParams,
    setToken,
    setUser,
  ]);

  const onLogin = async (values: LoginRequest) => {
    try {
      setLoading(true);
      const response = await userApi.login({
        username: values.username,
        password: values.password,
      });

      if (!response?.token) {
        throw new Error(copy.loginInvalid);
      }

      setToken(response.token);
      const currentUser = await userApi.getCurrentUser();
      setUser(currentUser);
      message.success(copy.loginSuccess);
      navigate('/', { replace: true });
    } catch (error: any) {
      message.error(error.message || copy.loginInvalid);
    } finally {
      setLoading(false);
    }
  };

  const onSendCode = async (email: string) => {
    if (!email) {
      message.error(copy.sendCodeEmpty);
      return;
    }

    try {
      await userApi.sendVerificationCode(email);
      message.success(copy.sendCodeSuccess);
      setCountdown(60);
    } catch (error: any) {
      message.error(error.message || copy.sendCodeFailed);
    }
  };

  const onEmailLogin = async (values: { email: string; code: string }) => {
    try {
      setLoading(true);
      const response = await userApi.emailLogin(values.email, values.code, inviteCode || undefined);

      if (!response?.token || !response?.user) {
        throw new Error(copy.codeInvalid);
      }

      loginStore(response.token, response.user);
      message.success(copy.loginSuccess);
      navigate('/', { replace: true });
    } catch (error: any) {
      message.error(error.message || copy.codeInvalid);
    } finally {
      setLoading(false);
    }
  };

  const openOAuth = (provider: 'github' | 'google') => {
    const state = inviteCode ? `invite_${inviteCode}` : '';
    const url = `${getOAuthBaseUrl()}/auth/${provider}${state ? `?state=${encodeURIComponent(state)}` : ''}`;
    window.location.href = url;
  };

  return (
    <div className={styles.page}>
      <div className={styles.splitLayout}>
        <section className={styles.brandPane}>
          <div className={styles.brandTop}>
            <div className={styles.brandIdentity}>
              <img src="/YaoLight_White.png" alt="YaoLight" className={styles.brandLogo} />
              <div className={styles.brandWordmarkGroup}>
                <span className={styles.brandWordmark}>{copy.brandName}</span>
                <span className={styles.brandWordmarkEn}>{copy.brandNameEn}</span>
              </div>
            </div>

            {inviteCode ? (
              <div className={styles.invitePill}>
                <span>{copy.inviteLabel}</span>
                <strong>{inviteCode}</strong>
              </div>
            ) : null}
          </div>

          <div className={styles.brandMain}>
            <div className={styles.brandTextBlock}>
              <SplitText
                text={titleText}
                className={styles.brandTitle}
                delay={36}
                duration={1}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 26 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-60px"
                textAlign="left"
              />
              <SplitText
                text={subtitleText}
                className={styles.brandSubtitle}
                delay={18}
                duration={0.9}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 18 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-60px"
                textAlign="left"
              />
            </div>

            <div className={styles.previewPanel}>
              <div className={styles.previewHeader}>
                <span className={styles.previewLabel}>{copy.previewLabel}</span>
                <span className={styles.previewMeta}>{copy.previewMeta}</span>
              </div>
              <div className={styles.previewFrame}>
                <LoginWorkflowCanvas />
              </div>
            </div>
          </div>

        </section>

        <section className={styles.formPane}>
          <div className={styles.formTopbar}>
            <Select
              value={i18n.language}
              onChange={(value) => i18n.changeLanguage(value)}
              className={styles.languageSelect}
              bordered={false}
              suffixIcon={<GlobalOutlined />}
            >
              <Option value="zh-CN">简体中文</Option>
              <Option value="en-US">English</Option>
            </Select>
          </div>

          <div className={styles.formBody}>
            <div className={styles.formPanel}>
              <div className={styles.authHeader}>
                <h2 className={styles.authTitle}>{copy.welcomeTitle}</h2>
                <p className={styles.authSubtitle}>{copy.welcomeSubtitle}</p>
              </div>

              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                className={styles.tabs}
                items={[
                  {
                    key: 'login',
                    label: copy.accountTab,
                    children: (
                      <Form
                        name="login"
                        onFinish={onLogin}
                        autoComplete="off"
                        size="large"
                        layout="vertical"
                        className={styles.form}
                      >
                        <Form.Item
                          name="username"
                          rules={[{ required: true, message: copy.usernameRequired }]}
                        >
                          <Input
                            prefix={<UserOutlined className={styles.inputIcon} />}
                            placeholder={copy.usernamePlaceholder}
                            className={styles.input}
                          />
                        </Form.Item>

                        <Form.Item
                          name="password"
                          rules={[{ required: true, message: copy.passwordRequired }]}
                        >
                          <Input.Password
                            prefix={<LockOutlined className={styles.inputIcon} />}
                            placeholder={copy.passwordPlaceholder}
                            className={styles.input}
                          />
                        </Form.Item>

                        <Form.Item className={styles.submitItem}>
                          <Button
                            type="primary"
                            htmlType="submit"
                            block
                            loading={loading}
                            className={styles.submitButton}
                          >
                            {copy.loginButton}
                          </Button>
                        </Form.Item>
                      </Form>
                    ),
                  },
                  {
                    key: 'email',
                    label: copy.emailTab,
                    children: (
                      <Form
                        form={emailForm}
                        name="emailLogin"
                        onFinish={onEmailLogin}
                        autoComplete="off"
                        size="large"
                        layout="vertical"
                        className={styles.form}
                      >
                        <Form.Item
                          name="email"
                          rules={[
                            { required: true, message: copy.emailRequired },
                            { type: 'email', message: copy.emailInvalid },
                          ]}
                        >
                          <Input
                            prefix={<MailOutlined className={styles.inputIcon} />}
                            placeholder={copy.emailPlaceholder}
                            className={styles.input}
                          />
                        </Form.Item>

                        <Form.Item
                          name="code"
                          rules={[
                            { required: true, message: copy.codeRequired },
                            { len: 6, message: copy.codeInvalid },
                          ]}
                        >
                          <div className={styles.codeRow}>
                            <Input
                              placeholder={copy.codePlaceholder}
                              className={styles.input}
                              maxLength={6}
                            />
                            <Button
                              onClick={() => {
                                const email = emailForm.getFieldValue('email');
                                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                  void onSendCode(email);
                                } else {
                                  message.error(copy.emailInvalid);
                                }
                              }}
                              disabled={countdown > 0}
                              className={styles.codeButton}
                            >
                              {countdown > 0 ? `${countdown}${copy.codeCountdown}` : copy.sendCode}
                            </Button>
                          </div>
                        </Form.Item>

                        <Form.Item className={styles.submitItem}>
                          <Button
                            type="primary"
                            htmlType="submit"
                            block
                            loading={loading}
                            className={styles.submitButton}
                          >
                            {copy.emailButton}
                          </Button>
                        </Form.Item>

                        <div className={styles.formHint}>{copy.firstTimeNote}</div>
                      </Form>
                    ),
                  },
                ]}
              />

              <Divider plain className={styles.divider}>
                <span className={styles.dividerText}>{copy.socialLogin}</span>
              </Divider>

              <div className={styles.socialLogin}>
                <Button
                  icon={<GithubOutlined />}
                  className={styles.socialBtn}
                  block
                  onClick={() => openOAuth('github')}
                >
                  {copy.githubLogin}
                </Button>
                <Button
                  icon={<GoogleOutlined />}
                  className={styles.socialBtn}
                  block
                  onClick={() => openOAuth('google')}
                >
                  {copy.googleLogin}
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.legalText}>
            <Text className={styles.copyrightText}>{copy.copyright}</Text>
            <a href={ICP_URL} target="_blank" rel="noreferrer" className={styles.legalLink}>
              <img src={ICP_ICON_URL} alt="" className={styles.legalIcon} aria-hidden="true" />
              {ICP_NUMBER}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
