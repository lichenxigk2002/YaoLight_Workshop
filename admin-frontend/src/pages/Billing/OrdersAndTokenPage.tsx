import { Card, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import type { AdminOrder, AdminTokenTransaction } from '@/features/billing/types';
import { getAdminOrders, getAdminTokenTransactions } from '@/features/billing/api/quota';
import styles from './Billing.module.scss';

function formatTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
}

export default function OrdersAndTokenPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [txs, setTxs] = useState<AdminTokenTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txLoading, setTxLoading] = useState(true);
  const [txScope, setTxScope] = useState<'usage' | 'balance'>('usage');

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
        return <Tag color={color}>{v}</Tag>;
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: formatTime },
    { title: '支付时间', dataIndex: 'paid_at', key: 'paid_at', width: 160, render: formatTime },
  ];

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
      <Tabs
        defaultActiveKey="orders"
        items={[
          {
            key: 'orders',
            label: '订单列表',
            children: (
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
            ),
          },
          {
            key: 'token',
            label: 'Token 流水',
            children: (
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
            ),
          },
        ]}
      />
    </div>
  );
}

