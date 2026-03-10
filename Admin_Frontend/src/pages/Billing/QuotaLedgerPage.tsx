import { Card, Select } from 'antd';
import { useEffect, useState } from 'react';
import LedgerTable from '@/features/billing/components/LedgerTable';
import { getQuotaLedger } from '@/features/billing/api/quota';
import { useI18n } from '@/i18n';
import type { QuotaLedgerEntry, QuotaLedgerSourceType } from '@/features/billing/types';
import styles from './Billing.module.scss';

export default function QuotaLedgerPage() {
  const { t } = useI18n();
  const [list, setList] = useState<QuotaLedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [sourceType, setSourceType] = useState<QuotaLedgerSourceType | ''>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getQuotaLedger({
      page,
      page_size: pageSize,
      source_type: sourceType || undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setList(res.list);
          setTotal(res.total);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sourceType]);

  return (
    <div className={styles.page}>
      <Card className={styles.card} title={t('billing.ledgerTitle')}>
        <div className={styles.filterBar}>
          <Select
            value={sourceType || 'all'}
            style={{ width: 160 }}
            onChange={(value) => {
              setSourceType(value === 'all' ? '' : (value as QuotaLedgerSourceType));
              setPage(1);
            }}
            options={[
              { label: t('billing.ledgerFilterAll'), value: 'all' },
              { label: t('billing.ledgerFilterRecovery'), value: 'payment_recovery' },
              { label: t('billing.ledgerFilterAdminGift'), value: 'admin_gift' },
            ]}
          />
        </div>
        <LedgerTable
          dataSource={list}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 10);
            },
          }}
        />
      </Card>
    </div>
  );
}
