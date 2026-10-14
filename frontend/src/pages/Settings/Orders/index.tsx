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

function formatDateTime(value?: string, locale = 'zh-CN') {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(locale);
}

function formatCurrency(value?: number) {
  return `CNY ${(value || 0).toFixed(2)}`;
}

export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const locale = i18n.language === 'en-US' ? 'en-US' : 'zh-CN';
  const getStatusLabel = useCallback((status: UserOrderItem['status']) => {
    return t(`settings.orderStatus.${status}`, status);
  }, [t]);

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
      message.error(error instanceof Error ? error.message : t('settings.getOrderDetailFailed'));
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [message, t]);

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
      message.success(t('settings.orderCancelled'));
      setDetail({ ...detail, status: 'cancelled' });
      void fetchOrders(page, pageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.cancelOrderFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!detail) return;
    try {
      setActionLoading(true);
      await paymentApi.deleteOrder(detail.orderId);
      message.success(t('settings.orderDeleted'));
      setDetailVisible(false);
      void fetchOrders(page, pageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.deleteOrderFailed'));
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
        title: t('settings.orderId'),
        dataIndex: 'orderId',
        key: 'orderId',
        width: 240,
        ellipsis: true,
      },
      {
        title: t('settings.packageName'),
        dataIndex: 'packageName',
        key: 'packageName',
        ellipsis: true,
      },
      {
        title: t('settings.amount'),
        dataIndex: 'amount',
        key: 'amount',
        width: 140,
        render: (value: number) => formatCurrency(value),
      },
      {
        title: t('settings.stardust'),
        dataIndex: 'stardust',
        key: 'stardust',
        width: 130,
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: t('settings.status'),
        dataIndex: 'status',
        key: 'status',
        width: 130,
        render: (status: UserOrderItem['status']) => (
          <Tag color={statusColorMap[status]} className={styles.statusTag}>
            {getStatusLabel(status)}
          </Tag>
        ),
      },
      {
        title: t('settings.createdAt'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 190,
        render: (value: string) => formatDateTime(value, locale),
      },
      {
        title: t('settings.paidAt'),
        dataIndex: 'paidAt',
        key: 'paidAt',
        width: 190,
        render: (value?: string) => formatDateTime(value, locale),
      },
      {
        title: t('settings.actions'),
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" size="small" onClick={() => openDetail(record.orderId)}>
            {t('settings.viewDetail')}
          </Button>
        ),
      },
    ],
    [getStatusLabel, locale, openDetail, t],
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
            title={t('settings.orders')}
            desc={t('settings.ordersDescription')}
            icon={<FileTextOutlined />}
            style={{ marginBottom: 0 }}
          />

          <div className={styles.noticeCard}>
            <ClockCircleOutlined />
            <span>
              {t('settings.ordersNotice')}
            </span>
          </div>
        </div>

        <aside className={styles.metricRail}>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t('settings.orders')}</div>
            <div className={styles.metricValue}>{total.toLocaleString()}</div>
            <div className={styles.metricHint}>{t('settings.totalRecords', { total: total.toLocaleString() })}</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t('settings.pendingOrders')}</div>
            <div className={styles.metricValue}>{visiblePendingCount}</div>
            <div className={styles.metricHint}>{t('settings.requireActionHint')}</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t('settings.visibleStardust')}</div>
            <div className={styles.metricValue}>{visibleStardust.toLocaleString()}</div>
            <div className={styles.metricHint}>
              {t('settings.visiblePaidAmount')}
              {' '}
              {formatCurrency(visiblePaidAmount)}
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableEyebrow}>{t('settings.orders')}</div>
          <h2 className={styles.tableTitle}>{t('settings.orderHistory')}</h2>
          <p className={styles.tableDesc}>
            {t('settings.orderHistoryDesc')}
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
                  description={t('settings.noOrdersYet')}
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
        title={t('settings.orderDetail')}
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
                {getStatusLabel(detail.status)}
              </Tag>
            </div>

            <Descriptions column={1} size="small" className={styles.detailDescriptions}>
              <Descriptions.Item label={t('settings.amount')}>
                {formatCurrency(detail.amount)}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.stardust')}>
                {detail.stardust.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.createdAt')}>
                {formatDateTime(detail.createdAt, locale)}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.paidAt')}>
                {formatDateTime(detail.paidAt, locale)}
              </Descriptions.Item>
              {detail.expiresAt ? (
                <Descriptions.Item label={t('settings.expiresAt')}>
                  {formatDateTime(detail.expiresAt, locale)}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <div className={styles.detailActions}>
              {detail.status === 'pending' && detail.payUrl && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleContinuePay} loading={actionLoading}>
                  {t('settings.continuePay')}
                </Button>
              )}
              {detail.status === 'pending' && (
                <Button onClick={handleCancelOrder} loading={actionLoading}>
                  {t('settings.cancelOrder')}
                </Button>
              )}
              {(detail.status === 'pending' || detail.status === 'cancelled') && (
                <Button danger onClick={handleDeleteOrder} loading={actionLoading}>
                  {t('settings.deleteOrder')}
                </Button>
              )}
            </div>

            <Text className={styles.detailFootnote}>
              {t('settings.orderDetailFootnote')}
            </Text>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
