import { useEffect, useState } from 'react';
import { App, Badge, Button, Dropdown, Empty, Modal, Popconfirm, Spin, Tooltip } from 'antd';
import { DeleteOutlined, MessageOutlined, SettingOutlined } from '@ant-design/icons';
import { NotificationBellIcon, SweepIcon } from '@/components/Icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import { useNotificationWS } from '@/hooks/useNotificationWS';
import type { Notification } from '@/types/notification';
import { taskApi } from '@/api/task';
import { workflowApi } from '@/api/workflow';
import styles from './index.module.scss';

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

function isTemplateConsentNotification(notification?: Notification | null) {
  return notification?.type === 'workflow_template_consent_request';
}

function getConsentStatus(notification?: Notification | null) {
  if (!notification?.metadata || typeof notification.metadata !== 'object') {
    return undefined;
  }
  const status = notification.metadata.consent_status;
  return typeof status === 'string' ? status : undefined;
}

function canRespondToConsent(notification?: Notification | null) {
  return isTemplateConsentNotification(notification) && getConsentStatus(notification) === 'pending';
}

function getTaskIdFromActionURL(actionURL?: string) {
  const match = actionURL?.match(/^\/tasks\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState<TabFilter>('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [consentSubmittingId, setConsentSubmittingId] = useState<number | null>(null);
  useNotificationWS();

  const {
    list,
    unreadCount,
    loading,
    fetchList,
    fetchUnreadCount,
    markRead,
    deleteNotification,
    respondConsent,
    markAllRead,
  } = useNotificationStore();
  const isEnglish = i18n.language.startsWith('en');

  useEffect(() => {
    if (isAuthenticated) {
      fetchList(1, 100);
      fetchUnreadCount();
    }
  }, [isAuthenticated, fetchList, fetchUnreadCount]);

  const filteredList = tab === 'unread' ? list.filter((n) => !n.is_read) : list;

  const openNotificationAction = async (n: Notification) => {
    if (!n.action_url) {
      return false;
    }

    if (n.action_url.startsWith('/projects/')) {
      setDetailOpen(false);
      navigate(n.action_url);
      return true;
    }

    const taskId = getTaskIdFromActionURL(n.action_url);
    if (taskId) {
      try {
        const task = await taskApi.getTaskDetail(taskId);
        const workflow = await workflowApi.getWorkflowById(task.workflowId);
        if (workflow.projectId && task.workflowId) {
          setDetailOpen(false);
          navigate(`/projects/${workflow.projectId}/workflows/${task.workflowId}/edit?panel=result&taskId=${task.id}`);
          return true;
        }
      } catch (error: any) {
        message.error(error.message || (isEnglish ? 'Failed to open task result.' : '打开任务结果失败'));
        return true;
      }
    }

    return false;
  };

  const handleCardClick = async (n: Notification) => {
    if (!n.is_read) {
      await markRead(n.id);
    }

    if (isWorkflowCompletionNotification(n) && await openNotificationAction(n)) {
      return;
    }

    setSelectedNotification(n);
    setDetailOpen(true);
  };

  const handleConsentAction = async (notification: Notification, action: 'agree' | 'reject') => {
    setConsentSubmittingId(notification.id);
    try {
      const updated = await respondConsent(notification.id, action);
      setSelectedNotification((current) => (current?.id === updated.id ? updated : current));
      message.success(
        action === 'agree'
          ? isEnglish
            ? 'Consent recorded.'
            : '已同意该模板发布请求'
          : isEnglish
            ? 'Rejection recorded.'
            : '已拒绝该模板发布请求',
      );
    } catch {
      // handled by the shared HTTP client
    } finally {
      setConsentSubmittingId(null);
    }
  };

  const handleDeleteNotification = async (notification: Notification) => {
    try {
      await deleteNotification(notification.id);
      if (selectedNotification?.id === notification.id) {
        setDetailOpen(false);
        setSelectedNotification(null);
      }
      message.success(isEnglish ? 'Notification deleted.' : '通知已删除');
    } catch (error: any) {
      message.error(error.message || (isEnglish ? 'Failed to delete notification.' : '删除通知失败'));
    }
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canRespondToConsent(n) ? (
                  <>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleConsentAction(n, 'reject');
                      }}
                      loading={consentSubmittingId === n.id}
                    >
                      {isEnglish ? 'Reject' : '拒绝'}
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      className={styles.notificationCardBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleConsentAction(n, 'agree');
                      }}
                      loading={consentSubmittingId === n.id}
                    >
                      {isEnglish ? 'Agree' : '同意'}
                    </Button>
                  </>
                ) : null}
                <Button
                  type={canRespondToConsent(n) ? 'default' : 'primary'}
                  size="small"
                  className={styles.notificationCardBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCardClick(n);
                  }}
                >
                  {t('layout.notificationView')}
                </Button>
                <Popconfirm
                  title={isEnglish ? 'Delete this notification?' : '删除这条通知？'}
                  okText={isEnglish ? 'Delete' : '删除'}
                  cancelText={t('common.cancel')}
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    void handleDeleteNotification(n);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </div>
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
          canRespondToConsent(selectedNotification) ? (
            <>
              <Button
                onClick={() => {
                  if (selectedNotification) {
                    void handleConsentAction(selectedNotification, 'reject');
                  }
                }}
                loading={consentSubmittingId === selectedNotification?.id}
              >
                {isEnglish ? 'Reject' : '拒绝'}
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  if (selectedNotification) {
                    void handleConsentAction(selectedNotification, 'agree');
                  }
                }}
                loading={consentSubmittingId === selectedNotification?.id}
              >
                {isEnglish ? 'Agree' : '同意'}
              </Button>
              <Button onClick={() => setDetailOpen(false)}>
                {t('common.cancel')}
              </Button>
              {selectedNotification ? (
                <Popconfirm
                  title={isEnglish ? 'Delete this notification?' : '删除这条通知？'}
                  okText={isEnglish ? 'Delete' : '删除'}
                  cancelText={t('common.cancel')}
                  onConfirm={() => {
                    void handleDeleteNotification(selectedNotification);
                  }}
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ) : null}
            </>
          ) : selectedNotification?.action_url ? (
            <>
              <Button
                type="primary"
                onClick={() => {
                  if (selectedNotification) {
                    void openNotificationAction(selectedNotification);
                  }
                }}
              >
                {isWorkflowCompletionNotification(selectedNotification)
                  ? t('workflowEditor.viewResult')
                  : t('layout.notificationView')}
              </Button>
              <Button onClick={() => setDetailOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Popconfirm
                title={isEnglish ? 'Delete this notification?' : '删除这条通知？'}
                okText={isEnglish ? 'Delete' : '删除'}
                cancelText={t('common.cancel')}
                onConfirm={() => {
                  void handleDeleteNotification(selectedNotification);
                }}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : (
            <>
              <Button onClick={() => setDetailOpen(false)}>
                {t('common.cancel')}
              </Button>
              {selectedNotification ? (
                <Popconfirm
                  title={isEnglish ? 'Delete this notification?' : '删除这条通知？'}
                  okText={isEnglish ? 'Delete' : '删除'}
                  cancelText={t('common.cancel')}
                  onConfirm={() => {
                    void handleDeleteNotification(selectedNotification);
                  }}
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ) : null}
            </>
          )
        }
        width={560}
        className={styles.notificationDetailModal}
      >
        <div className={styles.notificationDetailMeta}>
          <span>{t('layout.notificationCreatedAt')}: {selectedNotification?.created_at ? new Date(selectedNotification.created_at).toLocaleString() : '-'}</span>
          <span>{t('layout.notificationType')}: {selectedNotification?.type || '-'}</span>
        </div>
        {isTemplateConsentNotification(selectedNotification) ? (
          <div className={styles.notificationDetailMeta}>
            <span>
              {isEnglish ? 'Consent status' : '确认状态'}:{' '}
              {getConsentStatus(selectedNotification) === 'pending'
                ? isEnglish
                  ? 'Pending'
                  : '待处理'
                : getConsentStatus(selectedNotification) === 'agreed'
                  ? isEnglish
                    ? 'Agreed'
                    : '已同意'
                  : getConsentStatus(selectedNotification) === 'rejected'
                    ? isEnglish
                      ? 'Rejected'
                      : '已拒绝'
                    : '-'}
            </span>
          </div>
        ) : null}
        <div className={styles.notificationDetailContent}>
          {normalizeNotificationText(selectedNotification?.content) || t('layout.notificationEmpty')}
        </div>
      </Modal>
    </>
  );
}
