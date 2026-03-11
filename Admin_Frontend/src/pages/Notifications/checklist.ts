export type NotificationCenterTarget =
  | 'send'
  | 'jobs'
  | 'log'
  | 'analytics'
  | 'templates';

export interface NotificationChecklistItem {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  target: NotificationCenterTarget;
}

export function getNotificationTodoChecklist(
  t: (key: string, params?: Record<string, string | number>) => string,
): NotificationChecklistItem[] {
  return [
    {
      key: 'send-selected-users',
      title: t('notifications.checklist.sendSelectedUsersTitle'),
      detail: t('notifications.checklist.sendSelectedUsersDetail'),
      done: true,
      target: 'send',
    },
    {
      key: 'batch-send',
      title: t('notifications.checklist.batchSendTitle'),
      detail: t('notifications.checklist.batchSendDetail'),
      done: true,
      target: 'jobs',
    },
    {
      key: 'classification',
      title: t('notifications.checklist.classificationTitle'),
      detail: t('notifications.checklist.classificationDetail'),
      done: true,
      target: 'send',
    },
    {
      key: 'action-link',
      title: t('notifications.checklist.actionLinkTitle'),
      detail: t('notifications.checklist.actionLinkDetail'),
      done: true,
      target: 'send',
    },
    {
      key: 'expiry',
      title: t('notifications.checklist.expiryTitle'),
      detail: t('notifications.checklist.expiryDetail'),
      done: true,
      target: 'log',
    },
    {
      key: 'management-list',
      title: t('notifications.checklist.managementListTitle'),
      detail: t('notifications.checklist.managementListDetail'),
      done: true,
      target: 'log',
    },
    {
      key: 'send-jobs',
      title: t('notifications.checklist.sendJobsTitle'),
      detail: t('notifications.checklist.sendJobsDetail'),
      done: true,
      target: 'jobs',
    },
    {
      key: 'read-rate',
      title: t('notifications.checklist.readRateTitle'),
      detail: t('notifications.checklist.readRateDetail'),
      done: true,
      target: 'analytics',
    },
    {
      key: 'templates',
      title: t('notifications.checklist.templatesTitle'),
      detail: t('notifications.checklist.templatesDetail'),
      done: true,
      target: 'templates',
    },
    {
      key: 'failure-tracking',
      title: t('notifications.checklist.failureTrackingTitle'),
      detail: t('notifications.checklist.failureTrackingDetail'),
      done: true,
      target: 'jobs',
    },
  ];
}
