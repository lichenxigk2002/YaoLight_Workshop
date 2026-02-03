import React, { useState, useEffect, useRef } from 'react';
import { Typography, Card, Button, Row, Col, Tag, Space, Alert, Modal, Spin, Result, QRCode, message, Radio } from 'antd';
import { AlipayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { paymentApi, type StardustPackage, type CreateOrderResponse } from '@/api/payment';
import styles from './index.module.scss';

const { Title, Text, Paragraph } = Typography;

type PaymentStatus = 'idle' | 'pending' | 'success' | 'failed';
type PaymentMethod = 'alipay_pc' | 'alipay_qr';

function Payment() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [packages, setPackages] = useState<StardustPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<StardustPackage | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay_pc'); // 默认PC支付（更稳定）
  const [orderId, setOrderId] = useState<string>('');
  const [payUrl, setPayUrl] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [qrCodeExpired, setQrCodeExpired] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrCodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载套餐列表
  useEffect(() => {
    loadPackages();
  }, []);

  // 清理轮询和定时器
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (qrCodeTimerRef.current) {
        clearTimeout(qrCodeTimerRef.current);
      }
    };
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const data = await paymentApi.getPackages();
      setPackages(data);
    } catch (error: any) {
      message.error('加载套餐列表失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 创建订单
  const handleCreateOrder = async (pkg: StardustPackage) => {
    try {
      setSelectedPackage(pkg);
      setModalVisible(true);
      setPaymentStatus('pending');
      setPayUrl('');
      setQrCode('');

      // 调用后端创建订单
      const response: CreateOrderResponse = await paymentApi.createOrder({
        packageId: pkg.id,
        method: paymentMethod, // 使用选择的支付方式
      });

      // 调试日志
      console.log('创建订单响应:', response);
      console.log('支付方式:', paymentMethod);
      console.log('二维码:', response.qrCode);
      console.log('支付链接:', response.payUrl);

      setOrderId(response.orderId);

      // 如果有支付链接，直接跳转
      if (response.payUrl) {
        console.log('PC支付链接:', response.payUrl);
        setPayUrl(response.payUrl);
        // 尝试跳转到支付宝支付页面（可能被浏览器拦截）
        const newWindow = window.open(response.payUrl, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // 弹窗被拦截，显示提示
          message.warning('浏览器阻止了弹窗，请点击下方按钮手动打开支付页面');
        }
        // 开始轮询订单状态
        startPolling(response.orderId);
      } else if (response.qrCode) {
        // 如果有二维码，显示二维码
        console.log('设置二维码:', response.qrCode);
        setQrCode(response.qrCode);
        setQrCodeExpired(false);
        // 设置二维码过期时间（5分钟后标记为过期）
        if (qrCodeTimerRef.current) {
          clearTimeout(qrCodeTimerRef.current);
        }
        // 支付宝沙箱二维码有效期很短（通常1-2分钟），设置为2分钟过期
        qrCodeTimerRef.current = setTimeout(() => {
          setQrCodeExpired(true);
          message.warning('二维码已过期，请刷新二维码');
        }, 2 * 60 * 1000); // 2分钟
        // 开始轮询订单状态
        startPolling(response.orderId);
      } else {
        // 没有支付链接也没有二维码
        console.warn('创建订单成功，但没有返回支付链接或二维码:', response);
        message.warning('创建订单成功，但未获取到支付信息，请重试');
        // 可以调用模拟支付接口
        try {
          await paymentApi.mockPay(response.orderId);
          setPaymentStatus('success');
        } catch (error: any) {
          message.error('模拟支付失败: ' + (error.message || '未知错误'));
          setPaymentStatus('failed');
        }
      }
    } catch (error: any) {
      message.error('创建订单失败: ' + (error.message || '未知错误'));
      setPaymentStatus('failed');
    }
  };

  // 开始轮询订单状态
  const startPolling = (orderId: string) => {
    // 清除之前的轮询
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // 每2秒轮询一次
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const status = await paymentApi.getOrderStatus(orderId);
        if (status.status === 'paid') {
          // 支付成功
          setPaymentStatus('success');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          message.success('支付成功！');
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          // 支付失败或取消
          setPaymentStatus('failed');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (error) {
        // 轮询错误，继续轮询
        console.error('查询订单状态失败:', error);
      }
    }, 2000);

    // 30秒后停止轮询（订单可能已过期）
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, 30000);
  };

  // 支付成功处理
  const handlePaymentSuccess = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setModalVisible(false);
    setPaymentStatus('idle');
    setSelectedPackage(null);
    setOrderId('');
    setPayUrl('');
    setQrCode('');
    // 可以在这里刷新用户余额等操作
    message.success('充值成功，星尘已到账！');
  };

  // 重试支付
  const handleRetry = () => {
    if (selectedPackage) {
      handleCreateOrder(selectedPackage);
    }
  };

  // 关闭模态框
  const handleClose = () => {
    if (paymentStatus === 'success' || paymentStatus === 'failed') {
      setModalVisible(false);
      setPaymentStatus('idle');
      setSelectedPackage(null);
      setQrCode('');
      setQrCodeExpired(false);
      if (qrCodeTimerRef.current) {
        clearTimeout(qrCodeTimerRef.current);
        qrCodeTimerRef.current = null;
      }
    }
  };

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
          <Col span={24} style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </Col>
        ) : (
          packages.map((pkg) => (
          <Col xs={24} sm={8} key={pkg.id}>
            <Card
              hoverable
              className={styles.packageCard}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
            >
              {pkg.tag && (
                <Tag color="blue" className={styles.packageTag}>
                  {pkg.tag}
                </Tag>
              )}
              <Title level={3} className={styles.packageName}>
                {pkg.name}
              </Title>
              <div className={styles.stardustAmount}>
                {pkg.stardust.toLocaleString()} <StardustIcon size={20} />
              </div>
              <Text type="secondary" className={styles.stardustLabel}>星尘</Text>

              <Title level={2} className={styles.price}>
                ¥{pkg.price}
              </Title>

              <Button
                type="primary"
                size="large"
                icon={<AlipayCircleOutlined />}
                block
                className={styles.payButton}
                onClick={() => handleCreateOrder(pkg)}
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
          遇到问题？<a href="#">联系客服</a>
        </Text>
      </div>

      {/* 支付模态框 */}
      <Modal
        title="支付订单"
        open={modalVisible}
        onCancel={handleClose}
        footer={null}
        width={500}
        closable={paymentStatus === 'success' || paymentStatus === 'failed'}
        maskClosable={paymentStatus === 'success' || paymentStatus === 'failed'}
      >
        {paymentStatus === 'pending' && (
          <div className={styles.paymentPending}>
            {/* 支付方式选择（仅在初始状态显示） */}
            {!qrCode && !payUrl && (
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>选择支付方式：</Text>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Radio.Button value="alipay_qr" style={{ flex: 1 }}>
                    <MobileOutlined /> 扫码支付
                  </Radio.Button>
                  <Radio.Button value="alipay_pc" style={{ flex: 1 }}>
                    <DesktopOutlined /> PC支付
                  </Radio.Button>
                </Radio.Group>
              </div>
            )}
            
            <Spin size="large" />
            <Title level={4} style={{ marginTop: 24, textAlign: 'center' }}>
              {qrCode ? '请使用支付宝扫码支付' : payUrl ? '正在跳转到支付宝...' : '正在处理支付...'}
            </Title>
            <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
              订单号：{orderId}
            </Paragraph>
            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              套餐：{selectedPackage?.name} - ¥{selectedPackage?.price}
            </Paragraph>
            {qrCode ? (
              <div className={styles.qrCodeContainer}>
                <Alert
                  message="扫码支付"
                  description={
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        如果二维码无法使用，可以：
                      </div>
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
                {qrCodeExpired && (
                  <Alert
                    message="二维码已过期"
                    description="请点击下方按钮刷新二维码，或使用PC支付方式"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    action={
                      <Button size="small" onClick={handleRetry}>
                        刷新
                      </Button>
                    }
                  />
                )}
                <QRCode
                  value={qrCode}
                  size={200}
                  status={qrCodeExpired ? 'expired' : 'active'}
                />
                <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12, textAlign: 'center' }}>
                  请使用支付宝扫码支付
                  <br />
                  <Text type="warning" style={{ fontSize: 11 }}>
                    ⚠️ 如果二维码失效，请点击上方链接或使用PC支付
                  </Text>
                  {qrCodeExpired && (
                    <>
                      <br />
                      <Text type="danger" style={{ fontSize: 11 }}>
                        （二维码已过期，请刷新或使用PC支付）
                      </Text>
                    </>
                  )}
                </Paragraph>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  {qrCodeExpired && (
                    <Button
                      type="primary"
                      size="small"
                      onClick={handleRetry}
                      style={{ marginRight: 8 }}
                    >
                      刷新二维码
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => {
                      // 切换到PC支付
                      setPaymentMethod('alipay_pc');
                      handleRetry();
                    }}
                  >
                    改用PC支付
                  </Button>
                </div>
              </div>
            ) : payUrl ? (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Alert
                  message="PC支付"
                  description="正在跳转到支付宝支付页面，如果未自动跳转，请点击下方按钮"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    console.log('手动打开支付链接:', payUrl);
                    window.open(payUrl, '_blank');
                  }}
                >
                  打开支付宝支付页面
                </Button>
                <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
                  如果页面没有自动跳转，请点击上方按钮
                </Paragraph>
                <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 11, wordBreak: 'break-all' }}>
                  支付链接: {payUrl.substring(0, 100)}...
                </Paragraph>
              </div>
            ) : null}
            <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
              支付完成后，系统会自动更新订单状态
            </Paragraph>
          </div>
        )}

        {paymentStatus === 'success' && (
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="支付成功！"
            subTitle={`已成功充值 ${selectedPackage?.stardust.toLocaleString()} 星尘`}
            extra={[
              <Button type="primary" key="confirm" onClick={handlePaymentSuccess}>
                确定
              </Button>,
            ]}
          />
        )}

        {paymentStatus === 'failed' && (
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
        )}
      </Modal>
    </div>
  );
}

export default Payment;
