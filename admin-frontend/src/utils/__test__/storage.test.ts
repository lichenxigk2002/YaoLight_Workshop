import { describe, expect, it } from 'vitest';
import type { AdminSession } from '@/types/auth';
import { clearAdminSession, getAdminSession, setAdminSession, updateAdminSessionUser } from '../storage';

const session: AdminSession = {
  token: 'real-token',
  user: {
    id: 1,
    username: 'admin',
    role: 'admin',
    permissions: ['dashboard:view'],
  },
};

describe('admin session storage', () => {
  it('stores, reads, updates, and clears admin session', () => {
    setAdminSession(session);
    expect(getAdminSession()).toEqual(session);

    updateAdminSessionUser({ ...session.user, username: 'root', permissions: ['users:view'] });
    expect(getAdminSession()?.user).toMatchObject({ username: 'root', permissions: ['users:view'] });

    clearAdminSession();
    expect(getAdminSession()).toBeNull();
  });

  it('removes malformed session payloads', () => {
    localStorage.setItem('yaolight_admin_session', '{bad json');

    expect(getAdminSession()).toBeNull();
    expect(localStorage.getItem('yaolight_admin_session')).toBeNull();
  });

  it('removes legacy mock admin-token sessions', () => {
    localStorage.setItem('yaolight_admin_session', JSON.stringify({ ...session, token: 'admin-token-dev' }));

    expect(getAdminSession()).toBeNull();
    expect(localStorage.getItem('yaolight_admin_session')).toBeNull();
  });

  it('does nothing when updating without an existing session', () => {
    updateAdminSessionUser({ ...session.user, username: 'missing' });

    expect(getAdminSession()).toBeNull();
  });
});
