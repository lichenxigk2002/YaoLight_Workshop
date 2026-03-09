import { Card } from 'antd';
import { useState } from 'react';
import QuotaRecoveryForm from '@/features/billing/components/QuotaRecoveryForm';
import { recoverQuota } from '@/features/billing/api/quota';
import type { RecoverQuotaPayload } from '@/features/billing/types';
import styles from './Billing.module.scss';

export default function QuotaRecoveryPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(payload: RecoverQuotaPayload) {
    setLoading(true);
    try {
      await recoverQuota(payload);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Card className={styles.card} title="补救配额（支付失败补发）">
        <p className={styles.muted} style={{ marginBottom: 16 }}>
          用于支付失败、回调异常等场景下为用户补发配额。提交后将记入配额流水，来源类型为「支付失败补发」。
        </p>
        <QuotaRecoveryForm onSubmit={handleSubmit} loading={loading} />
      </Card>
    </div>
  );
}
