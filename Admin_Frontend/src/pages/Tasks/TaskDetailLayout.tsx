import { useEffect, useState } from 'react';
import { App, Button, Card, Empty, Popconfirm, Space, Tabs } from 'antd';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { cancelAdminTask, getAdminTaskDetail, retryAdminTask } from '@/api/tasks';
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
      message.error(error instanceof Error ? error.message : '加载任务详情失败');
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
    return <Empty description="任务不存在" />;
  }

  const actions = (
    <Space wrap>
      {canRetry(detail.task.status) ? (
        <Popconfirm
          title="确认重试这个任务？"
          okText="重试"
          cancelText="取消"
          onConfirm={async () => {
            try {
              setRetryLoading(true);
              const payload = await retryAdminTask(detail.task.id);
              message.success(payload.message || '已发起重试');
            } catch (error: unknown) {
              message.error(error instanceof Error ? error.message : '重试任务失败');
            } finally {
              setRetryLoading(false);
            }
          }}
        >
          <Button loading={retryLoading}>重试任务</Button>
        </Popconfirm>
      ) : null}
      {canCancel(detail.task.status) ? (
        <Popconfirm
          title="确认取消这个任务？"
          okText="取消任务"
          cancelText="返回"
          onConfirm={async () => {
            try {
              setCancelLoading(true);
              const payload = await cancelAdminTask(detail.task.id);
              message.success(payload.message || '任务已取消');
              await refresh();
            } catch (error: unknown) {
              message.error(error instanceof Error ? error.message : '取消任务失败');
            } finally {
              setCancelLoading(false);
            }
          }}
        >
          <Button danger loading={cancelLoading}>
            取消任务
          </Button>
        </Popconfirm>
      ) : null}
    </Space>
  );

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="Task Detail"
        title={`任务 #${detail.task.id}`}
        description={`查看工作流“${detail.workflow.name}”的执行现场，支持下钻节点、日志和制品。`}
        tags={[detail.task.status, detail.user.username, detail.workflow.name]}
        action={actions}
      />

      <Card bordered={false} className={styles.detailTabs}>
        <Tabs
          activeKey={activeTaskTab(location.pathname, id)}
          onChange={(key) => navigate(key)}
          items={[
            { key: `/tasks/${id}`, label: '概览' },
            { key: `/tasks/${id}/nodes`, label: '节点执行' },
            { key: `/tasks/${id}/logs`, label: '任务日志' },
          ]}
        />
      </Card>

      <Outlet context={{ detail, refresh }} />
    </div>
  );
}
