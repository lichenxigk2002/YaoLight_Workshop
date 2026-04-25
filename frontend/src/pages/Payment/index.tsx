import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Modal,
  QRCode,
  Result,
  Segmented,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import {
  AlipayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CreditCardOutlined,
  DesktopOutlined,
  MobileOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { paymentApi, type CreateOrderResponse, type StardustPackage } from '@/api/payment';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { subscribePaymentEvents } from '@/utils/paymentEvents';
import styles from './index.module.scss';

const { Text, Paragraph } = Typography;

type PaymentStatus = 'idle' | 'pending' | 'success' | 'failed';
type PaymentMethod = 'alipay_pc' | 'alipay_qr';

function formatPrice(value?: number) {
  return `¥${(value || 0).toFixed(1)}`;
}

function getPackageTone(index: number) {
  if (index === 1) return 'featured';
  if (index === 2) return 'premium';
  return 'default';
}

export default function Payment() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { user, setUser } = useAuthStore();

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

  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await paymentApi.getPackages(i18n.language);
      setPackages(data);
    } catch (error: any) {
      message.error(t('payment.loadPackagesFailed', { reason: error.message || t('common.unknownError') }));
    } finally {
      setLoading(false);
    }
  }, [i18n.language, message, t]);

  const refreshUserInfo = useCallback(async () => {
    try {
      const userData = await userApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user info after payment', error);
    }
  }, [setUser]);

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

  const resetPaymentState = useCallback((closeModal: boolean) => {
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
  }, []);

  const syncOrderStatus = useCallback(
    async (currentOrderId: string, silent = false) => {
      try {
        const status = await paymentApi.getOrderStatus(currentOrderId);
        if (status.status === 'paid') {
          stopPolling();
          setPaymentStatus('success');
          await refreshUserInfo();
          if (!silent) {
            message.success(t('payment.paySuccess'));
          }
          return;
        }

        if (status.status === 'failed' || status.status === 'cancelled') {
          stopPolling();
          setPaymentStatus('failed');
        }
      } catch (error) {
        console.error('Failed to query order status', error);
      }
    },
    [message, refreshUserInfo, t],
  );

  const startPolling = useCallback((currentOrderId: string) => {
    stopPolling();

    pollingIntervalRef.current = setInterval(() => {
      void syncOrderStatus(currentOrderId);
    }, 2000);

    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
    }, 5 * 60 * 1000);
  }, [syncOrderStatus]);

  const handleCreateOrder = useCallback(
    async (pkg: StardustPackage, methodOverride?: PaymentMethod) => {
      try {
        const resolvedMethod = methodOverride || paymentMethod;
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
          method: resolvedMethod,
        });

        setOrderId(response.orderId);

        if (response.payUrl) {
          setPayUrl(response.payUrl);
          const popup = window.open(response.payUrl, '_blank');
          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            message.warning(t('payment.popupBlocked'));
          }
          startPolling(response.orderId);
          return;
        }

        if (response.qrCode) {
          setQrCode(response.qrCode);
          qrCodeTimerRef.current = setTimeout(() => {
            setQrCodeExpired(true);
            message.warning(t('payment.qrExpiredRetry'));
          }, 2 * 60 * 1000);
          startPolling(response.orderId);
          return;
        }

        message.warning(t('payment.orderCreatedNoPayInfo'));
        setPaymentStatus('failed');
      } catch (error: any) {
        message.error(t('payment.createOrderFailed', { reason: error.message || t('common.unknownError') }));
        setPaymentStatus('failed');
      }
    },
    [message, paymentMethod, startPolling, t],
  );

  const handleRetry = useCallback(() => {
    if (selectedPackage) {
      void handleCreateOrder(selectedPackage);
    }
  }, [handleCreateOrder, selectedPackage]);

  const handleSwitchMethod = useCallback(
    (method: PaymentMethod) => {
      setPaymentMethod(method);
      if (selectedPackage) {
        void handleCreateOrder(selectedPackage, method);
      }
    },
    [handleCreateOrder, selectedPackage],
  );

  const handlePaymentSuccess = useCallback(() => {
    void refreshUserInfo();
    resetPaymentState(true);
    message.success(t('payment.rechargeSuccess'));
  }, [message, refreshUserInfo, resetPaymentState, t]);

  const handleClose = useCallback(() => {
    if (paymentStatus === 'success' || paymentStatus === 'failed') {
      resetPaymentState(true);
    }
  }, [paymentStatus, resetPaymentState]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    const unsubscribe = subscribePaymentEvents((event) => {
      if (!orderId || event.orderId !== orderId) {
        return;
      }

      void syncOrderStatus(event.orderId, true);
    });

    return unsubscribe;
  }, [orderId, syncOrderStatus]);

  useEffect(() => {
    return () => {
      stopPolling();
      stopQrCodeTimer();
    };
  }, []);

  const packageMetrics = useMemo(
    () =>
      packages.map((pkg, index) => ({
        ...pkg,
        tone: getPackageTone(index),
        unitPrice: pkg.stardust > 0 ? (pkg.price / pkg.stardust) * 1000000 : 0,
      })),
    [packages],
  );

  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroMain}>
          <SettingsPageTitle
            title={t('settings.recharge')}
            desc={t('payment.rechargeDesc')}
            icon={<CreditCardOutlined />}
            style={{ marginBottom: 0 }}
          />
        </div>

        <div className={styles.balanceCard}>
          <div className={styles.balanceLabel}>{t('settings.currentStardustBalance')}</div>
          <div className={styles.balanceValueRow}>
            <span className={styles.balanceValue}>{(user?.token_balance || 0).toLocaleString()}</span>
            <StardustIcon size={18} />
          </div>
          <div className={styles.balanceHint}>{t('payment.balanceHint')}</div>
        </div>
      </section>

      <section className={styles.infoStrip}>
        <Alert
          message={t('payment.rechargeNoticeTitle')}
          description={t('payment.rechargeNoticeDesc')}
          type="info"
          showIcon
          className={styles.inlineAlert}
        />

        <div className={styles.purchasePanel}>
          <div className={styles.purchaseHeader}>
            <div>
              <div className={styles.eyebrow}>{t('payment.paymentEyebrow')}</div>
              <h2 className={styles.sectionTitle}>{t('payment.chooseMethod')}</h2>
            </div>
            <div className={styles.purchaseHint}>
              <SafetyCertificateOutlined />
              <span>{t('payment.methodHint')}</span>
            </div>
          </div>

          <Segmented
            value={paymentMethod}
            onChange={(value) => setPaymentMethod(value as PaymentMethod)}
            options={[
              {
                label: (
                  <span className={styles.segmentLabel}>
                    <DesktopOutlined />
                    <span>{t('payment.webPay')}</span>
                  </span>
                ),
                value: 'alipay_pc',
              },
              {
                label: (
                  <span className={styles.segmentLabel}>
                    <MobileOutlined />
                    <span>{t('payment.qrPay')}</span>
                  </span>
                ),
                value: 'alipay_qr',
              },
            ]}
            className={styles.paymentMethod}
          />
        </div>
      </section>

      <section className={styles.packagesSection}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.eyebrow}>{t('payment.packagesEyebrow')}</div>
            <h2 className={styles.sectionTitle}>{t('payment.choosePackage')}</h2>
            <p className={styles.sectionDesc}>{t('payment.packageSectionDesc')}</p>
          </div>
        </div>

        <div className={styles.packagesGrid}>
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={styles.packageSkeleton}>
                  <Skeleton active paragraph={{ rows: 5 }} />
                </div>
              ))
            : packageMetrics.map((pkg) => (
                <article
                  key={pkg.id}
                  className={`${styles.packageCard} ${
                    pkg.tone === 'featured'
                      ? styles.packageCardFeatured
                      : pkg.tone === 'premium'
                        ? styles.packageCardPremium
                        : ''
                  }`}
                >
                  <div className={styles.packageTop}>
                    <div className={styles.packageHeader}>
                      <div>
                        <h3 className={styles.packageName}>{pkg.name}</h3>
                        <div className={styles.packageStardust}>
                          <span>{pkg.stardust.toLocaleString()}</span>
                          <StardustIcon size={18} />
                        </div>
                      </div>
                      {pkg.tag ? <Tag className={styles.packageTag}>{pkg.tag}</Tag> : null}
                    </div>

                    <div className={styles.packagePriceRow}>
                      <div className={styles.packagePrice}>{formatPrice(pkg.price)}</div>
                      <div className={styles.packageMeta}>
                        {t('payment.unitPrice', { price: pkg.unitPrice.toFixed(2) })}
                      </div>
                    </div>

                    <Paragraph className={styles.packageDesc}>
                      {pkg.description || t('payment.defaultPackageDesc')}
                    </Paragraph>
                  </div>

                  <div className={styles.packageFooter}>
                    <Button
                      icon={<AlipayCircleOutlined />}
                      className={styles.purchaseButton}
                      onClick={() => void handleCreateOrder(pkg)}
                    >
                      {t('payment.rechargeNow')}
                    </Button>
                  </div>
                </article>
              ))}
        </div>
      </section>

      <div className={styles.footerNote}>
        <Text type="secondary">{t('payment.footerNote')}</Text>
      </div>

      <Modal
        title={t('payment.orderModalTitle')}
        open={modalVisible}
        onCancel={handleClose}
        footer={null}
        width={560}
        closable={paymentStatus === 'success' || paymentStatus === 'failed'}
        maskClosable={paymentStatus === 'success' || paymentStatus === 'failed'}
        className={styles.paymentModal}
      >
        {paymentStatus === 'pending' ? (
          <div className={styles.modalBody}>
            <div className={styles.orderSummary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>{t('payment.rechargePackage')}</span>
                <strong>{selectedPackage?.name || '-'}</strong>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>{t('payment.creditStardust')}</span>
                <strong>{selectedPackage?.stardust.toLocaleString() || 0}</strong>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>{t('payment.payAmount')}</span>
                <strong>{formatPrice(selectedPackage?.price)}</strong>
              </div>
            </div>

            <div className={styles.methodSwitchRow}>
              <Button
                size="small"
                type={paymentMethod === 'alipay_pc' ? 'primary' : 'default'}
                onClick={() => handleSwitchMethod('alipay_pc')}
              >
                {t('payment.webPay')}
              </Button>
              <Button
                size="small"
                type={paymentMethod === 'alipay_qr' ? 'primary' : 'default'}
                onClick={() => handleSwitchMethod('alipay_qr')}
              >
                {t('payment.qrPay')}
              </Button>
            </div>

            <div className={styles.paymentBody}>
              {qrCode ? (
                <div className={styles.qrPanel}>
                  <QRCode value={qrCode} size={180} status={qrCodeExpired ? 'expired' : 'active'} />
                  <div className={styles.qrMeta}>
                    <div className={styles.qrTitle}>{t('payment.qrTitle')}</div>
                    <div className={styles.qrDesc}>{t('payment.qrDesc')}</div>
                  </div>
                  {qrCodeExpired ? (
                    <Alert
                      type="warning"
                      showIcon
                      message={t('payment.qrExpiredTitle')}
                      description={t('payment.qrExpiredDesc')}
                      action={
                        <Button size="small" onClick={handleRetry}>
                          {t('common.refresh')}
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              ) : (
                <div className={styles.redirectPanel}>
                  <div className={styles.redirectIcon}>
                    <DesktopOutlined />
                  </div>
                  <div className={styles.redirectTitle}>{t('payment.waitingWebPay')}</div>
                  <div className={styles.redirectDesc}>{t('payment.openPayPageDesc')}</div>
                  <Button type="primary" onClick={() => payUrl && window.open(payUrl, '_blank')}>
                    {t('payment.openPayPage')}
                  </Button>
                </div>
              )}
            </div>

            <div className={styles.orderFootnote}>
              <span>{t('payment.orderIdLabel', { orderId: orderId || '-' })}</span>
              <span>{t('payment.orderRecordHint')}</span>
            </div>
          </div>
        ) : null}

        {paymentStatus === 'success' ? (
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#2f9e44' }} />}
            title={t('payment.paySuccess')}
            subTitle={t('payment.paySuccessSubtitle', { stardust: selectedPackage?.stardust.toLocaleString() })}
            extra={[
              <Button type="primary" key="confirm" onClick={handlePaymentSuccess}>
                {t('common.done')}
              </Button>,
            ]}
          />
        ) : null}

        {paymentStatus === 'failed' ? (
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: '#d94841' }} />}
            title={t('payment.payFailed')}
            subTitle={t('payment.payFailedSubtitle')}
            extra={[
              <Button key="retry" icon={<ReloadOutlined />} onClick={handleRetry}>
                {t('common.retry')}
              </Button>,
              <Button type="primary" key="close" onClick={handleClose}>
                {t('common.close')}
              </Button>,
            ]}
          />
        ) : null}
      </Modal>
    </div>
  );
}
