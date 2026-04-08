import { useEffect, useRef } from 'react';
import { message } from '@/utils/antdGlobal';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import type { Notification } from '@/types/notification';

const DEBUG = true; // 连接成功时在控制台输出，可改为 false 关闭

const getWsBaseUrl = () => {
  const base = import.meta.env.VITE_BASE_URL || '';
  if (base.startsWith('http')) {
    const wsBase = base.startsWith('https')
      ? base.replace(/^https/, 'wss')
      : base.replace(/^http/, 'ws');
    return `${wsBase.replace(/\/?$/, '')}/ws/notifications`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const apiPath = (import.meta.env.VITE_BASE_URL || '/api').replace(/^\//, '');
  return `${protocol}//${host}/${apiPath}/ws/notifications`;
};

/**
 * 建立站内通知 WebSocket，登录状态下连接，收到新通知时写入 store 并可选 toast
 */
export function useNotificationWS() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(0);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const url = `${getWsBaseUrl()}?token=${encodeURIComponent(token)}`;
    if (DEBUG) {
      console.log('[通知 WebSocket] 正在连接:', url.replace(/\?token=.*/, '?token=***'));
    }
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (DEBUG) {
        console.log('[通知 WebSocket] 连接已建立，可实时接收站内消息');
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.event === 'notification' && msg.data) {
          const n = msg.data as Notification;
          addNotification(n);
          fetchUnreadCount();
          message.info(n.title || '您有一条新消息');
        }
      } catch {
        if (DEBUG) console.warn('[通知 WebSocket] 解析消息失败:', event.data);
      }
    };

    ws.onerror = () => {
      if (DEBUG) console.warn('[通知 WebSocket] 连接异常，请检查后端是否启动、代理是否支持 ws');
    };

    ws.onclose = () => {
      if (DEBUG) console.log('[通知 WebSocket] 连接已关闭');
      wsRef.current = null;
      reconnectTimerRef.current = window.setTimeout(() => {}, 3000);
    };

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [isAuthenticated, token, addNotification, fetchUnreadCount]);

  return null;
}
