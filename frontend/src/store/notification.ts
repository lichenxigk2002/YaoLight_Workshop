import { create } from 'zustand';
import { notificationApi } from '@/api/notification';
import type { Notification } from '@/types/notification';

interface NotificationState {
  list: Notification[];
  total: number;
  unreadCount: number;
  loading: boolean;
  setList: (list: Notification[], total: number) => void;
  addNotification: (n: Notification) => void;
  setUnreadCount: (count: number) => void;
  fetchList: (page?: number, pageSize?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  respondConsent: (id: number, action: 'agree' | 'reject') => Promise<Notification>;
  markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  list: [],
  total: 0,
  unreadCount: 0,
  loading: false,

  setList: (list, total) => set({ list, total }),
  addNotification: (n) => {
    set((s) => ({
      list: [n, ...s.list],
      total: s.total + 1,
      unreadCount: s.unreadCount + (n.is_read ? 0 : 1),
    }));
  },
  setUnreadCount: (count) => set({ unreadCount: count }),

  fetchList: async (page = 1, pageSize = 20) => {
    set({ loading: true });
    try {
      const data = await notificationApi.getList(page, pageSize);
      set({ list: data.list, total: data.total, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await notificationApi.getUnreadCount();
      set({ unreadCount: data.count });
    } catch {
      // ignore
    }
  },

  markRead: async (id) => {
    try {
      await notificationApi.markRead(id);
      set((s) => ({
        list: s.list.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {
      // ignore
    }
  },

  deleteNotification: async (id) => {
    const current = get().list.find((item) => item.id === id);
    await notificationApi.delete(id);
    set((state) => ({
      list: state.list.filter((item) => item.id !== id),
      total: Math.max(0, state.total - 1),
      unreadCount: current && !current.is_read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
  },

  respondConsent: async (id, action) => {
    const current = get().list.find((item) => item.id === id);
    const data = await notificationApi.respondConsent(id, action);
    const updated = data.notification;

    set((state) => ({
      list: state.list.map((item) => (item.id === id ? updated : item)),
      unreadCount:
        current && !current.is_read && updated.is_read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
    }));

    return updated;
  },

  markAllRead: async () => {
    try {
      await notificationApi.markAllRead();
      set((s) => ({
        list: s.list.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {
      // ignore
    }
  },
}));
