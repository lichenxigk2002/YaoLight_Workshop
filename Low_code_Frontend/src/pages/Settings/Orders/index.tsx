import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { paymentApi, type UserOrderDetail, type UserOrderItem } from '@/api/payment';
import { subscribePaymentEvents } from '@/utils/paymentEvents';

const { Text } = Typography;

const statusColorMap: Record<UserOrderItem['status'], string> = {
  pending: 'orange',
  paid: 'green',
  cancelled: 'default',
  failed: 'red',
};

const statusLabelMap: Record<UserOrderItem['status'], string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  failed: '支付失败',
};

export default function OrdersPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<UserOrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<UserOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = useCallback(async (pageParam = page, pageSizeParam = pageSize) => {
    try {
      setLoading(true);
      const res = await paymentApi.getMyOrders({ page: pageParam, pageSize: pageSizeParam });
      setOrders(res.list || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const unsubscribe = subscribePaymentEvents((event) => {
      void fetchOrders(page, pageSize);

      if (detailVisible && detail?.orderId === event.orderId) {
        void openDetail(event.orderId);
      }
    });

    return unsubscribe;
  }, [detail?.orderId, detailVisible, fetchOrders, page, pageSize]);

  const openDetail = async (orderId: string) => {
    setDetailVisible(true);
    setDetail(null);
    try {
      setDetailLoading(true);
      const d = await paymentApi.getOrderDetail(orderId);
      setDetail(d);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '获取订单详情失败');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!detail) return;
    try {
      setActionLoading(true);
      await paymentApi.cancelOrder(detail.orderId);
      message.success('订单已取消');
      setDetail({ ...detail, status: 'cancelled' });
      void fetchOrders(page, pageSize);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '取消失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!detail) return;
    try {
      setActionLoading(true);
      await paymentApi.deleteOrder(detail.orderId);
      message.success('订单已删除');
      setDetailVisible(false);
      void fetchOrders(page, pageSize);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContinuePay = () => {
    if (!detail?.payUrl) return;
    window.open(detail.payUrl, '_blank');
  };

  const columns: ColumnsType<UserOrderItem> = [
    {
      title: t('settings.orderId', '订单号'),
      dataIndex: 'orderId',
      key: 'orderId',
      width: 220,
      ellipsis: true,
    },
    {
      title: t('settings.packageName', '套餐'),
      dataIndex: 'packageName',
      key: 'packageName',
      ellipsis: true,
    },
    {
      title: t('settings.amount', '金额'),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: t('settings.stardust', '星尘'),
      dataIndex: 'stardust',
      key: 'stardust',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('settings.status', '状态'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: UserOrderItem['status']) => (
        <Tag color={statusColorMap[s]}>{statusLabelMap[s] ?? s}</Tag>
      ),
    },
    {
      title: t('settings.createdAt', '创建时间'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => {
        const d = value ? new Date(value) : null;
        return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : '-';
      },
    },
    {
      title: t('settings.paidAt', '支付时间'),
      dataIndex: 'paidAt',
      key: 'paidAt',
      width: 180,
      render: (value?: string) => {
        if (!value) return '-';
        const d = new Date(value);
        return !Number.isNaN(d.getTime()) ? d.toLocaleString() : '-';
      },
    },
    {
      title: t('settings.actions', '操作'),
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => openDetail(record.orderId)}>
          {t('settings.viewDetail', '查看详情')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <SettingsPageTitle title={t('settings.orders', '我的订单')} />
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Text type="secondary">
          {t(
            'settings.ordersDescription',
            '查看你的充值订单状态，包括待支付、已支付、已取消等。点击「查看详情」可继续支付、取消或删除订单。若已支付仍显示待支付，请刷新页面。',
          )}
        </Text>
      </Card>
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Table<UserOrderItem>
          rowKey="orderId"
          loading={loading}
          dataSource={orders}
          columns={columns}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize || 10);
              void fetchOrders(nextPage, nextSize || 10);
            },
          }}
        />
      </Card>

      <Modal
        title={t('settings.orderDetail', '订单详情')}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        {detailLoading && !detail ? (
          <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>
        ) : detail ? (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('settings.orderId', '订单号')}>{detail.orderId}</Descriptions.Item>
              <Descriptions.Item label={t('settings.packageName', '套餐')}>{detail.packageName}</Descriptions.Item>
              <Descriptions.Item label={t('settings.amount', '金额')}>¥{detail.amount.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('settings.stardust', '星尘')}>{detail.stardust.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={t('settings.status', '状态')}>
                <Tag color={statusColorMap[detail.status]}>{statusLabelMap[detail.status] ?? detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.createdAt', '创建时间')}>
                {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.paidAt', '支付时间')}>
                {detail.paidAt ? new Date(detail.paidAt).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.status === 'pending' && detail.payUrl && (
                <Button type="primary" onClick={handleContinuePay} loading={actionLoading}>
                  {t('settings.continuePay', '继续支付')}
                </Button>
              )}
              {detail.status === 'pending' && (
                <Button onClick={handleCancelOrder} loading={actionLoading}>
                  {t('settings.cancelOrder', '取消订单')}
                </Button>
              )}
              {(detail.status === 'pending' || detail.status === 'cancelled') && (
                <Button danger onClick={handleDeleteOrder} loading={actionLoading}>
                  {t('settings.deleteOrder', '删除订单')}
                </Button>
              )}
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

