import { Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { getAdminNotifications, type AdminNotificationItem } from '../api';
import styles from '../index.module.scss';

interface NotificationLogPanelProps {
  refreshToken?: number;
}

function formatDateTime(value?: string | null, fallback = '-') {
  if (!value) {
    return fallback;
  }
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export default function NotificationLogPanel({ refreshToken = 0 }: NotificationLogPanelProps) {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState({
    page: 1,
    page_size: 10,
    keyword: '',
    type: '',
    category: '',
    readStatus: 'all',
    userIDInput: '',
  });
  const typeOptions = [
    { label: t('notifications.log.filterAllTypes'), value: '' },
    { label: t('notifications.options.type.adminMessage'), value: 'admin_message' },
    { label: t('notifications.options.type.operationsUpdate'), value: 'operations_update' },
    { label: t('notifications.options.type.platformAnnouncement'), value: 'platform_announcement' },
  ];
  const categoryOptions = [
    { label: t('notifications.log.filterAllCategories'), value: '' },
    { label: t('notifications.options.category.platform'), value: 'platform' },
    { label: t('notifications.options.category.operations'), value: 'operations' },
    { label: t('notifications.options.category.system'), value: 'system' },
  ];
  const readStatusOptions = [
    { label: t('notifications.log.filterAllStates'), value: 'all' },
    { label: t('notifications.log.read'), value: 'read' },
    { label: t('notifications.log.unread'), value: 'unread' },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const parsedUserID = Number(query.userIDInput);
    const isRead = query.readStatus === 'all' ? undefined : query.readStatus === 'read';

    getAdminNotifications({
      page: query.page,
      page_size: query.page_size,
      keyword: query.keyword || undefined,
      type: query.type || undefined,
      category: query.category || undefined,
      user_id: Number.isFinite(parsedUserID) && parsedUserID > 0 ? parsedUserID : undefined,
      is_read: isRead,
    })
      .then((data) => {
        if (!cancelled) {
          setItems(data.list);
          setTotal(data.total);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          messageApi.error(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi, query, refreshToken]);

  const columns: ColumnsType<AdminNotificationItem> = [
    {
      title: t('notifications.log.columnNotification'),
      key: 'notification',
      render: (_, record) => (
        <div className={styles.titleCell}>
          <span className={styles.titleText}>{record.title}</span>
          <span className={styles.contentText}>{record.content || t('common.none')}</span>
        </div>
      ),
    },
    {
      title: t('notifications.log.columnRecipient'),
      key: 'recipient',
      width: 180,
      render: (_, record) => (
        <div className={styles.userCell}>
          <span>{record.user_username || `User #${record.user_id}`}</span>
          <span className={styles.contentText}>{record.user_email || t('common.none')}</span>
        </div>
      ),
    },
    {
      title: t('notifications.log.columnType'),
      dataIndex: 'type',
      width: 150,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: t('notifications.log.columnCategory'),
      dataIndex: 'category',
      width: 130,
      render: (value?: string | null) => value || t('common.none'),
    },
    {
      title: t('notifications.log.columnRead'),
      dataIndex: 'is_read',
      width: 100,
      render: (value: boolean) => (
        <Tag bordered={false} className={`${styles.softStatusTag} ${value ? styles.softStatusTagSuccess : styles.softStatusTagNeutral}`}>
          {value ? t('notifications.log.read') : t('notifications.log.unread')}
        </Tag>
      ),
    },
    {
      title: t('notifications.log.columnActionUrl'),
      dataIndex: 'action_url',
      width: 220,
      render: (value?: string | null) =>
        value ? (
          <a className={styles.linkText} href={value} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          t('common.none')
        ),
    },
    {
      title: t('notifications.log.columnExpiresAt'),
      dataIndex: 'expires_at',
      width: 180,
      render: (value?: string | null) => formatDateTime(value),
    },
    {
      title: t('notifications.log.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
  ];

  return (
    <>
      {contextHolder}
      <Space wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder={t('notifications.log.searchPlaceholder')}
          style={{ width: 260 }}
          onSearch={(value) => setQuery((current) => ({ ...current, page: 1, keyword: value.trim() }))}
        />
        <Input
          allowClear
          placeholder={t('notifications.log.userIdPlaceholder')}
          style={{ width: 140 }}
          value={query.userIDInput}
          onChange={(event) => setQuery((current) => ({ ...current, userIDInput: event.target.value, page: 1 }))}
        />
        <Select
          value={query.type}
          style={{ width: 180 }}
          options={typeOptions}
          onChange={(value) => setQuery((current) => ({ ...current, page: 1, type: value }))}
        />
        <Select
          value={query.category}
          style={{ width: 160 }}
          options={categoryOptions}
          onChange={(value) => setQuery((current) => ({ ...current, page: 1, category: value }))}
        />
        <Select
          value={query.readStatus}
          style={{ width: 140 }}
          options={readStatusOptions}
          onChange={(value) => setQuery((current) => ({ ...current, page: 1, readStatus: value }))}
        />
      </Space>

      <Table<AdminNotificationItem>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        scroll={{ x: 1500 }}
        pagination={{
          current: query.page,
          pageSize: query.page_size,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => {
            setQuery((current) => ({ ...current, page, page_size: pageSize || current.page_size }));
          },
        }}
      />
    </>
  );
}
