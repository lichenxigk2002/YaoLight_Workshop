import { useEffect, useMemo } from 'react';
import { Button, Result, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { buildPaymentEvent, emitPaymentEvent } from '@/utils/paymentEvents';

const { Paragraph } = Typography;

export default function PaymentCallback() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const status = searchParams.get('status') || 'pending';

  const normalizedStatus = useMemo(() => {
    const value = status.toLowerCase();
    if (value === 'success') return 'paid';
    if (value === 'error') return 'failed';
    return value;
  }, [status]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    emitPaymentEvent(buildPaymentEvent(orderId, normalizedStatus));

    const timer = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // noop
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [normalizedStatus, orderId]);

  if (!orderId) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <Result
          status="error"
          title={t('payment.callbackMissingTitle')}
          subTitle={t('payment.callbackMissingDesc')}
          extra={
            <Button type="primary" href="/settings/orders">
              {t('payment.backToOrders')}
            </Button>
          }
        />
      </div>
    );
  }

  if (normalizedStatus === 'paid') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <Result
          status="success"
          title={t('payment.callbackSuccessTitle')}
          subTitle={t('payment.callbackSuccessDesc')}
          extra={
            <Button type="primary" onClick={() => window.close()}>
              {t('payment.closeNow')}
            </Button>
          }
        />
      </div>
    );
  }

  if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <Result
          status="warning"
          title={t('payment.callbackPendingTitle')}
          subTitle={t('payment.callbackPendingDesc')}
          extra={
            <Button type="primary" href="/settings/orders">
              {t('payment.viewOrders')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 24, marginBottom: 8, fontSize: 18, fontWeight: 500 }}>
          {t('payment.confirmingStatus')}
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('payment.confirmingStatusDesc')}
        </Paragraph>
      </div>
    </div>
  );
}
