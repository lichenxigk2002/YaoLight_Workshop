import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { QuotaLedgerEntry, QuotaLedgerSourceType } from '../types';

const sourceTypeLabels: Record<QuotaLedgerSourceType, string> = {
  payment_recovery: '支付失败补发',
  admin_gift: '管理员赠送',
};

const sourceTypeColors: Record<QuotaLedgerSourceType, string> = {
  payment_recovery: 'orange',
  admin_gift: 'green',
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN');
  } catch {
    return iso;
  }
}

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
  const columns: ColumnsType<QuotaLedgerEntry> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v: string) => formatTime(v),
    },
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, r: QuotaLedgerEntry) => (
        <span>
          {r.user_display || r.user_id}
          <span style={{ color: '#999', marginLeft: 6 }}>{r.user_id}</span>
        </span>
      ),
    },
    {
      title: '变动',
      dataIndex: 'delta',
      key: 'delta',
      width: 100,
      render: (v: number) => <span style={{ color: v > 0 ? '#52c41a' : undefined }}>+{v}</span>,
    },
    {
      title: '变动后余额',
      dataIndex: 'balance_after',
      key: 'balance_after',
      width: 110,
    },
    {
      title: '来源',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 130,
      render: (v: QuotaLedgerSourceType) => (
        <Tag color={sourceTypeColors[v]}>{sourceTypeLabels[v]}</Tag>
      ),
    },
    {
      title: '来源 ID',
      dataIndex: 'source_id',
      key: 'source_id',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: '操作人',
      key: 'operator',
      render: (_: unknown, r: QuotaLedgerEntry) => r.operator_display || r.operator_id,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
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
              showTotal: (t) => `共 ${t} 条`,
              onChange: pagination.onChange,
            }
          : false
      }
    />
  );
}
