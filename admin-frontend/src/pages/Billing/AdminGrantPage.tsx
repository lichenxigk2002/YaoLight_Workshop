import { Card } from 'antd';
import { useState } from 'react';
import AdminGrantForm from '@/features/billing/components/AdminGrantForm';
import { grantQuota } from '@/features/billing/api/quota';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { GrantQuotaPayload } from '@/features/billing/types';
import styles from './Billing.module.scss';

export default function AdminGrantPage() {
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('billing.admin_grant');
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
      <Card className={styles.card} title={t('billing.adminGrantTitle')}>
        <p className={styles.muted} style={{ marginBottom: 16 }}>
          {t('billing.adminGrantDescription')}
        </p>
        <AdminGrantForm onSubmit={handleSubmit} loading={loading} disabled={!canEdit} />
      </Card>
    </div>
  );
}
