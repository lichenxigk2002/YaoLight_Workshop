import { Card } from 'antd';
import { useState } from 'react';
import QuotaRecoveryForm from '@/features/billing/components/QuotaRecoveryForm';
import { recoverQuota } from '@/features/billing/api/quota';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { RecoverQuotaPayload } from '@/features/billing/types';
import styles from './Billing.module.scss';

export default function QuotaRecoveryPage() {
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('billing.quota_recovery');
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
      <Card className={styles.card} title={t('billing.quotaRecoveryTitle')}>
        <p className={styles.muted} style={{ marginBottom: 16 }}>
          {t('billing.quotaRecoveryDescription')}
        </p>
        <QuotaRecoveryForm onSubmit={handleSubmit} loading={loading} disabled={!canEdit} />
      </Card>
    </div>
  );
}
