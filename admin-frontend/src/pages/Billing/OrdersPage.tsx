import { Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { getAdminOrders } from '@/features/billing/api/quota';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/runtime';
import type { AdminOrder } from '@/features/billing/types';
import styles from './Billing.module.scss';

function getOrderStatusMeta(status: string, t: (key: string) => string) {
  switch (status) {
    case 'paid':
      return { color: 'green', label: t('billing.ordersStatusPaid') };
    case 'pending':
      return { color: 'blue', label: t('billing.ordersStatusPending') };
    case 'failed':
      return { color: 'red', label: t('billing.ordersStatusFailed') };
    case 'cancelled':
      return { color: 'default', label: t('billing.ordersStatusCancelled') };
    default:
      return { color: 'default', label: status };
  }
}

export default function OrdersPage() {
  const { locale, t } = useI18n();
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
        if (cancelled) {
          return;
        }

        setOrders(res.list);
        setOrdersTotal(res.total);
      })
      .finally(() => {
        if (!cancelled) {
          setOrdersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ordersPage, ordersPageSize]);

  const columns: ColumnsType<AdminOrder> = [
    { title: t('billing.ordersColumnOrderId'), dataIndex: 'order_id', key: 'order_id', width: 180 },
    {
      title: t('billing.ordersColumnUser'),
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
    { title: t('billing.ordersColumnPackage'), dataIndex: 'package_name', key: 'package_name', ellipsis: true },
    {
      title: t('billing.ordersColumnAmount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (value: number) => value.toFixed(2),
    },
    { title: t('billing.ordersColumnStardust'), dataIndex: 'stardust', key: 'stardust', width: 100 },
    {
      title: t('billing.ordersColumnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => {
        const meta = getOrderStatusMeta(value, t);
        return <span style={{ color: meta.color === 'default' ? undefined : meta.color }}>{meta.label}</span>;
      },
    },
    {
      title: t('billing.ordersColumnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value?: string | null) => formatDateTime(value, locale, t('common.none')),
    },
    {
      title: t('billing.ordersColumnPaidAt'),
      dataIndex: 'paid_at',
      key: 'paid_at',
      width: 180,
      render: (value?: string | null) => formatDateTime(value, locale, t('common.none')),
    },
  ];

  return (
    <div className={styles.page}>
      <Card className={styles.card} title={t('billing.ordersTitle')}>
        <Table<AdminOrder>
          rowKey="id"
          loading={ordersLoading}
          dataSource={orders}
          columns={columns}
          pagination={{
            current: ordersPage,
            pageSize: ordersPageSize,
            total: ordersTotal,
            showSizeChanger: true,
            showTotal: (total) => t('billing.paginationTotal', { total }),
            onChange: (page, pageSize) => {
              setOrdersPage(page);
              setOrdersPageSize(pageSize || 20);
            },
          }}
        />
      </Card>
    </div>
  );
}
