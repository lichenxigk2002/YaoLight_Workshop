import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Empty, Modal, Spin, Table, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { paymentApi, type UserOrderDetail, type UserOrderItem } from '@/api/payment';
import { subscribePaymentEvents } from '@/utils/paymentEvents';
import styles from './index.module.scss';

const { Text } = Typography;

const statusColorMap: Record<UserOrderItem['status'], string> = {
  pending: 'gold',
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

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function formatCurrency(value?: number) {
  return `CNY ${(value || 0).toFixed(2)}`;
}

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

  const fetchOrders = useCallback(
    async (pageParam = page, pageSizeParam = pageSize) => {
      try {
        setLoading(true);
        const res = await paymentApi.getMyOrders({ page: pageParam, pageSize: pageSizeParam });
        setOrders(res.list || []);
        setTotal(res.total || 0);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  );

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const openDetail = useCallback(async (orderId: string) => {
    setDetailVisible(true);
    setDetail(null);
    try {
      setDetailLoading(true);
      const orderDetail = await paymentApi.getOrderDetail(orderId);
      setDetail(orderDetail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取订单详情失败');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [message]);

  useEffect(() => {
    const unsubscribe = subscribePaymentEvents((event) => {
      void fetchOrders(page, pageSize);

      if (detailVisible && detail?.orderId === event.orderId) {
        void openDetail(event.orderId);
      }
    });

    return unsubscribe;
  }, [detail?.orderId, detailVisible, fetchOrders, openDetail, page, pageSize]);

  const handleCancelOrder = async () => {
    if (!detail) return;
    try {
      setActionLoading(true);
      await paymentApi.cancelOrder(detail.orderId);
      message.success('订单已取消');
      setDetail({ ...detail, status: 'cancelled' });
      void fetchOrders(page, pageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '取消失败');
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
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContinuePay = () => {
    if (!detail?.payUrl) return;
    window.open(detail.payUrl, '_blank');
  };

  const columns = useMemo<ColumnsType<UserOrderItem>>(
    () => [
      {
        title: t('settings.orderId', '订单号'),
        dataIndex: 'orderId',
        key: 'orderId',
        width: 240,
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
        width: 140,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: t('settings.stardust', '星尘'),
        dataIndex: 'stardust',
        key: 'stardust',
        width: 130,
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: t('settings.status', '状态'),
        dataIndex: 'status',
        key: 'status',
        width: 130,
        render: (status: UserOrderItem['status']) => (
          <Tag color={statusColorMap[status]} className={styles.statusTag}>
            {statusLabelMap[status] ?? status}
          </Tag>
        ),
      },
      {
        title: t('settings.createdAt', '创建时间'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 190,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: t('settings.paidAt', '支付时间'),
        dataIndex: 'paidAt',
        key: 'paidAt',
        width: 190,
        render: (value?: string) => formatDateTime(value),
      },
      {
        title: t('settings.actions', '操作'),
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" size="small" onClick={() => openDetail(record.orderId)}>
            {t('settings.viewDetail', '查看详情')}
          </Button>
        ),
      },
    ],
    [openDetail, t],
  );

  const visiblePendingCount = orders.filter((order) => order.status === 'pending').length;
  const visiblePaidAmount = orders
    .filter((order) => order.status === 'paid')
    .reduce((sum, order) => sum + order.amount, 0);
  const visibleStardust = orders.reduce((sum, order) => sum + order.stardust, 0);

  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroMain}>
          <SettingsPageTitle
            title={t('settings.orders', '我的订单')}
            desc={t(
              'settings.ordersDescription',
              '查看充值订单的支付状态、支付时间和获取的星尘数量，需要继续支付或处理异常时也能在这里完成。',
            )}
            icon={<FileTextOutlined />}
            style={{ marginBottom: 0 }}
          />

          <div className={styles.noticeCard}>
            <ClockCircleOutlined />
            <span>
              {t(
                'settings.ordersNotice',
                '如果第三方支付已经完成但状态还没刷新，可以重新进入详情页或稍后刷新本页。',
              )}
            </span>
          </div>
        </div>

        <aside className={styles.metricRail}>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t('settings.orders', '我的订单')}</div>
            <div className={styles.metricValue}>{total.toLocaleString()}</div>
            <div className={styles.metricHint}>{`共 ${total.toLocaleString()} 条`}</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t('settings.pendingOrders', '当前页待支付')}</div>
            <div className={styles.metricValue}>{visiblePendingCount}</div>
            <div className={styles.metricHint}>{t('settings.requireActionHint', '适合继续支付或取消处理')}</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t('settings.visibleStardust', '当前页星尘')}</div>
            <div className={styles.metricValue}>{visibleStardust.toLocaleString()}</div>
            <div className={styles.metricHint}>
              {t('settings.visiblePaidAmount', '已支付金额')}
              {' '}
              {formatCurrency(visiblePaidAmount)}
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableEyebrow}>{t('settings.orders', '我的订单')}</div>
          <h2 className={styles.tableTitle}>{t('settings.orderHistory', '订单记录')}</h2>
          <p className={styles.tableDesc}>
            {t(
              'settings.orderHistoryDesc',
              '按时间查看支付状态、金额和到账星尘，右侧可进入单条订单详情继续处理。',
            )}
          </p>
        </div>

        <div className={styles.tableShell}>
          <Table<UserOrderItem>
            rowKey="orderId"
            loading={loading}
            dataSource={orders}
            columns={columns}
            scroll={{ x: 1080 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('settings.noOrdersYet', '暂时还没有订单记录')}
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              onChange: (nextPage, nextSize) => {
                const resolvedPageSize = nextSize || 10;
                setPage(nextPage);
                setPageSize(resolvedPageSize);
                void fetchOrders(nextPage, resolvedPageSize);
              },
            }}
          />
        </div>
      </section>

      <Modal
        title={t('settings.orderDetail', '订单详情')}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={620}
        destroyOnClose
        className={styles.detailModal}
      >
        {detailLoading && !detail ? (
          <div className={styles.detailLoading}>
            <Spin />
          </div>
        ) : detail ? (
          <div className={styles.detailBody}>
            <div className={styles.detailHero}>
              <div>
                <div className={styles.detailOrderId}>{detail.orderId}</div>
                <div className={styles.detailMeta}>
                  <WalletOutlined />
                  <span>{detail.packageName}</span>
                </div>
              </div>
              <Tag color={statusColorMap[detail.status]} className={styles.statusTag}>
                {statusLabelMap[detail.status] ?? detail.status}
              </Tag>
            </div>

            <Descriptions column={1} size="small" className={styles.detailDescriptions}>
              <Descriptions.Item label={t('settings.amount', '金额')}>
                {formatCurrency(detail.amount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.stardust', '星尘')}>
                {detail.stardust.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.createdAt', '创建时间')}>
                {formatDateTime(detail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.paidAt', '支付时间')}>
                {formatDateTime(detail.paidAt)}
              </Descriptions.Item>
              {detail.expiresAt ? (
                <Descriptions.Item label={t('settings.expiresAt', '过期时间')}>
                  {formatDateTime(detail.expiresAt)}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <div className={styles.detailActions}>
              {detail.status === 'pending' && detail.payUrl && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleContinuePay} loading={actionLoading}>
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

            <Text className={styles.detailFootnote}>
              {t(
                'settings.orderDetailFootnote',
                '订单删除后不会影响已经到账的星尘，只会从个人订单列表中移除该记录。',
              )}
            </Text>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
