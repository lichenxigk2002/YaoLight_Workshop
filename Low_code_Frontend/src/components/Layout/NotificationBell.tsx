import { useEffect, useState } from 'react';
import { Badge, Button, Dropdown, Empty, Modal, Spin, Tooltip } from 'antd';
import { MessageOutlined, SettingOutlined } from '@ant-design/icons';
import { NotificationBellIcon, SweepIcon } from '@/components/Icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import { useNotificationWS } from '@/hooks/useNotificationWS';
import type { Notification } from '@/types/notification';
import styles from './index.module.scss';

function formatTime(createdAt: string) {
  const d = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return d.toLocaleDateString();
}

function formatDateShort(createdAt: string) {
  const d = new Date(createdAt);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

type TabFilter = 'all' | 'unread';

function normalizeNotificationText(content?: string) {
  if (!content) {
    return '';
  }
  return content.replace(/\\n/g, '\n');
}

function isWorkflowCompletionNotification(notification: Notification) {
  return notification.type === 'task_completed';
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState<TabFilter>('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  useNotificationWS();

  const {
    list,
    unreadCount,
    loading,
    fetchList,
    fetchUnreadCount,
    markRead,
    markAllRead,
  } = useNotificationStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchList(1, 10);
      fetchUnreadCount();
    }
  }, [isAuthenticated, fetchList, fetchUnreadCount]);

  const filteredList = tab === 'unread' ? list.filter((n) => !n.is_read) : list.slice(0, 10);

  const handleCardClick = async (n: Notification) => {
    if (!n.is_read) {
      await markRead(n.id);
    }

    if (isWorkflowCompletionNotification(n) && n.action_url?.startsWith('/projects/')) {
      setDetailOpen(false);
      navigate(n.action_url);
      return;
    }

    setSelectedNotification(n);
    setDetailOpen(true);
  };

  const dropdownContent = (
    <div className={styles.notificationDropdown}>
      <div className={styles.notificationHeader}>
        <span className={styles.notificationHeaderTitle}>{t('layout.notifications')}</span>
        <span className={styles.notificationHeaderIcons}>
          <Tooltip title={t('layout.markAllRead')}>
            <button
              type="button"
              className={styles.notificationHeaderIconBtn}
              onClick={() => markAllRead()}
              aria-label={t('layout.markAllRead')}
            >
              <SweepIcon size={14} color="currentColor" />
            </button>
          </Tooltip>
          <Tooltip title={t('layout.notificationSettings')}>
            <button
              type="button"
              className={styles.notificationHeaderIconBtn}
              onClick={() => navigate('/settings/notifications')}
              aria-label={t('layout.notificationSettings')}
            >
              <SettingOutlined />
            </button>
          </Tooltip>
        </span>
      </div>
      <div className={styles.notificationTabs}>
        <button
          type="button"
          className={`${styles.notificationTab} ${tab === 'all' ? styles.notificationTabActive : ''}`}
          onClick={() => setTab('all')}
        >
          {t('layout.notificationAll')}
        </button>
        <button
          type="button"
          className={`${styles.notificationTab} ${tab === 'unread' ? styles.notificationTabActive : ''}`}
          onClick={() => setTab('unread')}
        >
          {t('layout.notificationUnread')}
        </button>
      </div>
      <div className={styles.notificationList}>
        {loading ? (
          <div className={styles.notificationLoading}>
            <Spin size="small" />
          </div>
        ) : filteredList.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('layout.notificationEmpty')} />
        ) : (
          filteredList.map((n) => (
            <div
              key={n.id}
              className={`${styles.notificationCard} ${!n.is_read ? styles.notificationCardUnread : ''}`}
            >
              <div className={styles.notificationCardRow}>
                <span className={styles.notificationCardIcon}>
                  <MessageOutlined />
                </span>
                <span className={styles.notificationCardTitle}>{n.title}</span>
                <span className={styles.notificationCardDate}>{formatDateShort(n.created_at)}</span>
              </div>
              {n.content && (
                <div className={styles.notificationCardContent}>{normalizeNotificationText(n.content)}</div>
              )}
              <Button
                type="primary"
                size="small"
                className={styles.notificationCardBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCardClick(n);
                }}
              >
                {t('layout.notificationView')}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (!isAuthenticated) return null;

  return (
    <>
      <Dropdown
        dropdownRender={() => dropdownContent}
        trigger={['click']}
        placement="bottomRight"
      >
        <Button
          className={styles.headerIconBtn}
          shape="circle"
          size="middle"
          icon={
            <Badge count={unreadCount} size="small" offset={[-1, 1]}>
              <NotificationBellIcon size={15} color="currentColor" className={styles.notificationBellIcon} />
            </Badge>
          }
        />
      </Dropdown>

      <Modal
        open={detailOpen}
        title={selectedNotification?.title || t('layout.notificationDetailTitle')}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Button onClick={() => setDetailOpen(false)}>
            {t('common.cancel')}
          </Button>
        }
        width={560}
        className={styles.notificationDetailModal}
      >
        <div className={styles.notificationDetailMeta}>
          <span>{t('layout.notificationCreatedAt')}: {selectedNotification?.created_at ? new Date(selectedNotification.created_at).toLocaleString() : '-'}</span>
          <span>{t('layout.notificationType')}: {selectedNotification?.type || '-'}</span>
        </div>
        <div className={styles.notificationDetailContent}>
          {normalizeNotificationText(selectedNotification?.content) || t('layout.notificationEmpty')}
        </div>
      </Modal>
    </>
  );
}
