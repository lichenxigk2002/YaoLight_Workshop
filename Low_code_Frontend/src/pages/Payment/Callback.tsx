import { useEffect, useMemo } from 'react';
import { Button, Result, Spin, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { buildPaymentEvent, emitPaymentEvent } from '@/utils/paymentEvents';

const { Paragraph } = Typography;

export default function PaymentCallback() {
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
          title="支付回调信息缺失"
          subTitle="未获取到有效订单号，请返回订单页确认支付结果。"
          extra={
            <Button type="primary" href="/settings/orders">
              返回订单页
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
          title="支付完成"
          subTitle="已通知原页面刷新支付状态，这个窗口会自动关闭。"
          extra={
            <Button type="primary" onClick={() => window.close()}>
              立即关闭
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
          title="支付状态待确认"
          subTitle="已通知原页面刷新订单状态，请回到原页面查看最新结果。"
          extra={
            <Button type="primary" href="/settings/orders">
              查看订单
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
          正在确认支付状态
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          已将回调信息发送给原页面，请稍候查看订单结果。
        </Paragraph>
      </div>
    </div>
  );
}
