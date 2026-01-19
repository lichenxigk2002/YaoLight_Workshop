import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Tabs, Typography, Select, Space, Divider, App } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, ApiOutlined, GlobalOutlined, GithubOutlined, GoogleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { userApi } from '@/api/user';
import { md5Hash } from '@/utils/crypto';
import { useTranslation } from 'react-i18next';
import type { LoginRequest } from '@/types/user';
import styles from './index.module.scss';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Option } = Select;

export default function Login() {
  const navigate = useNavigate();
  const { login: loginStore, isAuthenticated } = useAuthStore();
  const { message } = App.useApp();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [countdown, setCountdown] = useState(0);

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 登录
  const onLogin = async (values: LoginRequest) => {
    try {
      setLoading(true);
      // MD5 加密密码
      const encryptedPassword = md5Hash(values.password);

      const response = await userApi.login({
        username: values.username,
        password: encryptedPassword,
      });

      // 保存 token 和用户信息
      if (response && response.token && response.user) {
        loginStore(response.token, response.user);
      } else {
        throw new Error('登录响应格式错误');
      }

      message.success('登录成功！');
      navigate('/', { replace: true });
    } catch (error: any) {
      message.error(error.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const onRegister = async (values: any) => {
    try {
      setLoading(true);
      // MD5 加密密码
      const encryptedPassword = md5Hash(values.password);

      // 移除 confirmPassword 字段
      const { confirmPassword, ...registerData } = values;

      await userApi.register({
        ...registerData,
        password: encryptedPassword,
      });

      message.success('注册成功！请登录');
      setActiveTab('login');
    } catch (error: any) {
      message.error(error.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  // 发送验证码（登录/注册通用）
  const onSendCode = async (email: string) => {
    if (!email) {
      message.error('请输入邮箱地址');
      return;
    }

    try {
      await userApi.sendVerificationCode(email);
      message.success('验证码已发送，请查收邮件');
      setCountdown(60);
    } catch (error: any) {
      message.error(error.message || '发送验证码失败');
    }
  };

  // 邮箱验证码登录/注册（自动判断）
  const onEmailLogin = async (values: { email: string; code: string }) => {
    try {
      setLoading(true);
      const response = await userApi.emailLogin(values.email, values.code);

      if (response && response.token && response.user) {
        loginStore(response.token, response.user);
        message.success('登录成功！');
        navigate('/', { replace: true });
      } else {
        throw new Error('登录响应格式错误');
      }
    } catch (error: any) {
      message.error(error.message || '验证失败，请检查验证码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* 左侧品牌展示区 */}
        <div className={styles.brandSection}>
          <div className={styles.brandHeader}>
            <img src="/YaoLight_White.png" alt="YaoLight" className={styles.brandLogo} />
            <span className={styles.brandName}>{t('common.brandName')}</span>
          </div>
          <div className={styles.brandContent}>
            <Title level={1} className={styles.brandTitle}>
              {i18n.language === 'zh-CN' ? (
                <>构建未来的<br />智能工作流</>
              ) : (
                <>Build the Future of<br />Intelligent Workflows</>
              )}
            </Title>
            <Text className={styles.brandSubtitle}>
              {t('login.subtitle')}<br />
              {t('login.description')}
            </Text>
            <div className={styles.demoPreview}>
              {/* 装饰性背景元素 */}
              <div className={styles.decorationCircle1} />
              <div className={styles.decorationCircle2} />

              <div className={styles.glassCard}>
                <div className={styles.nodeItem}>
                  <div className={styles.nodeIconBox}>
                    <svg viewBox="0 0 24 24" fill="none" className={styles.nodeIconSvg}>
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className={styles.nodeText}>{i18n.language === 'zh-CN' ? 'AI 模型' : 'AI Model'}</div>
                </div>
                <div className={styles.connectionLine} />
                <div className={styles.nodeItem}>
                  <div className={styles.nodeIconBox}>
                    <svg viewBox="0 0 24 24" fill="none" className={styles.nodeIconSvg}>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 1V4M12 20V23M23 12H20M4 12H1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M18.36 5.64L16.24 7.76M7.76 16.24L5.64 18.36M18.36 18.36L16.24 16.24M7.76 7.76L5.64 5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className={styles.nodeText}>{i18n.language === 'zh-CN' ? '逻辑处理' : 'Logic Process'}</div>
                </div>
                <div className={styles.connectionLine} />
                <div className={styles.nodeItem}>
                  <div className={styles.nodeIconBox}>
                    <svg viewBox="0 0 24 24" fill="none" className={styles.nodeIconSvg}>
                      <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M7 16L12 9L16 13L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="7" cy="16" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="9" r="1.5" fill="currentColor" />
                      <circle cx="16" cy="13" r="1.5" fill="currentColor" />
                      <circle cx="21" cy="7" r="1.5" fill="currentColor" />
                    </svg>
                  </div>
                  <div className={styles.nodeText}>{i18n.language === 'zh-CN' ? '数据分析' : 'Data Analytics'}</div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.brandFooter}>
            <Text className={styles.copyrightText}>{t('common.copyright')}</Text>
          </div>
        </div>

        {/* 右侧登录表单区 */}
        <div className={styles.formSection}>
          <div className={styles.formHeader}>
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

          <div className={styles.formCard}>
            <div className={styles.cardHeader}>
              <Title level={2} className={styles.cardTitle}>
                {t('login.welcomeTitle')}
              </Title>
              <Text className={styles.cardSubtitle}>
                {t('login.welcomeSubtitle')}
              </Text>
            </div>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              className={styles.tabs}
              centered
              items={[
                {
                  key: 'login',
                  label: t('login.tabLogin'),
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
                        rules={[{ required: true, message: t('login.usernameRequired') }]}
                      >
                        <Input
                          prefix={<UserOutlined className={styles.inputIcon} />}
                          placeholder={t('login.usernamePlaceholder')}
                          className={styles.input}
                        />
                      </Form.Item>

                      <Form.Item
                        name="password"
                        rules={[{ required: true, message: t('login.passwordRequired') }]}
                      >
                        <Input.Password
                          prefix={<LockOutlined className={styles.inputIcon} />}
                          placeholder={t('login.passwordPlaceholder')}
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
                          {t('login.loginButton')}
                        </Button>
                      </Form.Item>
                    </Form>
                  )
                },
                {
                  key: 'email',
                  label: t('login.tabEmailLogin'),
                  children: (() => {
                    const [emailForm] = Form.useForm();
                    return (
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
                            { required: true, message: t('login.emailRequired') },
                            { type: 'email', message: t('login.emailInvalid') },
                          ]}
                        >
                          <Input
                            prefix={<MailOutlined className={styles.inputIcon} />}
                            placeholder={t('login.emailPlaceholder')}
                            className={styles.input}
                          />
                        </Form.Item>

                        <Form.Item
                          name="code"
                          rules={[
                            { required: true, message: t('login.codeRequired') },
                            { len: 6, message: t('login.codeInvalid') },
                          ]}
                        >
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <Input
                              placeholder={t('login.codePlaceholder')}
                              className={styles.input}
                              maxLength={6}
                            />
                            <Button
                              onClick={() => {
                                const email = emailForm.getFieldValue('email');
                                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                  onSendCode(email);
                                } else {
                                  message.error(t('login.emailInvalid'));
                                }
                              }}
                              disabled={countdown > 0}
                              className={styles.codeButton}
                            >
                              {countdown > 0 ? `${countdown}${t('login.codeCountdown')}` : t('login.getCode')}
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
                            {t('login.loginRegisterButton')}
                          </Button>
                        </Form.Item>

                        <div style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '16px' }}>
                          {t('login.firstTimeNote')}
                        </div>
                      </Form>
                    );
                  })()
                }
              ]}
            />

            <Divider plain className={styles.divider}>
              <span className={styles.dividerText}>{t('login.socialLogin')}</span>
            </Divider>

            <div className={styles.socialLogin}>
              <Button icon={<GithubOutlined />} className={styles.socialBtn} block>
                {t('login.githubLogin')}
              </Button>
              <Button icon={<GoogleOutlined />} className={styles.socialBtn} block>
                {t('login.googleLogin')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

