import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/runtime';
import type { QuotaLedgerEntry, QuotaLedgerSourceType } from '../types';

const sourceTypeColors: Record<QuotaLedgerSourceType, string> = {
  payment_recovery: 'orange',
  admin_gift: 'green',
};

interface LedgerTableProps {
  dataSource: QuotaLedgerEntry[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
}

export default function LedgerTable({ dataSource, loading, pagination }: LedgerTableProps) {
  const { locale, t } = useI18n();

  const sourceTypeLabels: Record<QuotaLedgerSourceType, string> = {
    payment_recovery: t('billing.ledgerSourcePaymentRecovery'),
    admin_gift: t('billing.ledgerSourceAdminGift'),
  };

  const columns: ColumnsType<QuotaLedgerEntry> = [
    {
      title: t('billing.ledgerColumnTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value, locale, t('common.none')),
    },
    {
      title: t('billing.ledgerColumnUser'),
      key: 'user',
      render: (_: unknown, record) => (
        <span>
          {record.user_display || record.user_id}
          <span style={{ color: '#999', marginLeft: 6 }}>{record.user_id}</span>
        </span>
      ),
    },
    {
      title: t('billing.ledgerColumnDelta'),
      dataIndex: 'delta',
      key: 'delta',
      width: 100,
      render: (value: number) => (
        <span style={{ color: value > 0 ? '#52c41a' : undefined }}>{value > 0 ? `+${value}` : value}</span>
      ),
    },
    {
      title: t('billing.ledgerColumnBalanceAfter'),
      dataIndex: 'balance_after',
      key: 'balance_after',
      width: 120,
    },
    {
      title: t('billing.ledgerColumnSource'),
      dataIndex: 'source_type',
      key: 'source_type',
      width: 140,
      render: (value: QuotaLedgerSourceType) => <Tag color={sourceTypeColors[value]}>{sourceTypeLabels[value]}</Tag>,
    },
    {
      title: t('billing.ledgerColumnSourceId'),
      dataIndex: 'source_id',
      key: 'source_id',
      ellipsis: true,
      render: (value: string) => value || t('common.none'),
    },
    {
      title: t('billing.ledgerColumnOperator'),
      key: 'operator',
      render: (_: unknown, record) => record.operator_display || record.operator_id || t('common.none'),
    },
    {
      title: t('billing.ledgerColumnRemark'),
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (value: string) => value || t('common.none'),
    },
  ];

  return (
    <Table<QuotaLedgerEntry>
      rowKey="id"
      loading={loading}
      dataSource={dataSource}
      columns={columns}
      pagination={
        pagination
          ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => t('billing.paginationTotal', { total }),
              onChange: pagination.onChange,
            }
          : false
      }
    />
  );
}
