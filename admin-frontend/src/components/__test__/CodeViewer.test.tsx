import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CodeViewer from '../CodeViewer';

vi.mock('@/theme', () => ({
  useAdminTheme: () => ({ mode: 'dark' }),
}));

describe('CodeViewer', () => {
  it('renders empty text for nullish values', () => {
    render(<CodeViewer value={null} emptyText="暂无数据" />);

    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('stringifies object values and applies max height', () => {
    const { container } = render(<CodeViewer value={{ id: 1, status: 'ok' }} maxHeight={320} />);

    expect(screen.getByText(/"status"/)).toBeInTheDocument();
    expect(screen.getByText(/"ok"/)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'dark');
    expect(container.firstElementChild).toHaveStyle({ '--code-max-height': '320px' });
  });
});
