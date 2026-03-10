import type { AdminSession } from '@/types/auth';

const ADMIN_SESSION_KEY = 'yaolight_admin_session';

export function getAdminSession(): AdminSession | null {
  const raw = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AdminSession;
    if (session?.token?.startsWith('admin-token-')) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

export function setAdminSession(session: AdminSession) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}
