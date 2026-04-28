import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { User } from '@/types/user';
import { useAuthStore } from '@/store/auth';
import ProtectedRoute from '../index';

const user: User = {
  id: 1,
  username: 'demo',
  email: 'demo@example.com',
  role: 'user',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <div>受保护内容</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>登录页面</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('renders children when the user is authenticated with a token', () => {
    useAuthStore.setState({ user, token: 'token', isAuthenticated: true });

    renderProtected();

    expect(screen.getByText('受保护内容')).toBeInTheDocument();
  });

  it('redirects to login when the user is not authenticated', () => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });

    renderProtected();

    expect(screen.getByText('登录页面')).toBeInTheDocument();
    expect(screen.queryByText('受保护内容')).not.toBeInTheDocument();
  });
});
