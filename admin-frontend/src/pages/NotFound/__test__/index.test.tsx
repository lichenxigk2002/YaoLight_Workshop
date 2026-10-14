import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import NotFoundPage from '../index';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('NotFoundPage', () => {
  it('shows a 404 result and navigates back to dashboard', async () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('页面不存在')).toBeInTheDocument();
    expect(screen.getByText('当前路由未定义，或者模块还没有接入。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '返回后台首页' }));
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
