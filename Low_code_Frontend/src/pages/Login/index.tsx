import { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, Tabs, Typography, Select, Space, Divider, App } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, ApiOutlined, GlobalOutlined, GithubOutlined, GoogleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { userApi } from '@/api/user';
import { md5Hash } from '@/utils/crypto';
import { useTranslation } from 'react-i18next';
import type { LoginRequest } from '@/types/user';
import LoginWorkflowCanvas from '@/components/LoginWorkflowCanvas';
import SplitText from '@/components/SplitText';
import CircularText from '@/components/CircularText';
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const circularTextRef = useRef<HTMLDivElement>(null);

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

  // 动态更新圆圈文字位置，使其跟随定位锚点
  useEffect(() => {
    const updateCircularTextPosition = () => {
      if (!anchorRef.current || !circularTextRef.current) return;

      const anchor = anchorRef.current;
      const circularText = circularTextRef.current;

      // 找到 wrapper 元素
      let wrapper = anchor.parentElement;
      while (wrapper && !wrapper.classList.contains(styles.wrapper)) {
        wrapper = wrapper.parentElement;
      }

      if (!wrapper) return;

      const anchorRect = anchor.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();

      // 计算相对于 wrapper 的位置，圆心与锚点对齐
      const top = anchorRect.top - wrapperRect.top + anchorRect.height / 2;
      const left = anchorRect.left - wrapperRect.left + anchorRect.width / 2;

      circularText.style.top = `${top}px`;
      circularText.style.left = `${left}px`;
    };

    // 延迟执行，确保 DOM 已渲染
    const timer = setTimeout(() => {
      updateCircularTextPosition();
    }, 100);

    // 监听窗口大小变化和滚动
    window.addEventListener('resize', updateCircularTextPosition);
    window.addEventListener('scroll', updateCircularTextPosition, true);

    // 使用 ResizeObserver 监听锚点位置变化
    let resizeObserver: ResizeObserver | null = null;
    if (anchorRef.current) {
      resizeObserver = new ResizeObserver(updateCircularTextPosition);
      resizeObserver.observe(anchorRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCircularTextPosition);
      window.removeEventListener('scroll', updateCircularTextPosition, true);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

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
        {/* 圆形文字装饰 - 移到 wrapper 层级，不受容器层级限制，保持混合模式工作 */}
        <div ref={circularTextRef} className={styles.circularTextWrapper}>
          <CircularText
            text="YaoLight Workshop ❤️"
            spinDuration={30}
            onHover="speedUp"
            radius={55}
            className={styles.circularText}
          />
        </div>
        {/* 左侧品牌展示区 */}
        <div className={styles.brandSection}>
          <div className={styles.brandHeader}>
            <img src="/YaoLight_White.png" alt="YaoLight" className={styles.brandLogo} />
            <span className={styles.brandName}>{t('common.brandName')}</span>
          </div>
          <div className={styles.brandContent}>
            <SplitText
              text={t('login.title').replace(/<br\s*\/?>/gi, '\n')}
              className={styles.brandTitle}
              delay={50}
              duration={1.25}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 40 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="-100px"
              textAlign="left"
              showCallback
            />
            <SplitText
              text={t('login.subtitle').replace(/<br\s*\/?>/gi, '\n')}
              className={styles.brandSubtitle}
              delay={50}
              duration={1.25}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 40 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="-100px"
              textAlign="left"
            />
            <div className={styles.demoPreview}>
              {/* 装饰性背景元素 */}
              <div className={styles.decorationCircle1} />
              <div className={styles.decorationCircle2} />

              {/* 可交互的工作流画布 */}
              <div className={styles.workflowCanvasWrapper}>
                {/* 1px 透明定位锚点，用于定位圆圈文字 */}
                <div ref={anchorRef} className={styles.circularTextAnchor} />
                <LoginWorkflowCanvas />
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

                        <div style={{ textAlign: 'center', color: '#666666', fontSize: '14px', marginTop: '16px', lineHeight: '1.6' }}>
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

