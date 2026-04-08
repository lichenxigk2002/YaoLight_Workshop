import type { AdminLocale } from '@/i18n/messages';

type TaskStatusMeta = {
  color: string;
  label: string;
};

const statusLabels: Record<AdminLocale, Record<string, string>> = {
  'zh-CN': {
    pending: '待处理',
    queued: '排队中',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    timeout: '超时',
    skipped: '已跳过',
  },
  'en-US': {
    pending: 'Pending',
    queued: 'Queued',
    running: 'Running',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    timeout: 'Timed Out',
    skipped: 'Skipped',
  },
};

export function getTaskStatusMeta(status: string, locale: AdminLocale): TaskStatusMeta {
  const labels = statusLabels[locale];

  switch (status) {
    case 'completed':
      return { color: 'green', label: labels.completed };
    case 'running':
    case 'queued':
    case 'pending':
    case 'paused':
      return { color: 'blue', label: labels[status] ?? status };
    case 'failed':
    case 'timeout':
      return { color: 'red', label: labels[status] ?? status };
    case 'cancelled':
      return { color: 'default', label: labels.cancelled };
    case 'skipped':
      return { color: 'orange', label: labels.skipped };
    default:
      return { color: 'default', label: status };
  }
}

export function getTaskStatusLabel(status: string, locale: AdminLocale) {
  return getTaskStatusMeta(status, locale).label;
}
