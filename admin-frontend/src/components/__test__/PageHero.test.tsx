import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageHero from '../PageHero';

describe('PageHero', () => {
  it('renders hero copy, tags, and action', () => {
    render(
      <PageHero
        eyebrow="运营中心"
        title="任务监控"
        description="集中查看执行状态和失败原因"
        tags={['实时', '可追踪']}
        action={<button type="button">刷新</button>}
      />,
    );

    expect(screen.getByText('运营中心')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '任务监控' })).toBeInTheDocument();
    expect(screen.getByText('集中查看执行状态和失败原因')).toBeInTheDocument();
    expect(screen.getByText('实时')).toBeInTheDocument();
    expect(screen.getByText('可追踪')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument();
  });
});
