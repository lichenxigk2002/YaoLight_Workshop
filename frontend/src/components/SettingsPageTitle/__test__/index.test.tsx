import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsPageTitle from '../index';

describe('SettingsPageTitle', () => {
  it('renders title, description, icon, and custom style', () => {
    render(
      <SettingsPageTitle
        title="账户设置"
        desc="维护个人资料和偏好"
        icon={<span data-testid="title-icon">I</span>}
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    );

    expect(screen.getByRole('heading', { name: '账户设置' })).toBeInTheDocument();
    expect(screen.getByText('维护个人资料和偏好')).toBeInTheDocument();
    expect(screen.getByTestId('title-icon')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveStyle({ color: 'rgb(1, 2, 3)' });
  });

  it('omits optional description and icon when they are not provided', () => {
    render(<SettingsPageTitle title="安全设置" />);

    expect(screen.getByRole('heading', { name: '安全设置' })).toBeInTheDocument();
    expect(screen.queryByText('维护个人资料和偏好')).not.toBeInTheDocument();
  });
});
