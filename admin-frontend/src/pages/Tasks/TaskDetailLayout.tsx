import { useEffect, useState } from 'react';
import { App, Button, Card, Empty, Popconfirm, Space, Tabs } from 'antd';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { cancelAdminTask, getAdminTaskDetail, retryAdminTask } from '@/api/tasks';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { AdminTaskDetail } from '@/types/tasks';
import styles from './Tasks.module.scss';

export interface TaskDetailOutletContext {
  detail: AdminTaskDetail;
  refresh: () => Promise<void>;
}

function activeTaskTab(pathname: string, id: string) {
  if (pathname.endsWith('/nodes')) {
    return `/tasks/${id}/nodes`;
  }
  if (pathname.endsWith('/logs')) {
    return `/tasks/${id}/logs`;
  }
  return `/tasks/${id}`;
}

function canCancel(status: string) {
  return ['pending', 'queued', 'running', 'paused'].includes(status);
}

function canRetry(status: string) {
  return ['failed', 'timeout', 'cancelled'].includes(status);
}

export default function TaskDetailLayout() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('tasks.detail');
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState<AdminTaskDetail | null | undefined>(undefined);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);

  const refresh = async () => {
    if (!id) return;
    try {
      const payload = await getAdminTaskDetail(id);
      setDetail(payload);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('tasks.loadDetailFailed'));
      setDetail(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, [id]);

  if (detail === undefined || !id) {
    return <Card bordered={false} loading className={styles.card} />;
  }

  if (!detail) {
    return <Empty description={t('tasks.taskNotFound')} />;
  }

  const actions = (
    <Space wrap>
      {canEdit && canRetry(detail.task.status) ? (
        <Popconfirm
          title={t('tasks.retryConfirmTitle')}
          okText={t('tasks.retry')}
          cancelText={t('tasks.cancelBack')}
          onConfirm={async () => {
            try {
              setRetryLoading(true);
              const payload = await retryAdminTask(detail.task.id);
              message.success(payload.message || t('tasks.retryStarted'));
            } catch (error: unknown) {
              message.error(error instanceof Error ? error.message : t('tasks.retryFailed'));
            } finally {
              setRetryLoading(false);
            }
          }}
        >
          <Button loading={retryLoading}>{t('tasks.retryTask')}</Button>
        </Popconfirm>
      ) : null}
      {canEdit && canCancel(detail.task.status) ? (
        <Popconfirm
          title={t('tasks.cancelTaskConfirmTitle')}
          okText={t('tasks.cancelTask')}
          cancelText={t('tasks.cancelBack')}
          onConfirm={async () => {
            try {
              setCancelLoading(true);
              const payload = await cancelAdminTask(detail.task.id);
              message.success(payload.message || t('tasks.taskCancelled'));
              await refresh();
            } catch (error: unknown) {
              message.error(error instanceof Error ? error.message : t('tasks.cancelTaskFailed'));
            } finally {
              setCancelLoading(false);
            }
          }}
        >
          <Button danger loading={cancelLoading}>
            {t('tasks.cancelTask')}
          </Button>
        </Popconfirm>
      ) : null}
    </Space>
  );

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('tasks.detailEyebrow')}
        title={t('tasks.detailTitle', { id: detail.task.id })}
        description={t('tasks.detailDescription', { workflow: detail.workflow.name })}
        tags={[detail.task.status, detail.user.username, detail.workflow.name]}
        action={actions}
      />

      <Card bordered={false} className={styles.detailTabs}>
        <Tabs
          activeKey={activeTaskTab(location.pathname, id)}
          onChange={(key) => navigate(key)}
          items={[
            { key: `/tasks/${id}`, label: t('tasks.tabOverview') },
            { key: `/tasks/${id}/nodes`, label: t('tasks.tabNodes') },
            { key: `/tasks/${id}/logs`, label: t('tasks.tabLogs') },
          ]}
        />
      </Card>

      <Outlet context={{ detail, refresh }} />
    </div>
  );
}
