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
