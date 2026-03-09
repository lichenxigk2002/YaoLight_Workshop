import { Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import type { AdminOrder } from '@/features/billing/types';
import { getAdminOrders } from '@/features/billing/api/quota';
import styles from './Billing.module.scss';

function formatTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setOrdersLoading(true);
    getAdminOrders({ page: ordersPage, page_size: ordersPageSize })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.list);
        setOrdersTotal(res.total);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ordersPage, ordersPageSize]);

  const orderColumns: ColumnsType<AdminOrder> = [
    { title: '订单号', dataIndex: 'order_id', key: 'order_id', width: 180 },
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
    { title: '套餐', dataIndex: 'package_name', key: 'package_name', ellipsis: true },
    {
      title: '金额 (CNY)',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => v.toFixed(2),
    },
    { title: '星尘', dataIndex: 'stardust', key: 'stardust', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const color = v === 'paid' ? 'green' : v === 'failed' ? 'red' : v === 'cancelled' ? 'default' : 'blue';
        return <span style={{ color }}>{v}</span>;
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: formatTime },
    { title: '支付时间', dataIndex: 'paid_at', key: 'paid_at', width: 160, render: formatTime },
  ];

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <Table<AdminOrder>
          rowKey="id"
          loading={ordersLoading}
          dataSource={orders}
          columns={orderColumns}
          pagination={{
            current: ordersPage,
            pageSize: ordersPageSize,
            total: ordersTotal,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setOrdersPage(p);
              setOrdersPageSize(ps || 20);
            },
          }}
        />
      </Card>
    </div>
  );
}

