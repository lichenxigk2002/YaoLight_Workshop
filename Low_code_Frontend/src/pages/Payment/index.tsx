import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Modal,
  QRCode,
  Radio,
  Result,
  Row,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AlipayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DesktopOutlined,
  MobileOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { paymentApi, type CreateOrderResponse, type StardustPackage } from '@/api/payment';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { subscribePaymentEvents } from '@/utils/paymentEvents';
import styles from './index.module.scss';

const { Title, Text } = Typography;

type PaymentStatus = 'idle' | 'pending' | 'success' | 'failed';
type PaymentMethod = 'alipay_pc' | 'alipay_qr';

export default function Payment() {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();

  const [packages, setPackages] = useState<StardustPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<StardustPackage | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay_pc');
  const [orderId, setOrderId] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [qrCodeExpired, setQrCodeExpired] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qrCodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    void loadPackages();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePaymentEvents((event) => {
      if (!orderId || event.orderId !== orderId) {
        return;
      }

      void syncOrderStatus(event.orderId, true);
    });

    return unsubscribe;
  }, [orderId]);

  useEffect(() => {
    return () => {
      stopPolling();
      stopQrCodeTimer();
    };
  }, []);

  async function loadPackages() {
    try {
      setLoading(true);
      const data = await paymentApi.getPackages();
      setPackages(data);
    } catch (error: any) {
      message.error(`加载套餐列表失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }

  async function refreshUserInfo() {
    try {
      const userData = await userApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user info after payment', error);
    }
  }

  function stopPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }

  function stopQrCodeTimer() {
    if (qrCodeTimerRef.current) {
      clearTimeout(qrCodeTimerRef.current);
      qrCodeTimerRef.current = null;
    }
  }

  function resetPaymentState(closeModal: boolean) {
    stopPolling();
    stopQrCodeTimer();
    if (closeModal) {
      setModalVisible(false);
    }
    setPaymentStatus('idle');
    setSelectedPackage(null);
    setOrderId('');
    setPayUrl('');
    setQrCode('');
    setQrCodeExpired(false);
  }

  async function syncOrderStatus(currentOrderId: string, silent = false) {
    try {
      const status = await paymentApi.getOrderStatus(currentOrderId);
      if (status.status === 'paid') {
        stopPolling();
        setPaymentStatus('success');
        await refreshUserInfo();
        if (!silent) {
          message.success('支付成功');
        }
        return;
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        stopPolling();
        setPaymentStatus('failed');
      }
    } catch (error) {
      console.error('查询订单状态失败', error);
    }
  }

  function startPolling(currentOrderId: string) {
    stopPolling();

    pollingIntervalRef.current = setInterval(() => {
      void syncOrderStatus(currentOrderId);
    }, 2000);

    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
    }, 5 * 60 * 1000);
  }

  async function handleCreateOrder(pkg: StardustPackage) {
    try {
      setSelectedPackage(pkg);
      setModalVisible(true);
      setPaymentStatus('pending');
      setPayUrl('');
      setQrCode('');
      setQrCodeExpired(false);
      stopPolling();
      stopQrCodeTimer();

      const response: CreateOrderResponse = await paymentApi.createOrder({
        packageId: pkg.id,
        method: paymentMethod,
      });

      setOrderId(response.orderId);

      if (response.payUrl) {
        setPayUrl(response.payUrl);
        const popup = window.open(response.payUrl, '_blank');
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          message.warning('浏览器阻止了弹窗，请点击下方按钮手动打开支付页面');
        }
        startPolling(response.orderId);
        return;
      }

      if (response.qrCode) {
        setQrCode(response.qrCode);
        qrCodeTimerRef.current = setTimeout(() => {
          setQrCodeExpired(true);
          message.warning('二维码已过期，请刷新二维码');
        }, 2 * 60 * 1000);
        startPolling(response.orderId);
        return;
      }

      message.warning('创建订单成功，但未获取到支付信息，请重试');
    } catch (error: any) {
      message.error(`创建订单失败: ${error.message || '未知错误'}`);
      setPaymentStatus('failed');
    }
  }

  function handlePaymentSuccess() {
    void refreshUserInfo();
    resetPaymentState(true);
    message.success('充值成功，星尘已到账');
  }

  function handleRetry() {
    if (selectedPackage) {
      void handleCreateOrder(selectedPackage);
    }
  }

  function handleClose() {
    if (paymentStatus === 'success' || paymentStatus === 'failed') {
      resetPaymentState(true);
    }
  }

  return (
    <div className={styles.container}>
      <SettingsPageTitle title={t('settings.recharge')} />

      <Alert
        message="温馨提示"
        description="星尘是平台内的通用资源，用于抵扣 AI 模型的 Token 消耗。充值后永久有效。"
        type="info"
        showIcon
        className={styles.alert}
      />

      <Row gutter={[24, 24]} className={styles.packagesRow}>
        {loading ? (
          <Col span={24} style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </Col>
        ) : (
          packages.map((pkg) => (
            <Col xs={24} sm={8} key={pkg.id}>
              <Card
                hoverable
                className={styles.packageCard}
                bodyStyle={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                {pkg.tag ? (
                  <Tag color="blue" className={styles.packageTag}>
                    {pkg.tag}
                  </Tag>
                ) : null}

                <Title level={3} className={styles.packageName}>
                  {pkg.name}
                </Title>
                <div className={styles.stardustAmount}>
                  {pkg.stardust.toLocaleString()} <StardustIcon size={20} />
                </div>
                <Text type="secondary" className={styles.stardustLabel}>
                  星尘
                </Text>

                <Title level={2} className={styles.price}>
                  ￥{pkg.price}
                </Title>

                <Button
                  type="primary"
                  size="large"
                  icon={<AlipayCircleOutlined />}
                  block
                  className={styles.payButton}
                  onClick={() => void handleCreateOrder(pkg)}
                >
                  立即充值
                </Button>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <div className={styles.footer}>
        <Text type="secondary">
          遇到问题，<a href="#">联系客服</a>
        </Text>
      </div>

      <Modal
        title="支付订单"
        open={modalVisible}
        onCancel={handleClose}
        footer={null}
        width={500}
        closable={paymentStatus === 'success' || paymentStatus === 'failed'}
        maskClosable={paymentStatus === 'success' || paymentStatus === 'failed'}
      >
        {paymentStatus === 'pending' ? (
          <div className={styles.paymentPending}>
            {!qrCode && !payUrl ? (
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  选择支付方式：
                </Text>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Radio.Button value="alipay_qr" style={{ flex: 1 }}>
                    <MobileOutlined /> 扫码支付
                  </Radio.Button>
                  <Radio.Button value="alipay_pc" style={{ flex: 1 }}>
                    <DesktopOutlined /> PC 支付
                  </Radio.Button>
                </Radio.Group>
              </div>
            ) : null}

            <Spin size="large" />
            <Title level={4} style={{ marginTop: 24, textAlign: 'center' }}>
              {qrCode ? '请使用支付宝扫码支付' : payUrl ? '正在跳转到支付宝...' : '正在处理支付...'}
            </Title>
            <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
              订单号：{orderId}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
              套餐：{selectedPackage?.name} - ￥{selectedPackage?.price}
            </Typography.Paragraph>

            {qrCode ? (
              <div className={styles.qrCodeContainer}>
                <Alert
                  message="扫码支付"
                  description={
                    <div>
                      <div style={{ marginBottom: 8 }}>如果二维码无法使用，可以：</div>
                      <div style={{ marginTop: 8 }}>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => window.open(qrCode, '_blank')}
                          style={{ padding: 0, height: 'auto' }}
                        >
                          点击这里直接打开支付链接
                        </Button>
                      </div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                {qrCodeExpired ? (
                  <Alert
                    message="二维码已过期"
                    description="请点击下方按钮刷新二维码，或切换到 PC 支付。"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    action={
                      <Button size="small" onClick={handleRetry}>
                        刷新
                      </Button>
                    }
                  />
                ) : null}

                <QRCode value={qrCode} size={200} status={qrCodeExpired ? 'expired' : 'active'} />
                <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12, textAlign: 'center' }}>
                  请使用支付宝扫码支付
                </Typography.Paragraph>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  {qrCodeExpired ? (
                    <Button type="primary" size="small" onClick={handleRetry} style={{ marginRight: 8 }}>
                      刷新二维码
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    onClick={() => {
                      setPaymentMethod('alipay_pc');
                      handleRetry();
                    }}
                  >
                    改用 PC 支付
                  </Button>
                </div>
              </div>
            ) : null}

            {payUrl ? (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Alert
                  message="PC 支付"
                  description="正在跳转到支付宝支付页面，如果未自动打开，请点击下方按钮。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    window.open(payUrl, '_blank');
                  }}
                >
                  打开支付宝支付页
                </Button>
                <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
                  支付完成后，原页面会自动刷新订单状态。
                </Typography.Paragraph>
              </div>
            ) : null}
          </div>
        ) : null}

        {paymentStatus === 'success' ? (
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="支付成功"
            subTitle={`已成功充值 ${selectedPackage?.stardust.toLocaleString()} 星尘`}
            extra={[
              <Button type="primary" key="confirm" onClick={handlePaymentSuccess}>
                确定
              </Button>,
            ]}
          />
        ) : null}

        {paymentStatus === 'failed' ? (
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            title="支付失败"
            subTitle="支付过程中出现错误，请重试或联系客服"
            extra={[
              <Button key="retry" icon={<ReloadOutlined />} onClick={handleRetry}>
                重试
              </Button>,
              <Button type="primary" key="close" onClick={handleClose}>
                关闭
              </Button>,
            ]}
          />
        ) : null}
      </Modal>
    </div>
  );
}
