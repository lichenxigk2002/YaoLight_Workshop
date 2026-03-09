import { Card, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import type { AdminTokenTransaction } from '@/features/billing/types';
import { getAdminTokenTransactions } from '@/features/billing/api/quota';
import styles from './Billing.module.scss';

function formatTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
}

export default function TokenLedgerPage() {
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
        if (cancelled) return;
        setTxs(res.list);
        setTxTotal(res.total);
      })
      .finally(() => {
        if (!cancelled) setTxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [txPage, txPageSize, txScope]);

  const txUsageColumns: ColumnsType<AdminTokenTransaction> = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: formatTime },
    {
      title: '用户',
      key: 'user',
      width: 220,
      render: (_: unknown, r) => (
        <div>
          <div>{r.user_username ?? '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            ID: {r.user_id} {r.user_no ? `· NO.${r.user_no}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 90,
      render: (v: number) => (v >= 0 ? `+${v}` : v),
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 110 },
    { title: 'Provider', dataIndex: 'provider', key: 'provider', width: 100 },
    { title: '模型', dataIndex: 'model_name', key: 'model_name', width: 160 },
    { title: 'Token 数', dataIndex: 'total_tokens', key: 'total_tokens', width: 120 },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      width: 110,
      render: (v: number, r) => `${v.toFixed(4)} ${r.currency}`,
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  const txBalanceColumns: ColumnsType<AdminTokenTransaction> = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: formatTime },
    {
      title: '用户',
      key: 'user',
      width: 220,
      render: (_: unknown, r) => (
        <div>
          <div>{r.user_username ?? '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            ID: {r.user_id} {r.user_no ? `· NO.${r.user_no}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: '星尘变动',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      render: (v: number) => (v >= 0 ? `+${v}` : v),
    },
    {
      title: 'Token 数',
      dataIndex: 'total_tokens',
      key: 'total_tokens',
      width: 120,
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
    { title: '关联 ID', dataIndex: 'related_id', key: 'related_id', width: 160, ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <Tabs
          activeKey={txScope}
          onChange={(key) => {
            setTxScope(key as 'usage' | 'balance');
            setTxPage(1);
          }}
          items={[
            {
              key: 'usage',
              label: '模型消耗',
              children: (
                <Table<AdminTokenTransaction>
                  rowKey="id"
                  loading={txLoading}
                  dataSource={txs}
                  columns={txUsageColumns}
                  pagination={{
                    current: txPage,
                    pageSize: txPageSize,
                    total: txTotal,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p, ps) => {
                      setTxPage(p);
                      setTxPageSize(ps || 20);
                    },
                  }}
                />
              ),
            },
            {
              key: 'balance',
              label: '充值与赠送',
              children: (
                <Table<AdminTokenTransaction>
                  rowKey="id"
                  loading={txLoading}
                  dataSource={txs}
                  columns={txBalanceColumns}
                  pagination={{
                    current: txPage,
                    pageSize: txPageSize,
                    total: txTotal,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p, ps) => {
                      setTxPage(p);
                      setTxPageSize(ps || 20);
                    },
                  }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

