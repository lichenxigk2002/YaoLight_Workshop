import React, { useState } from 'react';
import { Typography, Card, Button, Row, Col, Tag, Space, Alert, Modal, Spin, Result, QRCode } from 'antd';
import { AlipayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StardustIcon } from '@/components/Icons';
import styles from './index.module.scss';

const { Title, Text, Paragraph } = Typography;

interface Package {
  id: string;
  name: string;
  price: number;
  stardust: number;
  tag?: string;
}

type PaymentStatus = 'idle' | 'pending' | 'success' | 'failed';

export default function Payment() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [orderId, setOrderId] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);

  // 写死的套餐数据
  const packages: Package[] = [
    { id: 'pkg_s', name: '星火包', price: 9.9, stardust: 4000000, tag: '入门' },
    { id: 'pkg_m', name: '星云包', price: 49.9, stardust: 20000000, tag: '热门' },
    { id: 'pkg_l', name: '星河包', price: 199.9, stardust: 80000000, tag: '超值' },
  ];

  // 模拟创建订单
  const handleCreateOrder = (pkg: Package) => {
    setSelectedPackage(pkg);
    setModalVisible(true);
    setPaymentStatus('pending');
    // 生成模拟订单号
    const mockOrderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    setOrderId(mockOrderId);
    
    // 模拟支付流程：3秒后自动成功
    setTimeout(() => {
      setPaymentStatus('success');
    }, 3000);
  };

  // 模拟支付成功
  const handlePaymentSuccess = () => {
    setModalVisible(false);
    setPaymentStatus('idle');
    setSelectedPackage(null);
    // 可以在这里刷新用户余额等操作
  };

  // 模拟支付失败
  const handlePaymentFailed = () => {
    setPaymentStatus('failed');
  };

  // 重试支付
  const handleRetry = () => {
    if (selectedPackage) {
      setPaymentStatus('pending');
      setTimeout(() => {
        setPaymentStatus('success');
      }, 3000);
    }
  };

  // 关闭模态框
  const handleClose = () => {
    if (paymentStatus === 'success' || paymentStatus === 'failed') {
      setModalVisible(false);
      setPaymentStatus('idle');
      setSelectedPackage(null);
    }
  };

  return (
    <div className={styles.container}>
      <Title level={2} className={styles.title}>
        充值星尘 <StardustIcon size={24} />
      </Title>

      <Alert
        message="温馨提示"
        description="星尘是平台内的通用资源，用于抵扣 AI 模型的 Token 消耗。充值后永久有效。"
        type="info"
        showIcon
        className={styles.alert}
      />

      <Row gutter={[24, 24]} className={styles.packagesRow}>
        {packages.map((pkg) => (
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
        ))}
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
            <Spin size="large" />
            <Title level={4} style={{ marginTop: 24, textAlign: 'center' }}>
              正在处理支付...
            </Title>
            <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
              订单号：{orderId}
            </Paragraph>
            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              套餐：{selectedPackage?.name} - ¥{selectedPackage?.price}
            </Paragraph>
            <div className={styles.qrCodeContainer}>
              <QRCode
                value="https://qr.alipay.com/bax00000example"
                size={200}
                status="loading"
              />
            </div>
            <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
              请使用支付宝扫码支付
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
