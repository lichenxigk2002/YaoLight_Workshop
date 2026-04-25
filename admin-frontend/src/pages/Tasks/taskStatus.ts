import type { AdminLocale } from '@/i18n/messages';
import { translate } from '@/i18n/runtime';

type TaskStatusMeta = {
  color: string;
  label: string;
};

const statusLabelKeys: Record<string, string> = {
  pending: 'tasks.statusPending',
  queued: 'tasks.statusQueued',
  running: 'tasks.statusRunning',
  paused: 'tasks.statusPaused',
  completed: 'tasks.statusCompleted',
  failed: 'tasks.statusFailed',
  cancelled: 'tasks.statusCancelled',
  timeout: 'tasks.statusTimeout',
  skipped: 'tasks.statusSkipped',
};

function getStatusLabel(status: string, locale: AdminLocale) {
  const key = statusLabelKeys[status];
  return key ? translate(locale, key) : status;
}

export function getTaskStatusMeta(status: string, locale: AdminLocale): TaskStatusMeta {
  switch (status) {
    case 'completed':
      return { color: 'green', label: getStatusLabel(status, locale) };
    case 'running':
    case 'queued':
    case 'pending':
    case 'paused':
      return { color: 'blue', label: getStatusLabel(status, locale) };
    case 'failed':
    case 'timeout':
      return { color: 'red', label: getStatusLabel(status, locale) };
    case 'cancelled':
      return { color: 'default', label: getStatusLabel(status, locale) };
    case 'skipped':
      return { color: 'orange', label: getStatusLabel(status, locale) };
    default:
      return { color: 'default', label: status };
  }
}

export function getTaskStatusLabel(status: string, locale: AdminLocale) {
  return getTaskStatusMeta(status, locale).label;
}
