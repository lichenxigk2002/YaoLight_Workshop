import http from '@/http';
import type {
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

  delete: (id: number) =>
    http.delete<void>(`${BASE}/${id}`),

  respondConsent: (id: number, action: 'agree' | 'reject') =>
    http.post<NotificationConsentResult>(`${BASE}/${id}/consent`, { action }),

  markAllRead: () =>
    http.put<void>(`${BASE}/read-all`),
};
