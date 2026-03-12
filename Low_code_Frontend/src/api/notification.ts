import http from '@/http';
import type {
  Notification,
  NotificationConsentResult,
  NotificationListResponse,
  NotificationUnreadCountResponse,
} from '@/types/notification';

const BASE = '/notifications';

export const notificationApi = {
  getList: (page = 1, pageSize = 20) =>
    http.get<NotificationListResponse>(BASE, { page, pageSize }),

  getUnreadCount: () =>
    http.get<NotificationUnreadCountResponse>(`${BASE}/unread-count`),

  markRead: (id: number) =>
    http.put<void>(`${BASE}/${id}/read`),

  respondConsent: (id: number, action: 'agree' | 'reject') =>
    http.post<NotificationConsentResult>(`${BASE}/${id}/consent`, { action }),

  markAllRead: () =>
    http.put<void>(`${BASE}/read-all`),
};
