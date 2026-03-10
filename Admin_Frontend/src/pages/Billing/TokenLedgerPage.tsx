import { Card, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { getAdminTokenTransactions } from '@/features/billing/api/quota';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/runtime';
import type { AdminTokenTransaction } from '@/features/billing/types';
import styles from './Billing.module.scss';

function formatSignedNumber(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export default function TokenLedgerPage() {
  const { locale, t } = useI18n();
  const [txs, setTxs] = useState<AdminTokenTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txLoading, setTxLoading] = useState(true);
  const [txScope, setTxScope] = useState<'usage' | 'balance'>('usage');

  useEffect(() => {
    let cancelled = false;
    setTxLoading(true);

    getAdminTokenTransactions({ page: txPage, page_size: txPageSize, scope: txScope })
      .then((res) => {
        if (cancelled) {
          return;
        }

        setTxs(res.list);
        setTxTotal(res.total);
      })
      .finally(() => {
        if (!cancelled) {
          setTxLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [txPage, txPageSize, txScope]);

  const txUsageColumns: ColumnsType<AdminTokenTransaction> = [
    {
      title: t('billing.tokenColumnTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value?: string | null) => formatDateTime(value, locale, t('common.none')),
    },
    {
      title: t('billing.tokenColumnUser'),
      key: 'user',
      width: 220,
      render: (_: unknown, record) => (
        <div>
          <div>{record.user_username ?? t('common.none')}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            ID: {record.user_id} {record.user_no ? `· NO.${record.user_no}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: t('billing.tokenColumnAmount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 90,
      render: (value: number) => formatSignedNumber(value),
    },
    { title: t('billing.tokenColumnType'), dataIndex: 'type', key: 'type', width: 110 },
    { title: t('billing.tokenColumnProvider'), dataIndex: 'provider', key: 'provider', width: 100 },
    { title: t('billing.tokenColumnModel'), dataIndex: 'model_name', key: 'model_name', width: 160 },
    { title: t('billing.tokenColumnTotalTokens'), dataIndex: 'total_tokens', key: 'total_tokens', width: 120 },
    {
      title: t('billing.tokenColumnCost'),
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      render: (value: number, record) => `${value.toFixed(4)} ${record.currency}`,
    },
    { title: t('billing.tokenColumnDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  const txBalanceColumns: ColumnsType<AdminTokenTransaction> = [
    {
      title: t('billing.tokenColumnTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value?: string | null) => formatDateTime(value, locale, t('common.none')),
    },
    {
      title: t('billing.tokenColumnUser'),
      key: 'user',
      width: 220,
      render: (_: unknown, record) => (
        <div>
          <div>{record.user_username ?? t('common.none')}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            ID: {record.user_id} {record.user_no ? `· NO.${record.user_no}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: t('billing.tokenColumnBalanceAmount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      render: (value: number) => formatSignedNumber(value),
    },
    {
      title: t('billing.tokenColumnTotalTokens'),
      dataIndex: 'total_tokens',
      key: 'total_tokens',
      width: 120,
    },
    { title: t('billing.tokenColumnType'), dataIndex: 'type', key: 'type', width: 120 },
    {
      title: t('billing.tokenColumnRelatedId'),
      dataIndex: 'related_id',
      key: 'related_id',
      width: 160,
      ellipsis: true,
    },
    { title: t('billing.tokenColumnDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  const pagination = {
    current: txPage,
    pageSize: txPageSize,
    total: txTotal,
    showSizeChanger: true,
    showTotal: (total: number) => t('billing.paginationTotal', { total }),
    onChange: (page: number, pageSize?: number) => {
      setTxPage(page);
      setTxPageSize(pageSize || 20);
    },
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card} title={t('billing.tokenTitle')}>
        <Tabs
          activeKey={txScope}
          onChange={(key) => {
            setTxScope(key as 'usage' | 'balance');
            setTxPage(1);
          }}
          items={[
            {
              key: 'usage',
              label: t('billing.tokenScopeUsage'),
              children: (
                <Table<AdminTokenTransaction>
                  rowKey="id"
                  loading={txLoading}
                  dataSource={txs}
                  columns={txUsageColumns}
                  pagination={pagination}
                />
              ),
            },
            {
              key: 'balance',
              label: t('billing.tokenScopeBalance'),
              children: (
                <Table<AdminTokenTransaction>
                  rowKey="id"
                  loading={txLoading}
                  dataSource={txs}
                  columns={txBalanceColumns}
                  pagination={pagination}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
