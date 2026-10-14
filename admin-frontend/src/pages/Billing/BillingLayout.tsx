import { Outlet } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useI18n } from '@/i18n';
import styles from './Billing.module.scss';

export default function BillingLayout() {
  const { t } = useI18n();

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('billing.layoutEyebrow')}
        title={t('billing.layoutTitle')}
        description={t('billing.layoutDescription')}
        tags={[
          t('billing.layoutTagInvite'),
          t('billing.layoutTagOrders'),
          t('billing.layoutTagTokenLedger'),
          t('billing.layoutTagPackages'),
          t('billing.layoutTagQuotaAdjust'),
          t('billing.layoutTagQuotaRecovery'),
          t('billing.layoutTagAdminGrant'),
        ]}
      />
      <Outlet />
    </div>
  );
}
