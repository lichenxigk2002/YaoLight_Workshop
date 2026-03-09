import { Card } from 'antd';
import { useState } from 'react';
import AdminGrantForm from '@/features/billing/components/AdminGrantForm';
import { grantQuota } from '@/features/billing/api/quota';
import type { GrantQuotaPayload } from '@/features/billing/types';
import styles from './Billing.module.scss';

export default function AdminGrantPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(payload: GrantQuotaPayload) {
    setLoading(true);
    try {
      await grantQuota(payload);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Card className={styles.card} title="管理员赠送配额">
        <p className={styles.muted} style={{ marginBottom: 16 }}>
          运营/活动赠送等场景。提交后将记入配额流水，来源类型为「管理员赠送」。
        </p>
        <AdminGrantForm onSubmit={handleSubmit} loading={loading} />
      </Card>
    </div>
  );
}
